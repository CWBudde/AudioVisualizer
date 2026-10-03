package audioanalysis

import (
	"math"

	"github.com/cwbudde/algo-dsp/measure/music/features"
	"github.com/cwbudde/algo-dsp/measure/music/onset"
)

var timing = features.Timing{SampleRate: SampleRate, Hop: Hop}

func Analyze(a *Audio) (*Track, error) {
	cfg := features.Config{SampleRate: SampleRate, FFTSize: FFTSize, Hop: Hop, BandEdges: BandEdges[:], Gate: Gate}
	f, err := features.Extract(a.Channels, cfg, features.WithLogSpectrogram(SpectrogramBins, SpectrogramMinHz, SpectrogramMaxHz))
	if err != nil {
		return nil, err
	}
	t := &Track{Source: a.Source, RMS: f.RMS, Peak: f.Peak, Centroid: f.Centroid, Width: f.Width, Flux: f.Flux, Spectrogram: f.Spectrogram.DB}
	copy(t.Bands[:], f.Bands)
	if t.Energy, err = features.Normalize(t.RMS, Gate, 0.01, 0.15, timing.FrameRate()); err != nil {
		return nil, err
	}
	for b := range t.Bands {
		if t.BandControls[b], err = features.Normalize(t.Bands[b], Gate, 0.01, 0.12, timing.FrameRate()); err != nil {
			return nil, err
		}
	}
	events, err := onset.Detect(a.Channels, f)
	if err != nil {
		return nil, err
	}
	t.Events = fromOnsets(events)
	return t, nil
}

// SpectrogramBinHz returns the centre frequency of each spectrogram row.
func SpectrogramBinHz() ([]float64, error) {
	s, err := features.NewLogScale(SpectrogramBins, SpectrogramMinHz, SpectrogramMaxHz, SampleRate, FFTSize)
	if err != nil {
		return nil, err
	}
	hz := s.BinFrequencies()
	for i, v := range hz {
		hz[i] = math.Round(v*100) / 100
	}
	return hz, nil
}

func (t *Track) frames() *features.Frames {
	return &features.Frames{Timing: timing, RMS: t.RMS, Peak: t.Peak, Centroid: t.Centroid, Width: t.Width, Flux: t.Flux, Bands: t.Bands[:]}
}

func fromOnsets(in []onset.Event) []Event {
	if in == nil {
		return nil
	}
	out := make([]Event, len(in))
	for i, e := range in {
		out[i] = Event{Time: e.Time, Strength: e.Strength}
		if e.Kind != onset.KindUnknown {
			out[i].Kind = e.Kind.String()
		}
	}
	return out
}

// ClassifyDrums labels drum events by the band shares of their first 30 ms:
// low-band dominance is a kick, top-band dominance without body is a hat, and
// everything else (body plus noise) counts as a snare/clap.
func ClassifyDrums(t *Track) error {
	in := make([]onset.Event, len(t.Events))
	for i, e := range t.Events {
		in[i] = onset.Event{Time: e.Time, Strength: e.Strength}
	}
	out, err := onset.ClassifyDrums(in, t.frames())
	if err != nil {
		return err
	}
	for i, e := range fromOnsets(out) {
		t.Events[i].Kind = e.Kind
	}
	return nil
}
