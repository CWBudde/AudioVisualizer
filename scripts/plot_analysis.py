"""Plot precomputed Go features; this script does no audio signal analysis."""
import json
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
data = json.loads((ROOT / "analysis/features.json").read_text())
tracks = data["tracks"]
duration = tracks["mix"]["source"]["durationSeconds"]
plt.rcParams.update({"figure.facecolor": "#080c18", "axes.facecolor": "#0b1120",
                     "text.color": "#e1e8f5", "axes.labelcolor": "#b8c8da",
                     "xtick.color": "#8ea1be", "ytick.color": "#8ea1be",
                     "axes.edgecolor": "#26334b", "font.size": 10})
fig, axes = plt.subplots(6, 1, figsize=(16, 12), sharex=True,
                         gridspec_kw={"height_ratios": [1, 1, 1, 1, 1, 1.8]})
colors = ["#36e5ff", "#ff3da8", "#8658ff", "#e9ff70", "#eeeeff"]
for ax, name in zip(axes[:5], ["mix", "drums", "bass", "other", "vocals"]):
    track = tracks[name]
    times = np.arange(len(track["rms"])) * .01
    ax.plot(times, 20 * np.log10(np.maximum(track["rms"], 1e-6)),
            color="#8b9db6", linewidth=1.4, label="RMS")
    for band, color in zip(track["bandAmplitudes"], colors):
        ax.plot(times, 20 * np.log10(np.maximum(band, 1e-6)), color=color,
                linewidth=.45, alpha=.8)
    ax.set_ylim(-85, 0)
    ax.set_ylabel(name + "\ndBFS")
    ax.set_yticks([-80, -40, 0])
    ax.grid(axis="y", color="#26334b", linewidth=.5)
    for gap in data["silence"]:
        ax.axvspan(gap["startSeconds"], gap["endSeconds"], color="#ff3da8", alpha=.16)
    for cue in data["cues"]:
        ax.axvline(cue["startSeconds"], color="#596a89", linewidth=.6, alpha=.7)
mix = tracks["mix"]
spectrum = np.asarray(mix["spectrogramDB"]).reshape(-1, data["spectrogramBins"]).T
axes[-1].imshow(spectrum, origin="lower", aspect="auto", cmap="magma", vmin=-75, vmax=-10,
                extent=[0, duration, 0, data["spectrogramBins"]], interpolation="nearest")
rows = np.arange(0, len(data["spectrogramBinHz"]), 8)
axes[-1].set_yticks(rows + .5, [f"{hz:.0f}" if hz < 1000 else f"{hz / 1000:.1f}k"
                                for hz in np.asarray(data["spectrogramBinHz"])[rows]])
axes[-1].set_ylabel("Mix spectrum\nHz (log)")
axes[-1].set_xlabel("Time (seconds)")
axes[-1].set_xlim(0, duration)
axes[-1].set_xticks(np.arange(0, duration, 5))
fig.suptitle(f"PixelParade · {duration:.2f} s · {data['rhythm']['bpm']:.2f} BPM · aligned stem analysis", fontsize=18)
fig.text(.5, .015, "Bands: cyan 25–140 Hz · pink 140–400 Hz · violet 400–2000 Hz · yellow 2–6 kHz · white 6–12 kHz",
         ha="center", fontsize=11)
fig.tight_layout(rect=[0, .035, 1, .97])
fig.savefig(ROOT / "analysis/overview.png", dpi=140)
print("Wrote analysis/overview.png")
