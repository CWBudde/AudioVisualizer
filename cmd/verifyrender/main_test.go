package main

import (
	"github.com/cwbudde/AudioVisualizer/internal/audioanalysis"
	"math"
	"testing"
)

func TestComparisonUsesAlignedChannelClock(t *testing.T) {
	const lag = 128
	a := &audioanalysis.Audio{Source: audioanalysis.Source{SampleRate: 48000}, Channels: [][]float64{make([]float64, 72000)}}
	b := &audioanalysis.Audio{Source: a.Source, Channels: [][]float64{make([]float64, 72000+lag)}}
	for i := range a.Channels[0] {
		x := .1 * (math.Sin(float64(i)*.21) + math.Sin(float64(i*i)*.001))
		a.Channels[0][i] = x
		b.Channels[0][i+lag] = x * 1.1
	}
	w, err := compare(a, b, .2, 2.2)
	if err != nil {
		t.Fatal(err)
	}
	if math.Abs(w.LagMS-float64(lag)*1000/audioanalysis.SampleRate) > 1e-9 || w.Correlation < .999999 || math.Abs(w.GainDB-20*math.Log10(1.1)) > 1e-9 {
		t.Fatalf("incorrect sample clock, lag or gain: %+v", w)
	}
}

func TestComparisonRejectsWindowBeyondSignal(t *testing.T) {
	x := make([]float64, 3*audioanalysis.SampleRate)
	for i := range x {
		x[i] = math.Sin(float64(i) * .01)
	}
	a := &audioanalysis.Audio{Channels: [][]float64{x}}
	if w, err := compare(a, a, 5, 6); err == nil {
		t.Fatalf("window beyond the 3 s signal compared: %+v", w)
	}
}
