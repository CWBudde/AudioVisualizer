package story

import (
	"math"

	"github.com/cwbudde/AudioVisualizer/internal/audioanalysis"
	"github.com/cwbudde/algo-dsp/measure/music/structure"
)

type StructureParams struct {
	ChromaWeight     float64 `json:"chromaWeight"`
	BassChromaWeight float64 `json:"bassChromaWeight"`
	BandWeight       float64 `json:"mixBandDBWeight"`
	StemWeight       float64 `json:"stemRMSDBWeight"`
	DrumGridWeight   float64 `json:"barDrumGridWeight"`
	NoveltyHalfWidth int     `json:"noveltyHalfWidthBeats"`
	PeakRadius       int     `json:"boundaryPeakRadiusBeats"`
	PeakSigma        float64 `json:"boundaryMinSigma"`
	PhraseBars       int     `json:"phraseBars"`
	SameThreshold    float64 `json:"sameLabelSimilarity"`
	VariantThreshold float64 `json:"variantLabelSimilarity"`
}

func DefaultStructureParams() StructureParams {
	return StructureParams{1, 0.7, 0.5, 0.5, 0.5, 8, 4, 1, 4, 0.6, 0.35}
}

type Boundary struct {
	Time        float64 `json:"timeSeconds"`
	Beat        int     `json:"beat"`
	BarPosition float64 `json:"barPosition"`
	Novelty     float64 `json:"novelty"`
	NearestCue  string  `json:"nearestCue"`
	CueDelta    float64 `json:"cueDeltaSeconds"`
}

// boundaries are the novelty peaks of structure.Peaks at beat starts,
// related to the nearest cue start.
func boundaries(novelty []float64, g Grid, cues []audioanalysis.Cue, radius int, sigma float64) ([]Boundary, error) {
	starts := make([]float64, len(cues))
	for i, c := range cues {
		starts[i] = c.Start
	}
	peaks, err := structure.Peaks(novelty, radius, sigma, structure.WithMarks(starts), structure.WithPositions(g.BeatStart))
	if err != nil {
		return nil, err
	}
	out := []Boundary{}
	for _, pk := range peaks {
		b := Boundary{Time: r6(pk.Position), Beat: pk.Index, BarPosition: r3(g.BarPosition(pk.Position)), Novelty: r3(pk.Novelty), CueDelta: r3(math.Inf(1))}
		if pk.Mark >= 0 {
			b.NearestCue, b.CueDelta = cues[pk.Mark].Name, r3(pk.MarkOffset)
		}
		out = append(out, b)
	}
	return out, nil
}

// label runs structure.Label on units of size rows of s and returns the
// labels and each unit's similarity to the first unit of its letter.
func label(s [][]float64, size int, same, variant float64, opts ...structure.LabelOption) ([]string, []float64, error) {
	phrases, err := structure.Label(s, size, same, variant, opts...)
	if err != nil {
		return nil, nil, err
	}
	labels, toFirst := make([]string, len(phrases)), make([]float64, len(phrases))
	for i, p := range phrases {
		labels[i], toFirst[i] = p.Label, r3(p.Similarity)
	}
	return labels, toFirst, nil
}
