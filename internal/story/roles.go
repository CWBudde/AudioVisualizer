package story

import (
	"fmt"
	"math"

	"github.com/cwbudde/algo-dsp/measure/music/features"
)

type Role struct {
	Name        string `json:"name"`
	Role        string `json:"role"`
	BarActivity []bool `json:"barActivity"`
	MIDIRange   []int  `json:"midiRange,omitempty"`
	Evidence    string `json:"evidence"`
}

func midiRange(notes []StoryNote, voice string) []int {
	lo, hi := math.MaxInt, math.MinInt
	for _, n := range notes {
		if voice == "" || string(n.Voice) == voice {
			lo, hi = min(lo, n.MIDI), max(hi, n.MIDI)
		}
	}
	if lo > hi {
		return nil
	}
	return []int{lo, hi}
}

// Roles takes the per-bar stem activity of features.Activity (a stem is
// active in a bar when its bar level is within the threshold of its 95th
// percentile frame level); the lead and arp voices also need notes of their
// voice in the bar.
func Roles(active map[string]features.TrackActivity, g Grid, lead, bass []StoryNote, chords []Chord) []Role {
	withNotes := func(on []bool, voice string) []bool {
		out := make([]bool, len(on))
		for _, n := range lead {
			if b := g.Bar(g.SlotTime(n.Slot)); string(n.Voice) == voice && b < len(out) {
				out[b] = on[b]
			}
		}
		return out
	}
	other := active["other"].Active
	rootHits, voiced := 0, 0
	for _, c := range chords {
		if c.Root < 0 {
			continue
		}
		weight := map[int]float64{}
		for _, n := range bass {
			if o := math.Min(n.End, c.End) - math.Max(n.Start, c.Start); o > 0 {
				weight[n.MIDI%12] += o
			}
		}
		if len(weight) == 0 {
			continue
		}
		best := -1
		for pc := range 12 {
			if best < 0 || weight[pc] > weight[best] {
				best = pc
			}
		}
		voiced++
		if best == c.Root {
			rootHits++
		}
	}
	bassEvidence := "no chords with bass notes"
	if voiced > 0 {
		bassEvidence = fmt.Sprintf("dominant bass pitch class equals the chord root in %d of %d chord spans (%.0f%%)", rootHits, voiced, 100*float64(rootHits)/float64(voiced))
	}
	return []Role{
		{"drums", "rhythm", active["drums"].Active, nil, "drum stem; kick/snare/hat onsets drive the grid"},
		{"bass", "root", active["bass"].Active, midiRange(bass, ""), bassEvidence},
		{"lead", "theme", withNotes(other, "lead"), midiRange(lead, "lead"), "other stem, notes outside short 16th runs"},
		{"arp", "ostinato", withNotes(other, "arp"), midiRange(lead, "arp"), "other stem, runs of short 16th notes (bar-periodic arpeggio)"},
		{"vocals", "texture/leakage", active["vocals"].Active, nil, "vocal stem is far quieter than the mix; no lyrics, likely synth leakage"},
	}
}
