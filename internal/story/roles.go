package story

import (
	"fmt"
	"math"
	"sort"

	"github.com/cwbudde/AudioVisualizer/internal/audioanalysis"
)

type Role struct {
	Name        string `json:"name"`
	Role        string `json:"role"`
	BarActivity []bool `json:"barActivity"`
	MIDIRange   []int  `json:"midiRange,omitempty"`
	Evidence    string `json:"evidence"`
}

// barLevelDB is the RMS (power mean) of a track over a bar, in dBFS.
func barLevelDB(t *audioanalysis.Track, g Grid, bar int) float64 {
	lo, hi := g.frames(g.BarStart(bar), g.BarStart(bar+1), len(t.RMS))
	sum := 0.0
	for i := lo; i < hi; i++ {
		sum += t.RMS[i] * t.RMS[i]
	}
	if hi <= lo {
		return audioanalysis.DB(0)
	}
	return audioanalysis.DB(math.Sqrt(sum / float64(hi-lo)))
}

// p95DB is the 95th percentile frame level of a track above the -80 dBFS gate.
func p95DB(t *audioanalysis.Track) float64 {
	v := []float64{}
	for _, x := range t.RMS {
		if x > audioanalysis.Gate {
			v = append(v, x)
		}
	}
	if len(v) == 0 {
		return audioanalysis.DB(0)
	}
	sort.Float64s(v)
	return audioanalysis.DB(v[int(0.95*float64(len(v)-1))])
}

func midiRange(notes []StoryNote, voice string) []int {
	lo, hi := math.MaxInt, math.MinInt
	for _, n := range notes {
		if voice == "" || n.Voice == voice {
			lo, hi = min(lo, n.MIDI), max(hi, n.MIDI)
		}
	}
	if lo > hi {
		return nil
	}
	return []int{lo, hi}
}

// Roles marks a stem active in a bar when its bar level is within activeDB of
// the stem's 95th percentile frame level; the lead and arp voices also need
// notes of their voice in the bar.
func Roles(a *audioanalysis.Analysis, g Grid, lead, bass []StoryNote, chords []Chord, activeDB float64) []Role {
	active := func(name string) []bool {
		t := a.Tracks[name]
		ref := p95DB(t)
		out := make([]bool, g.Bars())
		for b := range out {
			out[b] = barLevelDB(t, g, b) > ref+activeDB
		}
		return out
	}
	withNotes := func(on []bool, voice string) []bool {
		out := make([]bool, len(on))
		for _, n := range lead {
			if b := g.Bar(g.SlotTime(n.Slot)); n.Voice == voice && b < len(out) {
				out[b] = on[b]
			}
		}
		return out
	}
	other := active("other")
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
		{"drums", "rhythm", active("drums"), nil, "drum stem; kick/snare/hat onsets drive the grid"},
		{"bass", "root", active("bass"), midiRange(bass, ""), bassEvidence},
		{"lead", "theme", withNotes(other, "lead"), midiRange(lead, "lead"), "other stem, notes outside short 16th runs"},
		{"arp", "ostinato", withNotes(other, "arp"), midiRange(lead, "arp"), "other stem, runs of short 16th notes (bar-periodic arpeggio)"},
		{"vocals", "texture/leakage", active("vocals"), nil, "vocal stem is far quieter than the mix; no lyrics, likely synth leakage"},
	}
}
