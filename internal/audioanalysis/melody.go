package audioanalysis

import "github.com/cwbudde/algo-dsp/measure/music/melody"

// Note is one segmented melody note. Times are seconds, MIDI is rounded.
type Note struct {
	Start    float64 `json:"startSeconds"`
	End      float64 `json:"endSeconds"`
	MIDI     int     `json:"midi"`
	Strength float64 `json:"strength"`
}

// Melody describes the predominant pitched line of a track at the feature rate.
// Pitch is fractional MIDI (0 when unvoiced); voicing is the share of frame
// power explained by the chosen harmonic series. Chroma rows are pitch classes
// C..B, each frame normalized to its strongest class.
type Melody struct {
	Pitch   []float64     `json:"pitchMIDI"`
	Voicing []float64     `json:"voicing"`
	Chroma  [12][]float64 `json:"chroma"`
	Notes   []Note        `json:"notes"`
}

// AnalyzeMelody tracks the predominant pitch by harmonic summation. Onsets,
// when given, refine note starts and split re-articulated repeated notes.
// Options are applied after the default hop and onsets.
func AnalyzeMelody(a *Audio, onsets []Event, opts ...melody.Option) (*Melody, error) {
	mono, err := melody.Downmix(a.Channels)
	if err != nil {
		return nil, err
	}
	times := make([]float64, len(onsets))
	for i, e := range onsets {
		times[i] = e.Time
	}
	r, err := melody.Analyze(mono, SampleRate, append([]melody.Option{melody.WithHop(Hop), melody.WithOnsets(times)}, opts...)...)
	if err != nil {
		return nil, err
	}
	m := &Melody{Pitch: r.Pitch, Voicing: r.Voicing, Chroma: r.Chroma, Notes: make([]Note, len(r.Notes))}
	for i, n := range r.Notes {
		m.Notes[i] = Note(n)
	}
	return m, nil
}

// BassMelodyOptions retunes the tracker for a bass line: a long FFT resolves
// semitones near 40 Hz, and notes are longer and snap further to onsets.
func BassMelodyOptions() []melody.Option {
	return []melody.Option{
		melody.WithFFTSize(8192),
		melody.WithMIDIRange(28, 60),
		melody.WithFrequencyRange(30, 1200),
		melody.WithHarmonics(6, 0.8),
		melody.WithVoicingThreshold(0.3),
		melody.WithSmoothing(0.04),
		melody.WithNoteMinDuration(0.10),
		melody.WithNoteJump(0.8, 0.05),
		melody.WithOnsetSnap(0.06),
	}
}
