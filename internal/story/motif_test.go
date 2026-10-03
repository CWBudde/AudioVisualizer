package story

import (
	"math/rand"
	"slices"
	"testing"

	"github.com/cwbudde/AudioVisualizer/internal/audioanalysis"
)

// motifSong places a 5-note motif (intervals +4 +3 -2 +5, IOIs 2 2 4 2) at
// bar 0, bar 4 (+2) and bar 9 (+5, last interval varied) among seeded random
// filler notes. shift moves one note of the second statement by an octave.
func motifSong(shift int) ([]StoryNote, Grid) {
	g := NewGrid(audioanalysis.Rhythm{BPM: 120}, 40)
	rng := rand.New(rand.NewSource(7))
	type statement struct {
		bar, base int
		last      int
	}
	statements := []statement{{0, 60, 5}, {4, 62, 5}, {9, 65, 6}}
	notes := []StoryNote{}
	add := func(slot, midi int) {
		notes = append(notes, StoryNote{Start: g.SlotTime(slot), End: g.SlotTime(slot + 1), Slot: slot, Slots: 1, MIDI: midi, RawMIDI: midi, Strength: 0.7, Voice: "lead"})
	}
	at := func(bar int) int { return slices.IndexFunc(statements, func(s statement) bool { return s.bar == bar }) }
	for bar := range 14 {
		// Statements are separated from the filler by more than MaxGapSlots.
		slot, end := 16*bar, 16*(bar+1)
		if at(bar+1) >= 0 {
			end -= 6
		}
		if i := at(bar); i >= 0 {
			s := statements[i]
			pitch := []int{s.base, s.base + 4, s.base + 7, s.base + 5, s.base + 5 + s.last}
			if i == 1 {
				pitch[2] += shift
			}
			for k, at := range []int{0, 2, 4, 8, 10} {
				add(slot+at, pitch[k])
			}
			continue
		}
		for slot < end {
			add(slot, 55+rng.Intn(21))
			slot += 1 + rng.Intn(3)
		}
	}
	return notes, g
}

func ngramParams() MotifParams {
	p := DefaultMotifParams()
	p.GridWindows, p.Lengths = nil, []int{8, 6, 5, 4}
	return p
}

func TestNoteMotifRecursTransposedAndVaried(t *testing.T) {
	notes, g := motifSong(0)
	motifs := FindNoteMotifs(notes, g, "lead", ngramParams())
	if len(motifs) != 1 {
		t.Fatalf("expected one motif, got %d: %+v", len(motifs), motifs)
	}
	m := motifs[0]
	if len(m.Occurrences) != 3 || len(m.Intervals) != 4 {
		t.Fatalf("motif %+v", m)
	}
	for i, want := range []struct {
		bar, t  int
		variant string
	}{{0, 0, ""}, {4, 2, "transposed"}, {9, 5, "transposed+varied"}} {
		o := m.Occurrences[i]
		if o.Bar != want.bar || o.Transposition != want.t || (want.variant != "" && o.Variant != want.variant) {
			t.Fatalf("occurrence %d: %+v, want %+v", i, o, want)
		}
	}
}

func TestNoteMotifToleratesOctaveError(t *testing.T) {
	notes, g := motifSong(12)
	motifs := FindNoteMotifs(notes, g, "lead", ngramParams())
	if len(motifs) != 1 || len(motifs[0].Occurrences) != 3 || motifs[0].Occurrences[1].Transposition != 2 {
		t.Fatalf("octave-displaced statement not matched: %+v", motifs)
	}
}

func TestChromaMotifFindsTransposition(t *testing.T) {
	g := NewGrid(audioanalysis.Rhythm{BPM: 120}, 30)
	rng := rand.New(rand.NewSource(3))
	beats := make([][12]float64, 48)
	for i := range beats {
		beats[i][rng.Intn(12)] = 1
	}
	pattern := [][]int{{0, 4, 7}, {5, 9, 0}, {7, 11, 2}, {0, 4, 7}}
	for _, at := range []struct{ beat, t int }{{0, 0}, {16, 3}, {32, 0}} {
		for k, chord := range pattern {
			beats[at.beat+k] = [12]float64{}
			for _, pc := range chord {
				beats[at.beat+k][(pc+at.t)%12] = 1
			}
		}
	}
	p := DefaultMotifParams()
	p.ChromaWindowBeats = []int{4}
	motifs := FindChromaMotifs(beats, g, p)
	if len(motifs) == 0 {
		t.Fatal("no chroma motif")
	}
	got := []int{}
	for _, o := range motifs[0].Occurrences {
		got = append(got, o.Transposition)
	}
	if !slices.Equal(got, []int{0, 3, 0}) || motifs[0].Occurrences[1].Start != g.BeatStart(16) {
		t.Fatalf("occurrences %+v", motifs[0].Occurrences)
	}
}

