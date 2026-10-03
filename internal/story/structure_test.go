package story

import (
	"math"
	"math/rand"
	"slices"
	"testing"
)

func randomUnit(rng *rand.Rand, dims int) []float64 {
	v := make([]float64, dims)
	norm := 0.0
	for i := range v {
		v[i] = rng.NormFloat64()
		norm += v[i] * v[i]
	}
	for i := range v {
		v[i] /= math.Sqrt(norm)
	}
	return v
}

func TestLabelPhrases(t *testing.T) {
	rng := rand.New(rand.NewSource(1))
	phrase := func() [][]float64 {
		out := [][]float64{}
		for range 4 {
			out = append(out, randomUnit(rng, 400))
		}
		return out
	}
	a, b, c := phrase(), phrase(), phrase()
	variant := [][]float64{}
	for _, v := range a {
		r, w := randomUnit(rng, 400), make([]float64, 400)
		for i := range w {
			w[i] = 0.5*v[i] + 0.866*r[i]
		}
		variant = append(variant, w)
	}
	rows := slices.Concat(a, b, a, variant, c)
	labels, toFirst := Label(SelfSimilarity(rows), 4, 0.6, 0.35, false)
	if !slices.Equal(labels, []string{"A", "B", "A", "A'", "C"}) {
		t.Fatalf("labels %v (similarity to first %v)", labels, toFirst)
	}
	bars, _ := Label(SelfSimilarity(rows), 1, 0.6, 0.35, true)
	if bars[0] != "a" || bars[8] != "a" || bars[12] != "a'" {
		t.Fatalf("bar labels %v", bars)
	}
}

func TestNoveltyPeaksAtStepChange(t *testing.T) {
	rng := rand.New(rand.NewSource(2))
	u, v := randomUnit(rng, 64), randomUnit(rng, 64)
	rows := [][]float64{}
	for i := range 40 {
		base := u
		if i >= 23 {
			base = v
		}
		noise := randomUnit(rng, 64)
		row := make([]float64, 64)
		for k := range row {
			row[k] = base[k] + 0.2*noise[k]
		}
		rows = append(rows, row)
	}
	n := FooteNovelty(SelfSimilarity(rows), 8)
	peak := 0
	for i, x := range n {
		if x > n[peak] {
			peak = i
		}
	}
	if peak < 22 || peak > 24 || n[peak] != 1 {
		t.Fatalf("novelty peak at %d (%v)", peak, n)
	}
}
