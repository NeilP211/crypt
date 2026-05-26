"""Command-line entry point for the Crypt agent.

  python -m crypt_agent.cli build-corpus [--limit N] [--csv PATH]
  python -m crypt_agent.cli search "abandoned asylum" [--state Ohio] [-k 5]
  python -m crypt_agent.cli ask "what haunts the lighthouses of the outer banks?"
  python -m crypt_agent.cli eval [--n 120] [--judge-n 60] [--no-judge]
"""

from __future__ import annotations

import argparse
import sys


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="crypt-agent")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_build = sub.add_parser("build-corpus", help="Build corpus.jsonl from Kaggle data")
    p_build.add_argument("--limit", type=int, default=None)
    p_build.add_argument("--csv", type=str, default=None, help="Use a local CSV instead")

    p_search = sub.add_parser("search", help="Hybrid retrieval only (no LLM)")
    p_search.add_argument("query")
    p_search.add_argument("--state", default=None)
    p_search.add_argument("--structure-type", default=None)
    p_search.add_argument("-k", type=int, default=5)

    p_ask = sub.add_parser("ask", help="Full agent answer (needs ANTHROPIC_API_KEY)")
    p_ask.add_argument("question")
    p_ask.add_argument("--max-steps", type=int, default=5)

    p_eval = sub.add_parser("eval", help="Run retrieval + judge evals")
    p_eval.add_argument("--n", type=int, default=120)
    p_eval.add_argument("--judge-n", type=int, default=60)
    p_eval.add_argument("--no-judge", action="store_true")

    args = parser.parse_args(argv)

    if args.cmd == "build-corpus":
        from .corpus import build_corpus

        places = build_corpus(csv_path=args.csv, limit=args.limit)
        print(f"built corpus: {len(places)} places -> data/corpus.jsonl")
        return 0

    if args.cmd == "search":
        from .retrieval import Retriever

        filters = {}
        if args.state:
            filters["state"] = args.state
        if args.structure_type:
            filters["structure_type"] = args.structure_type
        hits = Retriever().search(args.query, k=args.k, filters=filters or None)
        for i, hit in enumerate(hits, 1):
            loc = ", ".join(p for p in (hit.place.city, hit.place.state) if p)
            print(f"{i}. [{hit.place.id}] {hit.place.name} ({loc}) "
                  f"rerank={hit.rerank_score:.3f}")
            print(f"   {hit.place.description[:160]}")
        return 0

    if args.cmd == "ask":
        from .agent import CryptAgent
        from .llm import LLMUnavailable

        try:
            result = CryptAgent().answer(args.question, max_steps=args.max_steps)
        except LLMUnavailable as exc:
            print(f"error: {exc}", file=sys.stderr)
            return 2
        print(result.answer)
        print(f"\n[steps={result.steps} cited={result.cited_ids} grounded={result.grounded}]")
        return 0

    if args.cmd == "eval":
        from .evals.run_evals import main as run

        run(n=args.n, judge_n=args.judge_n, run_judge=not args.no_judge)
        return 0

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
