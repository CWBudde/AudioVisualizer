package story

import (
	"math"
	"strings"

	"github.com/cwbudde/AudioVisualizer/internal/audioanalysis"
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

// block is one feature group of a frame vector, L2-normalised then weighted
// after z-scoring.
type block struct {
	values [][]float64 // [unit][dim]
	weight float64
}

// ZScore standardises each dimension over the rows in place (constant
// dimensions become zero).
func ZScore(rows [][]float64) {
	if len(rows) == 0 {
		return
	}
	for d := range rows[0] {
		mean, sq := 0.0, 0.0
		for _, r := range rows {
			mean += r[d] / float64(len(rows))
		}
		for _, r := range rows {
			sq += (r[d] - mean) * (r[d] - mean)
		}
		sd := math.Sqrt(sq / float64(len(rows)))
		for _, r := range rows {
			if sd > 1e-12 {
				r[d] = (r[d] - mean) / sd
			} else {
				r[d] = 0
			}
		}
	}
}

func assemble(blocks []block) [][]float64 {
	if len(blocks) == 0 {
		return nil
	}
	out := make([][]float64, len(blocks[0].values))
	for _, b := range blocks {
		ZScore(b.values)
		for u, v := range b.values {
			norm := 0.0
			for _, x := range v {
				norm += x * x
			}
			norm = math.Sqrt(norm)
			for _, x := range v {
				if norm > 0 {
					x *= b.weight / norm
				}
				out[u] = append(out[u], x)
			}
		}
	}
	return out
}

// SelfSimilarity is the cosine similarity of every pair of rows.
func SelfSimilarity(rows [][]float64) [][]float64 {
	s := make([][]float64, len(rows))
	for i := range rows {
		s[i] = make([]float64, len(rows))
		for j := range rows {
			s[i][j] = cosine(rows[i], rows[j])
		}
	}
	return s
}

// FooteNovelty correlates a Gaussian-tapered checkerboard kernel along the
// diagonal; entry t scores a boundary just before unit t, scaled to max 1.
func FooteNovelty(s [][]float64, halfWidth int) []float64 {
	n := len(s)
	out := make([]float64, n)
	sigma := float64(halfWidth) / 2
	top := 0.0
	for t := range n {
		v := 0.0
		for a := -halfWidth; a < halfWidth; a++ {
			for b := -halfWidth; b < halfWidth; b++ {
				i, j := t+a, t+b
				if i < 0 || j < 0 || i >= n || j >= n {
					continue
				}
				sign := 1.0
				if (a < 0) != (b < 0) {
					sign = -1
				}
				x, y := float64(a)+0.5, float64(b)+0.5
				v += sign * math.Exp(-(x*x+y*y)/(2*sigma*sigma)) * s[i][j]
			}
		}
		out[t] = math.Max(0, v)
		top = math.Max(top, out[t])
	}
	for t := range out {
		if top > 0 {
			out[t] /= top
		}
	}
	return out
}

// Boundaries are novelty peaks (maximum within ±radius beats) above
// mean + sigma·σ, related to the nearest cue start.
func Boundaries(novelty []float64, g Grid, cues []audioanalysis.Cue, radius int, sigma float64) []Boundary {
	mean, sq := 0.0, 0.0
	for _, v := range novelty {
		mean += v / float64(len(novelty))
	}
	for _, v := range novelty {
		sq += (v - mean) * (v - mean) / float64(len(novelty))
	}
	threshold := mean + sigma*math.Sqrt(sq)
	out := []Boundary{}
	for t, v := range novelty {
		if v <= threshold {
			continue
		}
		peak := true
		for k := max(0, t-radius); k <= min(len(novelty)-1, t+radius); k++ {
			if novelty[k] > v || (novelty[k] == v && k < t) {
				peak = false
			}
		}
		if !peak {
			continue
		}
		time := g.BeatStart(t)
		b := Boundary{Time: r6(time), Beat: t, BarPosition: r3(g.BarPosition(time)), Novelty: r3(v)}
		best := math.Inf(1)
		for _, c := range cues {
			if d := time - c.Start; math.Abs(d) < math.Abs(best) {
				best, b.NearestCue = d, c.Name
			}
		}
		b.CueDelta = r3(best)
		out = append(out, b)
	}
	return out
}

// Label assigns letters to consecutive units of size rows of s (phrases of
// bars, or single bars). A unit takes the label of its most similar earlier
// letter (mean diagonal similarity against every earlier unit of that letter,
// best match) when ≥ same, a primed variant of it when ≥ variant, and a new
// letter otherwise. It also returns each unit's similarity to the first unit
// carrying its letter.
func Label(s [][]float64, size int, same, variant float64, lower bool) ([]string, []float64) {
	units := (len(s) + size - 1) / size
	sim := func(a, b int) float64 {
		v, n := 0.0, 0
		for k := range size {
			i, j := a*size+k, b*size+k
			if i < len(s) && j < len(s) {
				v += s[i][j]
				n++
			}
		}
		if n == 0 {
			return 0
		}
		return v / float64(n)
	}
	labels, first := make([]string, units), []int{}
	toFirst := make([]float64, units)
	base := func(l string) string { return strings.TrimRight(l, "'") }
	for u := range units {
		bestLetter, bestSim := -1, math.Inf(-1)
		for letter := range first {
			for v := range u {
				if base(labels[v]) == letterName(letter, lower) && sim(u, v) > bestSim {
					bestLetter, bestSim = letter, sim(u, v)
				}
			}
		}
		switch {
		case bestLetter >= 0 && bestSim >= same:
			labels[u] = letterName(bestLetter, lower)
		case bestLetter >= 0 && bestSim >= variant:
			labels[u] = letterName(bestLetter, lower) + "'"
		default:
			bestLetter = len(first)
			first = append(first, u)
			labels[u] = letterName(bestLetter, lower)
		}
		toFirst[u] = r3(sim(u, first[bestLetter]))
	}
	return labels, toFirst
}

func letterName(i int, lower bool) string {
	a := 'A'
	if lower {
		a = 'a'
	}
	if i < 26 {
		return string(a + rune(i))
	}
	return string(a+rune(i%26)) + string(rune('0'+i/26))
}
