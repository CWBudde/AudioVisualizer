// Package story derives a musical skeleton from the stored feature analysis:
// a sixteenth grid, cleaned notes, key and chords, self-similarity structure,
// recurring motifs and instrument roles.
package story

import (
	"math"

	"github.com/cwbudde/AudioVisualizer/internal/audioanalysis"
)

// Grid is the constant-tempo beat grid. Sixteenth slots count from the first
// beat; bars count from the downbeat (bar 0 may be a pickup when the
// downbeat index is not a multiple of four).
type Grid struct {
	BPM              float64   `json:"bpm"`
	OriginSeconds    float64   `json:"originSeconds"`
	BeatSeconds      float64   `json:"beatSeconds"`
	SixteenthSeconds float64   `json:"sixteenthSeconds"`
	BarSeconds       float64   `json:"barSeconds"`
	BeatsPerBar      int       `json:"beatsPerBar"`
	Downbeat         int       `json:"downbeatBeatIndex"`
	Duration         float64   `json:"durationSeconds"`
	Beats            []float64 `json:"beatsSeconds"`
	BarStarts        []float64 `json:"barStartsSeconds"`
	barOrigin        float64
}

// frameRate is the feature frame rate of features.json (frame i at i/frameRate).
const frameRate = float64(audioanalysis.SampleRate) / audioanalysis.Hop

func NewGrid(r audioanalysis.Rhythm, duration float64) Grid {
	beat := 60 / r.BPM
	g := Grid{BPM: r.BPM, OriginSeconds: r.BeatOrigin, BeatSeconds: beat, SixteenthSeconds: beat / 4, BarSeconds: 4 * beat, BeatsPerBar: 4, Downbeat: r.Downbeat, Duration: duration}
	g.barOrigin = g.OriginSeconds + float64(r.Downbeat%4)*beat
	if r.Downbeat%4 != 0 {
		g.barOrigin -= g.BarSeconds
	}
	g.Beats = append([]float64(nil), r.Beats...)
	for i := 0; len(r.Beats) == 0 && g.BeatStart(i) < duration; i++ {
		g.Beats = append(g.Beats, g.BeatStart(i))
	}
	for i := 0; g.BarStart(i) < duration; i++ {
		g.BarStarts = append(g.BarStarts, g.BarStart(i))
	}
	return g
}

func (g Grid) Slot(t float64) int            { return int(math.Round((t - g.OriginSeconds) / g.SixteenthSeconds)) }
func (g Grid) SlotTime(slot int) float64     { return g.OriginSeconds + float64(slot)*g.SixteenthSeconds }
func (g Grid) Bar(t float64) int             { return max(0, int(math.Floor((t-g.barOrigin)/g.BarSeconds+1e-9))) }
func (g Grid) Bars() int                     { return len(g.BarStarts) }
func (g Grid) BarStart(n int) float64        { return g.barOrigin + float64(n)*g.BarSeconds }
func (g Grid) BeatStart(n int) float64       { return g.OriginSeconds + float64(n)*g.BeatSeconds }
func (g Grid) BarPosition(t float64) float64 { return (t - g.barOrigin) / g.BarSeconds }

// frames maps [start, end) seconds to feature frame indices clamped to n.
func (g Grid) frames(start, end float64, n int) (int, int) {
	lo := min(n, max(0, int(math.Ceil(start*frameRate))))
	return lo, min(n, max(lo, int(math.Ceil(end*frameRate))))
}

func r6(v float64) float64 { return math.Round(v*1e6) / 1e6 }
func r3(v float64) float64 { return math.Round(v*1e3) / 1e3 }
