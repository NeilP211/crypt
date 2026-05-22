"""Render the HNSW benchmark figure used in the README.

Numbers are the measured results from REPORT.md (Crypt) and
FAISS_COMPARISON.md (FAISS). Run:

    python benchmarks/plot_report.py

Writes docs/images/hnsw-benchmark.png.
"""

from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

# Brand palette (from web/tailwind.config.ts).
INK = "#0a090b"
INK_PANEL = "#121013"
TEAL = "#36b39a"
TEAL_BRIGHT = "#54d4ba"
CRIMSON = "#bf2f43"
GOLD = "#e6b84e"
BONE = "#cfc8ba"
BONE_DIM = "#9a9285"

# Crypt HNSW, from REPORT.md.
EF = [16, 32, 64, 128, 256, 512]
RECALL = [65.54, 72.49, 78.58, 85.58, 92.60, 97.23]
P99_MS = [0.432, 0.566, 0.838, 1.454, 2.632, 4.879]

# Crypt vs FAISS recall@10, from FAISS_COMPARISON.md.
EF_CMP = ["64", "128", "256", "512"]
CRYPT_CMP = [78.6, 85.6, 92.6, 97.2]
FAISS_CMP = [81.6, 88.8, 95.1, 98.4]

P99_TARGET_MS = 20.0


def style_axes(ax):
    ax.set_facecolor(INK_PANEL)
    for spine in ax.spines.values():
        spine.set_color("#2a262b")
    ax.tick_params(colors=BONE_DIM, labelsize=9)
    ax.grid(True, color="#221f24", linewidth=0.8)
    ax.set_axisbelow(True)


def main():
    plt.rcParams.update(
        {
            "font.family": "DejaVu Sans",
            "text.color": BONE,
            "axes.labelcolor": BONE,
            "figure.facecolor": INK,
        }
    )
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11.5, 4.6))
    fig.suptitle(
        "From-scratch HNSW: recall within 1.2 pp of FAISS, P99 4.9 ms at 100k vectors",
        color=GOLD,
        fontsize=13,
        fontweight="bold",
        y=0.99,
    )

    # Panel 1: recall vs P99 latency, with the 20 ms budget far to the right.
    style_axes(ax1)
    ax1.plot(P99_MS, RECALL, color=TEAL, linewidth=2, zorder=3)
    ax1.scatter(P99_MS, RECALL, color=TEAL_BRIGHT, s=36, zorder=4, edgecolor=INK)
    for x, y, ef in zip(P99_MS, RECALL, EF):
        ax1.annotate(
            f"ef={ef}",
            (x, y),
            textcoords="offset points",
            xytext=(6, -11),
            color=BONE_DIM,
            fontsize=8,
        )
    # Highlight the high-recall operating point.
    ax1.scatter([P99_MS[-1]], [RECALL[-1]], color=GOLD, s=130, marker="*", zorder=5, edgecolor=INK)
    ax1.annotate(
        "97.2% recall\n4.9 ms P99",
        (P99_MS[-1], RECALL[-1]),
        textcoords="offset points",
        xytext=(-4, 12),
        color=GOLD,
        fontsize=9,
        fontweight="bold",
        ha="right",
    )
    ax1.axvline(P99_TARGET_MS, color=CRIMSON, linestyle="--", linewidth=1.4)
    ax1.text(
        P99_TARGET_MS - 0.5,
        70,
        "20 ms P99 budget",
        color=CRIMSON,
        fontsize=9,
        rotation=90,
        va="center",
        ha="right",
    )
    ax1.set_xlim(0, 21)
    ax1.set_ylim(60, 100)
    ax1.set_xlabel("P99 query latency (ms)")
    ax1.set_ylabel("Recall@10 vs exact kNN (%)")
    ax1.set_title("Recall vs latency frontier", color=BONE, fontsize=10, pad=8)

    # Panel 2: Crypt vs FAISS recall at matched parameters.
    style_axes(ax2)
    x = range(len(EF_CMP))
    width = 0.38
    ax2.bar([i - width / 2 for i in x], CRYPT_CMP, width, label="Crypt HNSW", color=TEAL)
    ax2.bar([i + width / 2 for i in x], FAISS_CMP, width, label="FAISS HNSW", color=GOLD)
    for i, (c, f) in enumerate(zip(CRYPT_CMP, FAISS_CMP)):
        ax2.text(i - width / 2, c + 0.5, f"{c:.1f}", color=BONE, fontsize=8, ha="center")
        ax2.text(i + width / 2, f + 0.5, f"{f:.1f}", color=BONE, fontsize=8, ha="center")
    ax2.annotate(
        "within 1.2 pp",
        (len(EF_CMP) - 1, 98.4),
        textcoords="offset points",
        xytext=(0, 16),
        color=GOLD,
        fontsize=9,
        fontweight="bold",
        ha="center",
    )
    ax2.set_xticks(list(x))
    ax2.set_xticklabels([f"ef={e}" for e in EF_CMP])
    ax2.set_ylim(70, 104)
    ax2.set_ylabel("Recall@10 vs exact kNN (%)")
    ax2.set_title("Crypt vs FAISS at matched parameters", color=BONE, fontsize=10, pad=8)
    legend = ax2.legend(facecolor=INK_PANEL, edgecolor="#2a262b", fontsize=9, loc="lower right")
    for text in legend.get_texts():
        text.set_color(BONE)

    fig.tight_layout(rect=[0, 0, 1, 0.96])
    out = Path(__file__).resolve().parents[1] / "docs" / "images" / "hnsw-benchmark.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out, dpi=160, facecolor=INK)
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
