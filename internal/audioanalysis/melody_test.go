package audioanalysis

import (
	"math"
	"sort"
	"testing"
)

type synthNote struct {
	start, end float64
	midi       int
}

func midiHz(m float64) float64 { return 440 * math.Pow(2, (m-69)/12) }

// addHarmonicNote writes a 6-harmonic tone with 5 ms fades, like a plain synth lead.
func addHarmonicNote(x []float64, n synthNote) {
	f0 := midiHz(float64(n.midi))
	fade := 0.005 * SampleRate
	start, end := int(n.start*SampleRate), int(n.end*SampleRate)
	for i := start; i < end && i < len(x); i++ {
		env := math.Min(1, math.Min(float64(i-start)/fade, float64(end-i)/fade))
		time := float64(i-start) / SampleRate
		for h := 1; h <= 6; h++ {
			x[i] += env * 0.3 / float64(h) * math.Sin(2*math.Pi*f0*float64(h)*time)
		}
	}
}

func TestMelodyRecoversNoteSequence(t *testing.T) {
	notes := []synthNote{{0.20, 0.45, 60}, {0.55, 0.80, 64}, {0.80, 1.05, 67}, {1.20, 1.60, 72}, {1.70, 1.95, 69}}
	x := make([]float64, 3*SampleRate)
	for _, n := range notes {
		addHarmonicNote(x, n)
	}
	m, err := AnalyzeMelody(&Audio{Source: Source{Duration: 3}, Channels: [][]float64{x}}, nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(m.Notes) != len(notes) {
		t.Fatalf("expected %d notes, got %+v", len(notes), m.Notes)
	}
	for i, want := range notes {
		got := m.Notes[i]
		if got.MIDI != want.midi {
			t.Fatalf("note %d: midi %d, want %d", i, got.MIDI, want.midi)
		}
		if math.Abs(got.Start-want.start) > 1.0/60 {
			t.Fatalf("note %d starts at %.3f, want %.3f", i, got.Start, want.start)
		}
		if math.Abs(got.End-want.end) > 0.03 {
			t.Fatalf("note %d ends at %.3f, want %.3f", i, got.End, want.end)
		}
		if got.Strength <= 0 || got.Strength > 1 {
			t.Fatalf("note %d strength %f", i, got.Strength)
		}
	}
	if m.Pitch[10] != 0 || m.Voicing[10] != 0 {
		t.Fatal("silence before the first note reported as voiced")
	}
}

func TestMelodySnapsNoteStartsToOnsets(t *testing.T) {
	x := make([]float64, SampleRate)
	addHarmonicNote(x, synthNote{0.30, 0.70, 67})
	m, err := AnalyzeMelody(&Audio{Source: Source{Duration: 1}, Channels: [][]float64{x}}, []Event{{Time: 0.322, Strength: 1}})
	if err != nil {
		t.Fatal(err)
	}
	if len(m.Notes) != 1 || m.Notes[0].Start != 0.322 {
		t.Fatalf("note start not snapped to the nearby onset: %+v", m.Notes)
	}
}

func TestChromaFindsTriad(t *testing.T) {
	x := make([]float64, SampleRate)
	for _, midi := range []float64{60, 64, 67} {
		f := midiHz(midi)
		for i := range x {
			x[i] += 0.2 * math.Sin(2*math.Pi*f*float64(i)/SampleRate)
		}
	}
	m, err := AnalyzeMelody(&Audio{Source: Source{Duration: 1}, Channels: [][]float64{x}}, nil)
	if err != nil {
		t.Fatal(err)
	}
	type pc struct {
		class int
		value float64
	}
	classes := []pc{}
	for c := range m.Chroma {
		classes = append(classes, pc{c, m.Chroma[c][50]})
	}
	sort.Slice(classes, func(i, j int) bool { return classes[i].value > classes[j].value })
	top := map[int]bool{classes[0].class: true, classes[1].class: true, classes[2].class: true}
	if !top[0] || !top[4] || !top[7] {
		t.Fatalf("C major triad chroma: %+v", classes)
	}
	if classes[3].value > 0.35 {
		t.Fatalf("chroma leaks into pitch class %d: %f", classes[3].class, classes[3].value)
	}
}

func TestMelodySilenceIsUnvoiced(t *testing.T) {
	m, err := AnalyzeMelody(&Audio{Source: Source{Duration: 1}, Channels: [][]float64{make([]float64, SampleRate)}}, nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(m.Notes) != 0 {
		t.Fatal("silence produced notes")
	}
	for c := range m.Chroma {
		for _, v := range m.Chroma[c] {
			if v != 0 {
				t.Fatal("silence produced chroma")
			}
		}
	}
}

func TestClassifyDrums(t *testing.T) {
	x := make([]float64, 2*SampleRate)
	hit := func(time float64, f func(j int) float64) {
		start := int(time * SampleRate)
		for j := 0; j < SampleRate/3; j++ {
			x[start+j] += f(j)
		}
	}
	decay := func(j int, seconds float64) float64 { return math.Exp(-float64(j) / (SampleRate * seconds)) }
	sines := func(j int, lo, hi float64) float64 {
		v := 0.0
		for k := 0; k < 40; k++ {
			f := lo + (hi-lo)*float64(k)/40
			v += 0.05 * math.Sin(2*math.Pi*f*float64(j)/SampleRate+float64(k*k))
		}
		return v
	}
	hit(0.25, func(j int) float64 { return 0.8 * math.Sin(2*math.Pi*60*float64(j)/SampleRate) * decay(j, 0.06) })
	hit(0.75, func(j int) float64 {
		return (0.4*math.Sin(2*math.Pi*190*float64(j)/SampleRate) + sines(j, 2000, 5000)) * decay(j, 0.03)
	})
	hit(1.25, func(j int) float64 { return sines(j, 7000, 11000) * decay(j, 0.015) })
	track, err := Analyze(&Audio{Source: Source{Duration: 2}, Channels: [][]float64{x}})
	if err != nil {
		t.Fatal(err)
	}
	if err := ClassifyDrums(track); err != nil {
		t.Fatal(err)
	}
	kinds := []string{}
	for _, e := range track.Events {
		kinds = append(kinds, e.Kind)
	}
	if len(kinds) != 3 || kinds[0] != "kick" || kinds[1] != "snare" || kinds[2] != "hat" {
		t.Fatalf("drum kinds %v from %+v", kinds, track.Events)
	}
}

func TestDownbeatFollowsAccentedBeat(t *testing.T) {
	r := Rhythm{BPM: 120}
	kicks := []Event{}
	for b := 0; b < 32; b++ {
		time := 0.1 + float64(b)*0.5
		r.Beats = append(r.Beats, time)
		strength := 0.5
		if b%4 == 1 {
			strength = 1
		}
		kicks = append(kicks, Event{Time: time + 0.004, Strength: strength, Kind: "kick"})
	}
	if got := EstimateDownbeat(r, kicks, nil); got != 1 {
		t.Fatalf("downbeat index %d, want 1", got)
	}
}
