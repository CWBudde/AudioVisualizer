package story

import (
	"math"
	"testing"

	"github.com/cwbudde/AudioVisualizer/internal/audioanalysis"
)

func testGrid() Grid { return NewGrid(audioanalysis.Rhythm{BPM: 105, BeatOrigin: 0.038}, 30) }

func note(g Grid, slot, slots, midi int, jitter float64) audioanalysis.Note {
	start := g.SlotTime(slot) + jitter
	return audioanalysis.Note{Start: start, End: g.SlotTime(slot+slots) - 0.01, MIDI: midi, Strength: 0.6}
}

func TestCleanSnapsJitterToSixteenths(t *testing.T) {
	g := testGrid()
	clean, _ := CleanNotes([]audioanalysis.Note{note(g, 4, 2, 67, 0.03), note(g, 8, 2, 69, -0.06)}, g, LeadCleanParams())
	if len(clean) != 2 || clean[0].Slot != 4 || clean[1].Slot != 8 {
		t.Fatalf("slots %+v", clean)
	}
	if math.Abs(clean[0].OffsetMS-30) > 0.01 || clean[0].OffGrid || !clean[1].OffGrid {
		t.Fatalf("grid offsets %+v", clean)
	}
}

func TestCleanDropsFloorAndDuplicates(t *testing.T) {
	g := testGrid()
	weak := note(g, 0, 1, 64, 0.01)
	weak.Strength = 0.4
	clean, raw := CleanNotes([]audioanalysis.Note{note(g, 0, 2, 67, 0), weak, note(g, 2, 1, 52, 0), note(g, 3, 1, 69, 0)}, g, LeadCleanParams())
	if len(clean) != 2 || clean[0].MIDI != 67 || clean[1].MIDI != 69 {
		t.Fatalf("clean %+v", clean)
	}
	if raw[1].Dropped != "duplicate" || raw[2].Dropped != "floor" || raw[0].Dropped != "" {
		t.Fatalf("raw %+v", raw)
	}
	if clean[0].Slots != 2 || clean[0].End > g.SlotTime(3) {
		t.Fatalf("overlap not trimmed: %+v", clean[0])
	}
}

func TestCleanFoldsLoneOctaveSpike(t *testing.T) {
	g := testGrid()
	in := []audioanalysis.Note{}
	for i, m := range []int{60, 62, 64, 76, 65, 67} {
		in = append(in, note(g, 2*i, 1, m, 0))
	}
	clean, _ := CleanNotes(in, g, LeadCleanParams())
	if clean[3].MIDI != 64 || clean[3].RawMIDI != 76 || clean[3].OctaveShift != -12 {
		t.Fatalf("spike not folded: %+v", clean[3])
	}
	for i, n := range clean {
		if i != 3 && n.OctaveShift != 0 {
			t.Fatalf("note %d shifted: %+v", i, n)
		}
	}
}

func TestCleanSplitsArpFromLead(t *testing.T) {
	g := testGrid()
	in := []audioanalysis.Note{}
	for i := range 5 {
		in = append(in, note(g, i, 1, 67+i, 0))
	}
	in = append(in, note(g, 8, 8, 72, 0), note(g, 20, 1, 67, 0), note(g, 21, 1, 69, 0))
	clean, _ := CleanNotes(in, g, LeadCleanParams())
	for i, want := range []string{"arp", "arp", "arp", "arp", "arp", "lead", "lead", "lead"} {
		if clean[i].Voice != want {
			t.Fatalf("note %d voice %s, want %s: %+v", i, clean[i].Voice, want, clean)
		}
	}
}
