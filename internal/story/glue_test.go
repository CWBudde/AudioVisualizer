package story

import (
	"math"
	"reflect"
	"slices"
	"testing"

	"github.com/cwbudde/AudioVisualizer/internal/audioanalysis"
	"github.com/cwbudde/algo-dsp/measure/music/features"
	"github.com/cwbudde/algo-dsp/measure/music/harmony"
	"github.com/cwbudde/algo-dsp/measure/music/melody"
	"github.com/cwbudde/algo-dsp/measure/music/motif"
)

// testGrid is 120 BPM from time 0: beats of 0.5 s, sixteenths of 0.125 s,
// bars of 2 s.
func testGrid(t *testing.T, duration float64) Grid {
	t.Helper()
	g, err := NewGrid(audioanalysis.Rhythm{BPM: 120}, duration)
	if err != nil {
		t.Fatal(err)
	}
	return g
}

func TestBoundariesNearestCue(t *testing.T) {
	g := testGrid(t, 10)
	novelty := make([]float64, 20)
	novelty[8] = 1 // beat 8 at 4 s, bar position 2
	for _, tc := range []struct {
		name  string
		cues  []audioanalysis.Cue
		cue   string
		delta float64
	}{
		{"no cues", nil, "", math.Inf(1)},
		{"nearest before", []audioanalysis.Cue{{Name: "a", Start: 0}, {Name: "b", Start: 3.9}, {Name: "c", Start: 6}}, "b", 0.1},
		{"nearest after", []audioanalysis.Cue{{Name: "a", Start: 0}, {Name: "b", Start: 4.25}}, "b", -0.25},
	} {
		got, err := boundaries(novelty, g, tc.cues, 4, 1)
		if err != nil {
			t.Fatal(err)
		}
		want := []Boundary{{Time: 4, Beat: 8, BarPosition: 2, Novelty: 1, NearestCue: tc.cue, CueDelta: tc.delta}}
		if !slices.Equal(got, want) {
			t.Fatalf("%s: %+v, want %+v", tc.name, got, want)
		}
	}
}

func TestCleanNotesDropReasonsByRawIndex(t *testing.T) {
	in := []audioanalysis.Note{
		{Start: 0.0000004, End: 0.5, MIDI: 60, Strength: 0.90049}, // kept; rounded to 1 µs and 0.001
		{Start: 0.5, End: 0.75, MIDI: 50, Strength: 0.9},          // at or below the lead floor (52)
		{Start: 1, End: 1.25, MIDI: 64, Strength: 0.2},            // below the minimum strength
		{Start: 1.5, End: 1.6, MIDI: 62, Strength: 0.5},           // loses slot 12 to the next note
		{Start: 1.51, End: 1.76, MIDI: 65, Strength: 0.8},
	}
	clean, raw, err := CleanNotes(in, testGrid(t, 4), LeadCleanParams())
	if err != nil {
		t.Fatal(err)
	}
	reasons := []melody.DropReason{}
	for _, r := range raw {
		reasons = append(reasons, r.Dropped)
	}
	if want := []melody.DropReason{"", "floor", "weak", "duplicate", ""}; !slices.Equal(reasons, want) {
		t.Fatalf("drop reasons %v, want %v", reasons, want)
	}
	if raw[0].Start != 0 || raw[0].Strength != 0.9 || raw[4].Start != 1.51 {
		t.Fatalf("raw notes not rounded as Clean sees them: %+v", raw)
	}
	if len(clean) != 2 || clean[0].RawIndex != 0 || clean[1].RawIndex != 4 || clean[1].Slot != 12 {
		t.Fatalf("clean notes %+v", clean)
	}
}

func TestRolesStemActivity(t *testing.T) {
	g := testGrid(t, 8) // four bars of 200 frames
	level := func(bars ...float64) []float64 {
		out := []float64{}
		for _, v := range bars {
			for range 200 {
				out = append(out, v)
			}
		}
		return out
	}
	series := map[string][]float64{
		"drums": level(0.1, 0.1, 0.1, 0.1),
		"bass":  level(0.1, 0.1, 0.001, 0.001), // -20 dB reference; -60 dB bars are below -32 dB
		"other": level(0.1, 0.1, 0.1, 0.1),
		// A fully silent stem is inactive in every bar. The pre-library code
		// compared the -120 dB bar level with a -120 dB reference (no frame
		// above the gate) and marked it active everywhere; every PixelParade
		// stem has frames above the gate, so the difference never triggers.
		"vocals": level(0, 0, 0, 0),
	}
	active, err := levels(series, g.barSpans(), features.WithActivityThreshold(DefaultParams().RoleActiveDB))
	if err != nil {
		t.Fatal(err)
	}
	got := map[string][]bool{}
	for _, r := range Roles(active, g, nil, nil, nil) {
		got[r.Name] = r.BarActivity
	}
	for name, want := range map[string][]bool{
		"drums":  {true, true, true, true},
		"bass":   {true, true, false, false},
		"lead":   {false, false, false, false}, // no lead notes
		"vocals": {false, false, false, false},
	} {
		if !slices.Equal(got[name], want) {
			t.Fatalf("%s activity %v, want %v", name, got[name], want)
		}
	}
	if db := active["bass"].SpanDB; math.Round(db[0]) != -20 || math.Round(db[2]) != -60 {
		t.Fatalf("bass bar levels %v", db)
	}
}

// TestConvertedShapesMirrorLibrary guards the struct conversions between
// story types and library types: they rely on identical field names, types
// and order (the compiler checks types and order, this names the mismatch).
func TestConvertedShapesMirrorLibrary(t *testing.T) {
	for _, pair := range [][2]any{
		{StoryNote{}, melody.CleanNote{}},
		{audioanalysis.Note{}, melody.Note{}},
		{MotifOccurrence{}, motif.Occurrence{}},
		{SalienceTerms{}, motif.SalienceTerms{}},
		{harmony.Span{}, features.Interval{}},
	} {
		a, b := reflect.TypeOf(pair[0]), reflect.TypeOf(pair[1])
		if a.NumField() != b.NumField() {
			t.Fatalf("%v has %d fields, %v has %d", a, a.NumField(), b, b.NumField())
		}
		for i := range a.NumField() {
			fa, fb := a.Field(i), b.Field(i)
			if fa.Name != fb.Name || fa.Type != fb.Type {
				t.Fatalf("%v field %d is %s %v, %v has %s %v", a, i, fa.Name, fa.Type, b, fb.Name, fb.Type)
			}
		}
	}
}
