package story

import (
	"testing"

	"github.com/cwbudde/AudioVisualizer/internal/audioanalysis"
)

func pcs(classes ...int) [12]float64 {
	var c [12]float64
	for _, pc := range classes {
		c[pc] = 1
	}
	return c
}

func TestChordTemplates(t *testing.T) {
	g := NewGrid(audioanalysis.Rhythm{BPM: 120}, 10)
	key := KeyEstimate{Tonic: 0, Mode: "major"}
	windows := []ChordWindow{
		{Chroma: pcs(0, 4, 7), Bass: pcs(0)},
		{Chroma: pcs(9, 0, 4), Bass: pcs(9)},
		{Chroma: pcs(7, 11, 2, 5), Bass: pcs(7)},
		{Chroma: pcs(0, 4, 7), Bass: pcs(4)},
	}
	for i := range windows {
		windows[i].Start, windows[i].End, windows[i].LevelDB = float64(i), float64(i+1), -20
	}
	chords := DetectChords(windows, key, g, DefaultChordParams())
	want := []string{"C", "Am", "G7", "C/E"}
	if len(chords) != len(want) {
		t.Fatalf("chords %+v", chords)
	}
	for i, c := range chords {
		if c.Symbol != want[i] {
			t.Fatalf("chord %d: %s, want %s (%+v)", i, c.Symbol, want[i], c)
		}
	}
	if chords[3].Root != 0 || chords[3].Bass != 4 || len(chords[2].Voicing) != 4 || chords[2].Voicing[0] != 55 {
		t.Fatalf("root/bass/voicing %+v", chords)
	}
	quiet := DetectChords([]ChordWindow{{Start: 0, End: 1, Chroma: pcs(0, 4, 7), LevelDB: -70}}, key, g, DefaultChordParams())
	if quiet[0].Symbol != "N" {
		t.Fatalf("gated window: %+v", quiet)
	}
}

func TestKeyRecoversAllRotations(t *testing.T) {
	for tonic := range 12 {
		for _, minor := range []bool{false, true} {
			profile := majorProfile
			if minor {
				profile = minorProfile
			}
			var pc [12]float64
			for i := range pc {
				pc[(tonic+i)%12] = profile[i]
			}
			k := EstimateKey(pc, [12]float64{}, 0.05)
			if k.Tonic != tonic || (k.Mode == "minor") != minor || k.RelativeAmbiguous {
				t.Fatalf("tonic %d minor %v: %+v", tonic, minor, k)
			}
		}
	}
}

func TestKeyFromGMajorScale(t *testing.T) {
	var pc [12]float64
	for pitch, w := range map[int]float64{7: 3, 9: 1, 11: 2, 0: 1, 2: 2.5, 4: 1, 6: 1} {
		pc[pitch] = w
	}
	k := EstimateKey(pc, [12]float64{}, 0.05)
	if k.Name != "G major" || k.Sharps() != 1 || k.Relative != "E minor" {
		t.Fatalf("key %+v", k)
	}
}

func TestKeyFlagsRelativeAmbiguity(t *testing.T) {
	var pc [12]float64
	for i := range 12 {
		pc[(7+i)%12] += majorProfile[i]
		pc[(4+i)%12] += minorProfile[i]
	}
	var e, g [12]float64
	e[4], g[7] = 1, 1
	if k := EstimateKey(pc, e, 0.05); !k.RelativeAmbiguous || k.Name != "E minor" || k.RunnerUp != "G major" {
		t.Fatalf("E evidence: %+v", k)
	}
	if k := EstimateKey(pc, g, 0.05); !k.RelativeAmbiguous || k.Name != "G major" {
		t.Fatalf("G evidence: %+v", k)
	}
}