func TestOstinatoRanksBelowCrossSectionTheme(t *testing.T) {
	g := NewGrid(audioanalysis.Rhythm{BPM: 120}, 80)
	notes := []StoryNote{}
	occurrence := func(bar int) MotifOccurrence {
		o := MotifOccurrence{Start: g.BarStart(bar), End: g.BarStart(bar) + 1, Bar: bar, Similarity: 0.9}
		for k := range 4 {
			o.NoteIndices = append(o.NoteIndices, len(notes))
			notes = append(notes, StoryNote{Strength: 0.7, MIDI: 60 + 2*k})
		}
		return o
	}
	ostinato := Motif{Source: "lead", Intervals: []int{2, 3, -1}, SpanBeats: 4}
	for bar := 2; bar < 8; bar++ {
		ostinato.Occurrences = append(ostinato.Occurrences, occurrence(bar))
	}
	theme := Motif{Source: "lead", Intervals: []int{4, -2, 5}, SpanBeats: 4}
	for _, bar := range []int{1, 12, 30} {
		theme.Occurrences = append(theme.Occurrences, occurrence(bar))
	}
	sections := []Span{{"intro", 0, 20}, {"verse", 20, 50}, {"outro", 50, 80}}
	energy := func(t0, t1 float64) float64 { return 0.8 }
	p := DefaultMotifParams()
	Score(&ostinato, notes, sections, energy, g, p)
	Score(&theme, notes, sections, energy, g, p)
	if ostinato.Role != "ostinato" || theme.Role != "theme" {
		t.Fatalf("roles %s %s", ostinato.Role, theme.Role)
	}
	ranked := Rank([]Motif{ostinato, theme}, p)
	if ranked[0].Role != "theme" || ranked[0].ID != "M1" || ranked[0].Rank != 1 || ranked[1].Rank != 2 || !ranked[1].Leitmotif {
		t.Fatalf("ranking %+v", ranked)
	}
}

func TestGridMotifToleratesDroppedNotesAndOctaves(t *testing.T) {
	g := NewGrid(audioanalysis.Rhythm{BPM: 120}, 40)
	rng := rand.New(rand.NewSource(5))
	pattern := []int{79, 74, 67, 78, 74, 67, 69, 71, 69, 67, 64, 67, 67, 71, 74, 79}
	notes := []StoryNote{}
	for bar := range 8 {
		for k, midi := range pattern {
			slot := 16*bar + k
			if bar >= 3 && bar != 6 {
				midi = 55 + rng.Intn(24)
			} else if k == (bar*5)%16 {
				continue // dropped by the tracker
			} else if k == 3 && bar == 1 {
				midi -= 12 // octave error
			}
			notes = append(notes, StoryNote{Start: g.SlotTime(slot), End: g.SlotTime(slot + 1), Slot: slot, Slots: 1, MIDI: midi, Strength: 0.6})
		}
	}
	p := DefaultMotifParams()
	p.Lengths = nil
	motifs := FindNoteMotifs(notes, g, "lead", p)
	if len(motifs) == 0 {
		t.Fatal("no grid motif")
	}
	bars := []int{}
	for _, o := range motifs[0].Occurrences {
		bars = append(bars, o.Bar)
		if o.Transposition != 0 || o.Slot%16 != 0 {
			t.Fatalf("occurrence %+v", o)
		}
	}
	if !slices.Equal(bars, []int{0, 1, 2, 6}) || motifs[0].SpanBeats != 4 {
		t.Fatalf("bars %v span %v", bars, motifs[0].SpanBeats)
	}
	Score(&motifs[0], notes, nil, func(t0, t1 float64) float64 { return 1 }, g, p)
	if motifs[0].Role != "ostinato" {
		t.Fatalf("role %s", motifs[0].Role)
	}
}
