package story

import (
	"fmt"
	"math"
	"sort"

	"github.com/cwbudde/AudioVisualizer/internal/audioanalysis"
	"github.com/cwbudde/AudioVisualizer/internal/smf"
)

// Tick maps seconds to MIDI ticks at the grid tempo. By default MIDI time 0
// is audio time 0, so the file lines up with the WAV in a DAW; gridAligned
// moves the first beat to tick 0 instead.
func (g Grid) Tick(seconds float64, gridAligned bool) int {
	if gridAligned {
		seconds -= g.OriginSeconds
	}
	return int(math.Round(seconds * g.BPM / 60 * smf.PPQ))
}

func velocity(strength float64) int {
	return int(math.Round(40 + 87*math.Min(1, math.Max(0, (strength-0.3)/0.7))))
}

// MIDI renders the story as format-1 tracks: conductor (tempo, meter, key,
// cue/section/leitmotif markers), lead, arp, raw lead, bass, chords, drums
// on channel 10 and one motif lane per leitmotif on channel 16.
func (s *Story) MIDI(drums []audioanalysis.Event, gridAligned bool) []*smf.Track {
	g := s.Grid
	tick := func(t float64) int { return g.Tick(t, gridAligned) }
	conductor := &smf.Track{}
	conductor.Name("PixelParade story")
	conductor.Tempo(0, g.BPM)
	conductor.TimeSignature(0, 4, 4)
	conductor.KeySignature(0, s.Key.Sharps(), s.Key.Mode == "minor")
	for _, c := range s.Cues {
		conductor.Marker(tick(c.Start), "cue "+c.Name)
	}
	for _, sec := range s.Sections {
		conductor.Marker(tick(sec.Start), fmt.Sprintf("section %s (bars %d-%d)", sec.Label, sec.FirstBar, sec.LastBar))
	}
	notes := func(name string, ch, program int) *smf.Track {
		t := &smf.Track{}
		t.Name(name)
		t.Program(0, ch, program)
		return t
	}
	lead, arp, raw := notes("lead (clean)", 0, 80), notes("arp (clean)", 1, 81), notes("lead raw incl. dropped", 2, 80)
	for _, n := range s.Lead.Clean {
		t, ch := lead, 0
		if n.Voice == "arp" {
			t, ch = arp, 1
		}
		t.Note(ch, n.MIDI, velocity(n.Strength), tick(g.SlotTime(n.Slot)), tick(g.SlotTime(n.Slot+n.Slots)))
	}
	for _, n := range s.Lead.Raw {
		raw.Note(2, n.MIDI, velocity(n.Strength), tick(n.Start), tick(n.End))
	}
	bass := notes("bass (clean)", 3, 38)
	for _, n := range s.Bass.Clean {
		bass.Note(3, n.MIDI, velocity(n.Strength), tick(g.SlotTime(n.Slot)), tick(g.SlotTime(n.Slot+n.Slots)))
	}
	chords := notes("chords", 4, 89)
	for _, c := range s.Chords {
		chords.Text(tick(c.Start), c.Symbol)
		for _, key := range c.Voicing {
			chords.Note(4, key, 70, tick(c.Start), tick(c.End))
		}
		if c.Bass != c.Root && c.Bass >= 0 {
			chords.Note(4, 36+c.Bass, 70, tick(c.Start), tick(c.End))
		}
	}
	drumTrack := &smf.Track{}
	drumTrack.Name("drums (onsets)")
	keys := map[string]int{"kick": 36, "snare": 38, "hat": 42}
	p95 := map[string]float64{}
	for kind := range keys {
		v := []float64{}
		for _, d := range drums {
			if d.Kind == kind {
				v = append(v, d.Strength)
			}
		}
		if len(v) > 0 {
			sort.Float64s(v)
			p95[kind] = v[int(0.95*float64(len(v)-1))]
		}
	}
	for _, d := range drums {
		if key, ok := keys[d.Kind]; ok && p95[d.Kind] > 0 {
			on := tick(d.Time)
			drumTrack.Note(9, key, int(math.Round(50+77*math.Min(1, d.Strength/p95[d.Kind]))), on, on+60)
		}
	}
	lanes := &smf.Track{}
	lanes.Name("leitmotif lanes (key 36+rank)")
	for _, m := range s.Motifs {
		if !m.Leitmotif {
			continue
		}
		for _, o := range m.Occurrences {
			label := fmt.Sprintf("%s T%+d %s", m.ID, o.Transposition, o.Variant)
			lanes.Text(tick(o.Start), label)
			conductor.Marker(tick(o.Start), label)
			lanes.Note(15, 36+m.Rank, int(math.Round(40+87*o.Similarity)), tick(o.Start), tick(o.End))
		}
	}
	return []*smf.Track{conductor, lead, arp, raw, bass, chords, drumTrack, lanes}
}
