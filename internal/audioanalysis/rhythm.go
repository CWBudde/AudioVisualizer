package audioanalysis

import (
	"fmt"
	"math"

	"github.com/cwbudde/algo-dsp/measure/music/align"
	"github.com/cwbudde/algo-dsp/measure/music/features"
	"github.com/cwbudde/algo-dsp/measure/music/rhythm"
)

// EstimateRhythm reports broad alternatives, then refines the independently
// observed 105 BPM hypothesis. The prior is explicit, not a hidden certainty.
func EstimateRhythm(t *Track, preferredBPM float64) (Rhythm, error) {
	tempo, err := rhythm.EstimateTempo(rhythm.Novelty(t.Flux, 30), timing, rhythm.WithPrior(preferredBPM))
	if err != nil {
		return Rhythm{}, err
	}
	candidates := make([]TempoCandidate, len(tempo.Candidates))
	for i, c := range tempo.Candidates {
		candidates[i] = TempoCandidate(c)
	}
	if tempo.BPM == 0 {
		return Rhythm{Evidence: "No rhythmic novelty; tempo unavailable", Candidates: candidates}, nil
	}
	// Fit beat phase using positive changes in the drum stem's low band, favoring
	// kick-like activity over snare/hi-hat subdivisions without labeling events.
	phase := rhythm.FitBeatPhase(t.Bands[0], timing, tempo.BPM, t.Source.Duration)
	times := make([]float64, len(t.Events))
	for i, e := range t.Events {
		times[i] = e.Time
	}
	return Rhythm{BPM: tempo.BPM, BeatOrigin: phase, Meter: "4/4 inferred from ~9.14 s phrase changes; downbeat index unverified", Candidates: candidates,
		Beats:              rhythm.BeatGrid(phase, tempo.BPM, t.Source.Duration),
		MedianOnsetErrorMS: rhythm.GridError(times, phase, tempo.BPM, 4) * 1000,
		Evidence:           fmt.Sprintf("Refined explicit %.1f BPM mix-analysis prior using multibeat spectral-novelty correlation %.4f; phase fitted to low-band drum attacks", preferredBPM, tempo.Correlation)}, nil
}

func FindSilence(a *Audio) ([]Interval, error) {
	silence, err := features.Silence(a.Channels, SampleRate, -45, 0.15)
	if err != nil {
		return nil, err
	}
	intervals := make([]Interval, len(silence))
	for i, s := range silence {
		intervals[i] = Interval(s)
	}
	return intervals, nil
}

func CheckAlignment(mix *Audio, stems []*Audio) (*Alignment, error) {
	if len(stems) != 4 {
		return nil, fmt.Errorf("expected four stems")
	}
	result := &Alignment{}
	parts := make([][][]float64, len(stems))
	for i, s := range stems {
		errorMS := math.Abs(s.Source.Duration-mix.Source.Duration) * 1000
		result.MaxDurationErrorMS = math.Max(result.MaxDurationErrorMS, errorMS)
		if errorMS > 2 {
			return nil, fmt.Errorf("stem %s duration differs by %.3f ms", s.Source.Path, errorMS)
		}
		parts[i] = s.Channels
	}
	r, err := align.Check(mix.Channels, parts, SampleRate)
	if err != nil {
		return nil, err
	}
	result.Correlation, result.BestLagMS, result.ResidualRMSDB = r.Correlation, r.BestLag*1000, r.ResidualRMSDB
	return result, nil
}

func PixelParadeCues(duration float64, silence []Interval) []Cue {
	first, second := Interval{8.746, 9.168}, Interval{18.050, 18.311}
	if len(silence) >= 2 {
		first, second = silence[0], silence[1]
	}
	return []Cue{
		{"assembly", 0, first.Start, "Lighter opening; rising bass pickup before the gap", "high"},
		{"first-pause", first.Start, first.End, "Measured < -45 dBFS near-silence", "high"},
		{"first-parade", first.End, second.Start, "Sustained low-frequency entrance", "high"},
		{"second-pause", second.Start, second.End, "Measured < -45 dBFS near-silence", "high"},
		{"interlocking-parade", second.End, 36.6, "Bass-heavy passage; phrase variations near 27.43 s", "high"},
		{"open-breakdown", 36.6, 44.4, "Mix low-band share falls markedly; exact edge approximate", "medium"},
		{"tunnel-return", 44.4, 54.9, "Low-frequency pickup and resumed high energy", "medium"},
		{"suspended-breakdown", 54.9, 64.0, "Low-frequency reduction and quiet lead-in to 64 s", "high"},
		{"finale", 64.0, 82.3, "Strongest sustained section; abrupt return at 64 s", "high"},
		{"settle", 82.3, duration, "High-frequency energy and centroid collapse", "high"},
	}
}

// EstimateDownbeat returns the index (0–3) of the first bar downbeat in
// r.Beats under 4/4, scoring each phase by kick and bass attacks near beats.
func EstimateDownbeat(r Rhythm, drums, bass []Event) int {
	accents := []rhythm.Accent{}
	for _, e := range drums {
		if e.Kind == "kick" {
			accents = append(accents, rhythm.Accent{Time: e.Time, Weight: e.Strength})
		}
	}
	for _, e := range bass {
		accents = append(accents, rhythm.Accent{Time: e.Time, Weight: e.Strength})
	}
	return rhythm.Downbeat(r.Beats, accents, 4, 0.06)
}
