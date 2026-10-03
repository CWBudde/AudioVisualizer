package story

import (
	"fmt"
	"math"
	"sort"
)

var PitchNames = [12]string{"C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"}

func NoteName(midi int) string { return fmt.Sprintf("%s%d", PitchNames[(midi%12+12)%12], midi/12-1) }

// Krumhansl–Kessler probe-tone profiles, tonic first.
var (
	majorProfile = [12]float64{6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88}
	minorProfile = [12]float64{6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17}
)

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

type keyScore struct {
	tonic int
	minor bool
	r     float64
}

func keyName(tonic int, minor bool) string {
	if minor {
		return PitchNames[tonic] + " minor"
	}
	return PitchNames[tonic] + " major"
}

// Sharps returns the key signature (negative for flats) of the estimate.
func (k KeyEstimate) Sharps() int {
	major := k.Tonic
	if k.Mode == "minor" {
		major = (k.Tonic + 3) % 12
	}
	s := major * 7 % 12
	if s > 6 {
		s -= 12
	}
	return s
}

// Diatonic reports whether pitch class pc belongs to the key's scale
// (natural minor for minor keys).
func (k KeyEstimate) Diatonic(pc int) bool {
	steps := []int{0, 2, 4, 5, 7, 9, 11}
	if k.Mode == "minor" {
		steps = []int{0, 2, 3, 5, 7, 8, 10}
	}
	for _, s := range steps {
		if (k.Tonic+s)%12 == ((pc%12)+12)%12 {
			return true
		}
	}
	return false
}

func pearson(a, b [12]float64) float64 {
	ma, mb := 0.0, 0.0
	for i := range a {
		ma += a[i] / 12
		mb += b[i] / 12
	}
	num, da, db := 0.0, 0.0, 0.0
	for i := range a {
		num += (a[i] - ma) * (b[i] - mb)
		da += (a[i] - ma) * (a[i] - ma)
		db += (b[i] - mb) * (b[i] - mb)
	}
	if da == 0 || db == 0 {
		return 0
	}
	return num / math.Sqrt(da*db)
}

// EstimateKey correlates a pitch-class profile with all 24 rotated
// Krumhansl–Kessler profiles. When the best key and its relative differ by
// less than tie, tonicEvidence (for example bass weight at section edges)
// decides between them and the estimate is flagged ambiguous.
func EstimateKey(pc [12]float64, tonicEvidence [12]float64, tie float64) KeyEstimate {
	scores := []keyScore{}
	for tonic := range 12 {
		for _, minor := range []bool{false, true} {
			profile := majorProfile
			if minor {
				profile = minorProfile
			}
			var rot [12]float64
			for i := range rot {
				rot[(tonic+i)%12] = profile[i]
			}
			scores = append(scores, keyScore{tonic, minor, pearson(pc, rot)})
		}
	}
	sort.SliceStable(scores, func(i, j int) bool { return scores[i].r > scores[j].r })
	best, runner := scores[0], scores[1]
	relTonic := (best.tonic + 9) % 12
	if best.minor {
		relTonic = (best.tonic + 3) % 12
	}
	k := KeyEstimate{}
	for _, s := range scores[1:] {
		if s.tonic == relTonic && s.minor != best.minor && best.r-s.r < tie {
			k.RelativeAmbiguous = true
			k.RelativeEvidence = fmt.Sprintf("%s vs %s within %.2f; section-edge bass tonic weight %.3f vs %.3f", keyName(best.tonic, best.minor), keyName(s.tonic, s.minor), tie, tonicEvidence[best.tonic], tonicEvidence[s.tonic])
			if tonicEvidence[s.tonic] > tonicEvidence[best.tonic] {
				best, runner = s, best
			} else {
				runner = s
			}
		}
	}
	k.Tonic, k.Mode, k.Name, k.Correlation = best.tonic, "major", keyName(best.tonic, best.minor), r3(best.r)
	if best.minor {
		k.Mode = "minor"
	}
	k.RunnerUp, k.RunnerUpCorrelation = keyName(runner.tonic, runner.minor), r3(runner.r)
	rel := keyScore{(best.tonic + 9) % 12, true, 0}
	if best.minor {
		rel = keyScore{(best.tonic + 3) % 12, false, 0}
	}
	for _, s := range scores {
		if s.tonic == rel.tonic && s.minor == rel.minor {
			k.Relative, k.RelativeCorrelation = keyName(s.tonic, s.minor), r3(s.r)
		}
	}
	sum := 0.0
	for _, v := range pc {
		sum += v
	}
	for i, v := range pc {
		if sum > 0 {
			k.Profile[i] = r3(v / sum)
		}
	}
	return k
}

// ChordQuality is one template: intervals above the root.
type ChordQuality struct {
	Name, Suffix string
	Intervals    []int
}

