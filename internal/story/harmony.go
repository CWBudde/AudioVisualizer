package story

import (
	"fmt"
	"math"

	"github.com/cwbudde/algo-dsp/dsp/effects/pitch"
	"github.com/cwbudde/algo-dsp/measure/music/harmony"
)

var PitchNames = [12]string{"C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"}

type KeyEstimate struct {
	Tonic               int         `json:"tonic"`
	Mode                string      `json:"mode"`
	Name                string      `json:"name"`
	Correlation         float64     `json:"correlation"`
	RunnerUp            string      `json:"runnerUp"`
	RunnerUpCorrelation float64     `json:"runnerUpCorrelation"`
	Relative            string      `json:"relative"`
	RelativeCorrelation float64     `json:"relativeCorrelation"`
	RelativeAmbiguous   bool        `json:"relativeAmbiguous"`
	RelativeEvidence    string      `json:"relativeEvidence,omitempty"`
	Profile             [12]float64 `json:"profile"`
}

// Sharps returns the key signature (negative for flats) of the estimate.
func (k KeyEstimate) Sharps() int {
	mode := harmony.Major
	if k.Mode == "minor" {
		mode = harmony.Minor
	}
	return harmony.Key{Tonic: pitch.PitchClass(k.Tonic), Mode: mode}.Sharps()
}

// estimateKey runs harmony.EstimateKey on a pitch-class profile. When the
// best key and its relative differ by less than tie, tonicEvidence (bass
// weight at section edges) decides between them and the estimate is flagged
// ambiguous.
func estimateKey(profile, tonicEvidence [12]float64, tie float64) (harmony.Key, KeyEstimate, error) {
	k, err := harmony.EstimateKey(profile, harmony.WithTonicEvidence(tonicEvidence), harmony.WithTieMargin(tie))
	if err != nil {
		return k, KeyEstimate{}, err
	}
	out := KeyEstimate{Tonic: int(k.Tonic), Mode: k.Mode.String(), Name: k.String(), Correlation: r3(k.Correlation),
		RunnerUp: k.RunnerUp.String(), RunnerUpCorrelation: r3(k.RunnerUp.Correlation),
		Relative: k.Relative.String(), RelativeCorrelation: r3(k.Relative.Correlation), RelativeAmbiguous: k.Ambiguous}
	if k.Ambiguous {
		a, b := k.Tied[0], k.Tied[1]
		out.RelativeEvidence = fmt.Sprintf("%s vs %s within %.2f; section-edge bass tonic weight %.3f vs %.3f", a, b, tie, tonicEvidence[a.Tonic], tonicEvidence[b.Tonic])
	}
	for i, v := range harmony.Normalize(profile) {
		out.Profile[i] = r3(v)
	}
	return k, out, nil
}

type ChordParams struct {
	BeatsPerChord  int     `json:"beatsPerChord"`
	BassWeight     float64 `json:"bassRootBonus"`
	InversionShare float64 `json:"bassInversionShare"`
	SeventhCost    float64 `json:"seventhPenalty"`
	InKeyBonus     float64 `json:"inKeyBonus"`
	MinPeakRatio   float64 `json:"minChromaMaxOverMean"`
	GateDB         float64 `json:"gateDBFS"`
	SwitchCost     float64 `json:"viterbiSwitchPenalty"`
}

// The spec's 0.3 root bonus let a bass on the third outvote the chroma (B7/D#
// read as D#m); 0.2 plus half credit for a bass on another chord tone fits
// inversions.
func DefaultChordParams() ChordParams { return ChordParams{2, 0.2, 0.5, 0.03, 0.05, 1.5, -50, 0.10} }

func (p ChordParams) options() []harmony.ChordOption {
	return []harmony.ChordOption{
		harmony.WithBassRootBonus(p.BassWeight),
		harmony.WithInversionShare(p.InversionShare),
		harmony.WithSeventhPenalty(p.SeventhCost),
		harmony.WithInKeyBonus(p.InKeyBonus),
		harmony.WithMinPeakRatio(p.MinPeakRatio),
		harmony.WithGateDB(p.GateDB),
		harmony.WithSwitchPenalty(p.SwitchCost),
	}
}

type Chord struct {
	Start     float64 `json:"startSeconds"`
	End       float64 `json:"endSeconds"`
	Bar       int     `json:"bar"`
	BeatInBar int     `json:"beatInBar"`
	Root      int     `json:"root"` // pitch class, -1 for no chord
	Quality   string  `json:"quality"`
	Bass      int     `json:"bass"`
	Symbol    string  `json:"symbol"`
	Score     float64 `json:"score"`
	Margin    float64 `json:"margin"`
	Voicing   []int   `json:"voicing"`
}

// detectChords runs harmony.Chords on the chord windows and places the
// chords on the grid.
func detectChords(windows []harmony.Window, key harmony.Key, g Grid, p ChordParams) ([]Chord, error) {
	chords, err := harmony.Chords(windows, key, p.options()...)
	if err != nil {
		return nil, err
	}
	out := make([]Chord, len(chords))
	for i, c := range chords {
		ch := Chord{Start: r6(c.Start), End: r6(c.End), Bar: g.Bar(c.Start + 1e-6), Root: -1, Bass: -1, Quality: c.Quality, Symbol: c.Symbol, Score: c.Score, Margin: c.Margin}
		ch.BeatInBar = int(math.Round((c.Start - g.BarStart(ch.Bar)) / g.BeatSeconds()))
		if !c.NoChord {
			ch.Root, ch.Bass, ch.Voicing = int(c.Root), int(c.Bass), c.Voicing
		}
		out[i] = ch
	}
	return out, nil
}
