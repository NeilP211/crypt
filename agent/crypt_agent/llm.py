"""Thin LLM client used by the agent and the judge.

Wraps the Anthropic Messages API with tool-use support behind a small
interface, so the rest of the codebase never imports the SDK directly and the
provider could be swapped without touching the agent loop.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .config import Settings, load_settings


class LLMUnavailable(RuntimeError):
    """Raised when an LLM call is attempted without an API key."""


@dataclass
class LLMResponse:
    text: str
    tool_calls: list[dict]  # [{id, name, input}]
    stop_reason: str
    raw: Any = None


class LLM:
    def __init__(self, settings: Settings | None = None):
        self.settings = settings or load_settings()
        self._client = None

    @property
    def client(self):
        if not self.settings.has_llm:
            raise LLMUnavailable(
                "ANTHROPIC_API_KEY is not set. Retrieval/eval-retrieval work "
                "without it; the agent and judge need it."
            )
        if self._client is None:
            import anthropic

            self._client = anthropic.Anthropic(api_key=self.settings.anthropic_api_key)
        return self._client

    def message(
        self,
        messages: list[dict],
        system: str | None = None,
        tools: list[dict] | None = None,
        max_tokens: int | None = None,
    ) -> LLMResponse:
        if self.settings.provider == "ollama":
            return self._ollama_message(messages, system, max_tokens)
        return self._anthropic_message(messages, system, tools, max_tokens)

    def _anthropic_message(self, messages, system, tools, max_tokens) -> LLMResponse:
        kwargs: dict = {
            "model": self.settings.model,
            "max_tokens": max_tokens or self.settings.max_tokens,
            "messages": messages,
        }
        if system:
            kwargs["system"] = system
        if tools:
            kwargs["tools"] = tools
        resp = self.client.messages.create(**kwargs)

        text_parts: list[str] = []
        tool_calls: list[dict] = []
        for block in resp.content:
            if block.type == "text":
                text_parts.append(block.text)
            elif block.type == "tool_use":
                tool_calls.append({"id": block.id, "name": block.name, "input": block.input})
        return LLMResponse(
            text="\n".join(text_parts).strip(),
            tool_calls=tool_calls,
            stop_reason=resp.stop_reason,
            raw=resp,
        )

    def _ollama_message(self, messages, system, max_tokens) -> LLMResponse:
        try:
            import ollama
        except ImportError as exc:  # pragma: no cover
            raise LLMUnavailable("the 'ollama' package is not installed") from exc
        msgs = ([{"role": "system", "content": system}] if system else []) + list(messages)
        try:
            resp = ollama.Client(host=self.settings.ollama_host).chat(
                model=self.settings.ollama_model,
                messages=msgs,
                options={
                    "temperature": 0.2,
                    "num_predict": max_tokens or self.settings.max_tokens,
                },
            )
        except Exception as exc:
            raise LLMUnavailable(
                f"could not reach local Ollama model '{self.settings.ollama_model}'. "
                f"Is 'ollama serve' running and the model pulled? ({exc})"
            ) from exc
        msg = resp["message"] if isinstance(resp, dict) else resp.message
        content = msg["content"] if isinstance(msg, dict) else msg.content
        return LLMResponse(
            text=(content or "").strip(), tool_calls=[], stop_reason="stop", raw=resp
        )