var Qualities = []ChordQuality{
	{"maj", "", []int{0, 4, 7}},
	{"min", "m", []int{0, 3, 7}},
	{"7", "7", []int{0, 4, 7, 10}},
	{"maj7", "maj7", []int{0, 4, 7, 11}},
	{"m7", "m7", []int{0, 3, 7, 10}},
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

// ChordWindow is the evidence for one chord slot: harmony chroma, bass
// pitch-class weight and the harmony stem level.
type ChordWindow struct {
	Start, End float64
	Chroma     [12]float64
	Bass       [12]float64
	LevelDB    float64
}

func cosine(a, b []float64) float64 {
	dot, na, nb := 0.0, 0.0, 0.0
	for i := range a {
		dot += a[i] * b[i]
		na += a[i] * a[i]
		nb += b[i] * b[i]
	}
	if na == 0 || nb == 0 {
		return 0
	}
	return dot / math.Sqrt(na*nb)
}

// DetectChords scores 12 roots × Qualities per window against the chroma,
// adds bass evidence (full for the root, InversionShare for another chord
// tone) and key evidence, and Viterbi-smooths with a switch penalty.
// Windows below the gate or with flat chroma are "N". Equal neighbours merge.
func DetectChords(windows []ChordWindow, key KeyEstimate, g Grid, p ChordParams) []Chord {
	type state struct{ root, quality int } // quality -1: N
	states := []state{{-1, -1}}
	for root := range 12 {
		for q := range Qualities {
			states = append(states, state{root, q})
		}
	}
	tones := func(s state) []int {
		out := []int{}
		for _, iv := range Qualities[s.quality].Intervals {
			out = append(out, (s.root+iv)%12)
		}
		return out
	}
	scores := make([][]float64, len(windows))
	for w, win := range windows {
		scores[w] = make([]float64, len(states))
		maxC, mean, maxB := 0.0, 0.0, 0.0
		for i := range 12 {
			maxC = math.Max(maxC, win.Chroma[i])
			mean += win.Chroma[i] / 12
			maxB = math.Max(maxB, win.Bass[i])
		}
		if win.LevelDB < p.GateDB || mean == 0 || maxC/mean < p.MinPeakRatio {
			for s := range states {
				scores[w][s] = math.Inf(-1)
			}
			scores[w][0] = 1
			continue
		}
		scores[w][0] = math.Inf(-1)
		for s, st := range states[1:] {
			var tpl [12]float64
			inKey := true
			for _, pc := range tones(st) {
				tpl[pc] = 1
				inKey = inKey && key.Diatonic(pc)
			}
			v := cosine(win.Chroma[:], tpl[:])
			if maxB > 0 {
				bass := win.Bass[st.root]
				for _, pc := range tones(st)[1:] {
					bass = math.Max(bass, p.InversionShare*win.Bass[pc])
				}
				v += p.BassWeight * bass / maxB
			}
			if len(Qualities[st.quality].Intervals) > 3 {
				v -= p.SeventhCost
			}
			if inKey {
				v += p.InKeyBonus
			}
			scores[w][s+1] = v
		}
	}
	// Viterbi; ties keep the lower state index for determinism.
	path := make([]int, len(windows))
	if len(windows) > 0 {
		acc := append([]float64(nil), scores[0]...)
		back := make([][]int, len(windows))
		for w := 1; w < len(windows); w++ {
			back[w] = make([]int, len(states))
			next := make([]float64, len(states))
			bestPrev := 0
			for s := range states {
				if acc[s] > acc[bestPrev] {
					bestPrev = s
				}
			}
			for s := range states {
				stay, move := acc[s], acc[bestPrev]-p.SwitchCost
				if stay >= move {
					next[s], back[w][s] = stay+scores[w][s], s
				} else {
					next[s], back[w][s] = move+scores[w][s], bestPrev
				}
			}
			acc = next
		}
		last := 0
		for s := range states {
			if acc[s] > acc[last] {
				last = s
			}
		}
		for w := len(windows) - 1; w >= 0; w-- {
			path[w] = last
			if w > 0 {
				last = back[w][last]
			}
		}
	}
	chords, merged := []Chord{}, []int{}
	for w, win := range windows {
		st := states[path[w]]
		sorted := append([]float64(nil), scores[w]...)
		sort.Sort(sort.Reverse(sort.Float64Slice(sorted)))
		c := Chord{Start: r6(win.Start), End: r6(win.End), Bar: g.Bar(win.Start + 1e-6), Root: -1, Bass: -1, Quality: "N", Symbol: "N", Score: r3(scores[w][path[w]])}
		c.BeatInBar = int(math.Round((win.Start - g.BarStart(c.Bar)) / g.BeatSeconds))
		if len(sorted) > 1 && !math.IsInf(sorted[1], -1) {
			c.Margin = r3(sorted[0] - sorted[1])
		}
		if st.root >= 0 {
			q := Qualities[st.quality]
			c.Root, c.Quality, c.Bass = st.root, q.Name, st.root
			c.Symbol = PitchNames[st.root] + q.Suffix
			bass, maxB := 0, 0.0
			for i, v := range win.Bass {
				if v > maxB {
					bass, maxB = i, v
				}
			}
			for _, pc := range tones(st)[1:] {
				if maxB > 0 && pc == bass {
					c.Bass = bass
					c.Symbol += "/" + PitchNames[bass]
				}
			}
			for _, iv := range q.Intervals {
				c.Voicing = append(c.Voicing, 48+st.root+iv)
			}
		}
		if k := len(chords) - 1; k >= 0 && chords[k].Symbol == c.Symbol {
			merged[k]++
			chords[k].End = c.End
			chords[k].Score = r3(chords[k].Score + (c.Score-chords[k].Score)/float64(merged[k]))
			chords[k].Margin = math.Min(chords[k].Margin, c.Margin)
			continue
		}
		chords, merged = append(chords, c), append(merged, 1)
	}
	return chords
}
