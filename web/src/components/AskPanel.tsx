"use client";

import { useState } from "react";

import { agentApi, agentPlaceToLocation, ApiError } from "@/lib/api";
import { spookyAudio } from "@/lib/audio";
import type { ScoredLocation } from "@/lib/types";

/**
 * "Ask the Crypt": a question box wired to the RAG agent service. The agent's
 * cited places are handed up via `onCited` so they render in the result list
 * and as pins on the map, exactly like a photo search.
 */
export function AskPanel({
  onCited,
}: {
  onCited: (places: ScoredLocation[]) => void;
}) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    setNote(null);
    setAnswer(null);
    try {
      const res = await agentApi.ask(q);
      setAnswer(res.answer);
      onCited(res.cited.map(agentPlaceToLocation));
      spookyAudio.playEffect("creak");
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) {
        setNote(
          "The Ask agent needs an Anthropic API key on the server. Photo search and the map still work without it.",
        );
      } else {
        setNote(err instanceof ApiError ? err.message : "ask failed");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded border border-ink-700 bg-ink-900 p-3"
    >
      <h2 className="font-display text-sm text-teal-bright">Ask the Crypt</h2>
      <p className="mb-2 mt-0.5 text-xs text-bone-400">
        Ask a question; the agent searches the lore and answers with cited
        places pinned on the map.
      </p>
      <div className="flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="what haunts the lighthouses of the Great Lakes?"
          className="min-w-0 flex-1 rounded border border-ink-700 bg-ink-950 px-2 py-1.5 text-sm text-bone-200 placeholder:text-bone-400/60 focus:border-teal focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy}
          className="shrink-0 rounded border border-teal bg-teal/10 px-3 py-1.5 text-sm text-teal-bright transition hover:bg-teal/20 disabled:opacity-50"
        >
          {busy ? "..." : "Ask"}
        </button>
      </div>
      {note && <p className="mt-2 text-xs text-crimson">{note}</p>}
      {answer && (
        <div className="mt-2 max-h-52 overflow-y-auto whitespace-pre-wrap rounded border border-ink-700 bg-ink-950 p-2 text-sm leading-relaxed text-bone-200">
          {answer}
        </div>
      )}
    </form>
  );
}
