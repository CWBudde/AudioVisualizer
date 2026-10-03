package story

import (
	"fmt"
	"math"
	"slices"
	"sort"

	"github.com/cwbudde/AudioVisualizer/internal/audioanalysis"
)

type SourceRef struct {
	Name   string `json:"name"`
	Path   string `json:"path"`
	SHA256 string `json:"sha256"`
}

type Params struct {
	Lead             CleanParams     `json:"leadCleanup"`
	Bass             CleanParams     `json:"bassCleanup"`
	BassTracker      string          `json:"bassTracker"`
	KeyRelativeTie   float64         `json:"keyRelativeTie"`
	KeyBassWeight    float64         `json:"keyBassWeight"`
	Chords           ChordParams     `json:"chords"`
	Structure        StructureParams `json:"structure"`
	Motifs           MotifParams     `json:"motifs"`
	RoleActiveDB     float64         `json:"roleActiveDBBelowP95"`
	MIDIGridAligned  bool            `json:"midiGridAligned"`
	MIDITicksPerSecs float64         `json:"midiTicksPerSecond"`
}

func DefaultParams() Params {
	return Params{Lead: LeadCleanParams(), Bass: BassCleanParams(),
		BassTracker:    "FFT 8192, MIDI 28–60, 30–1200 Hz, 6 harmonics ×0.8, voicing 0.3, smoothing 40 ms, min note 100 ms, jump 0.8 st/50 ms, onset snap 60 ms to bass-stem onsets",
		KeyRelativeTie: 0.05, KeyBassWeight: 0.5, Chords: DefaultChordParams(), Structure: DefaultStructureParams(), Motifs: DefaultMotifParams(), RoleActiveDB: -12}
}

type Bar struct {
	Index        int                `json:"index"`
	Start        float64            `json:"startSeconds"`
	End          float64            `json:"endSeconds"`
	Label        string             `json:"label"`
	Section      string             `json:"section"`
	Cue          string             `json:"cue"`
	Chords       []string           `json:"chords"`
	BassRoot     string             `json:"bassRoot"`
	StemEnergyDB map[string]float64 `json:"stemEnergyDB"`
	Roles        []string           `json:"roles"`
	Motifs       []string           `json:"motifs"`
}

type Section struct {
	Label             string  `json:"label"`
	Start             float64 `json:"startSeconds"`
	End               float64 `json:"endSeconds"`
	FirstBar          int     `json:"firstBar"`
	LastBar           int     `json:"lastBar"`
	Cue               string  `json:"cue"`
	SimilarityToFirst float64 `json:"similarityToFirst"`
}

type Voice struct {
	Raw   []RawNote   `json:"raw"`
	Clean []StoryNote `json:"clean"`
}

type SSM struct {
	Beats [][]float64 `json:"beats"`
	Bars  [][]float64 `json:"bars"`
}

// Story is the full analysis written to analysis/story.json.
type Story struct {
	SchemaVersion int                 `json:"schemaVersion"`
	Sources       []SourceRef         `json:"sources"`
	Provenance    map[string]string   `json:"provenance"`
	Params        Params              `json:"params"`
	Grid          Grid                `json:"grid"`
	Key           KeyEstimate         `json:"key"`
	Chords        []Chord             `json:"chords"`
	Bars          []Bar               `json:"bars"`
	Sections      []Section           `json:"sections"`
	Boundaries    []Boundary          `json:"boundaries"`
	Novelty       []float64           `json:"beatNovelty"`
	Lead          Voice               `json:"lead"`
	Bass          Voice               `json:"bass"`
	Roles         []Role              `json:"roles"`
	Motifs        []Motif             `json:"motifs"`
	Leitmotifs    []string            `json:"leitmotifs"`
	SSM           SSM                 `json:"ssm"`
	Cues          []audioanalysis.Cue `json:"cues"`
	onsets        map[string][]audioanalysis.Event
}

// features gives windowed access to the stored tracks and the bass melody.
type features struct {
	a    *audioanalysis.Analysis
	bass *audioanalysis.Melody
	g    Grid
}

func (f features) track(name string) *audioanalysis.Track { return f.a.Tracks[name] }

// harmony is the other-stem chroma over [t0, t1), each frame weighted by its
// RMS because the stored chroma is normalised per frame.
func (f features) harmony(t0, t1 float64) [12]float64 {
	t := f.track("other")
	var c [12]float64
	lo, hi := f.g.frames(t0, t1, len(t.RMS))
	for i := lo; i < hi; i++ {
		for pc := range 12 {
			c[pc] += t.RMS[i] * t.Melody.Chroma[pc][i]
		}
	}
	return c
}

// bassPC is voicing-weighted bass chroma (in seconds) plus clean bass note
// overlap × strength.
func (f features) bassPC(t0, t1 float64, notes []StoryNote) [12]float64 {
	var c [12]float64
	lo, hi := f.g.frames(t0, t1, len(f.bass.Voicing))
	for i := lo; i < hi; i++ {
		for pc := range 12 {
			c[pc] += f.bass.Voicing[i] * f.bass.Chroma[pc][i] / frameRate
		}
	}
	for _, n := range notes {
		if o := math.Min(n.End, t1) - math.Max(n.Start, t0); o > 0 {
			c[n.MIDI%12] += o * n.Strength
		}
	}
	return c
}

func (f features) meanDB(name string, t0, t1 float64) float64 {
	t := f.track(name)
	lo, hi := f.g.frames(t0, t1, len(t.RMS))
	sum := 0.0
	for i := lo; i < hi; i++ {
		sum += t.RMS[i] * t.RMS[i]
	}
	if hi <= lo {
		return audioanalysis.DB(0)
	}
	return audioanalysis.DB(math.Sqrt(sum / float64(hi-lo)))
}

func (f features) energy(name string) func(t0, t1 float64) float64 {
	return func(t0, t1 float64) float64 {
		t := f.track(name)
		lo, hi := f.g.frames(t0, t1, len(t.Energy))
		sum := 0.0
		for i := lo; i < hi; i++ {
			sum += t.Energy[i]
		}
		if hi <= lo {
			return 0
		}
		return sum / float64(hi-lo)
	}
}

func normalized(c [12]float64) [12]float64 {
	sum := 0.0
	for _, v := range c {
		sum += v
	}
	if sum > 0 {
		for i := range c {
			c[i] /= sum
		}
	}
	return c
}

func (f features) cueAt(t float64) string {
	for _, c := range f.a.Cues {
		if t >= c.Start && t < c.End {
			return c.Name
		}
	}
	return ""
}

// Build runs the whole pipeline on a feature analysis plus the bass-stem
// melody tracked with audioanalysis.BassMelodyOptions.
func Build(a *audioanalysis.Analysis, bassMelody *audioanalysis.Melody, p Params) (*Story, error) {
	for _, name := range []string{"mix", "drums", "bass", "other", "vocals"} {
		if a.Tracks[name] == nil {
			return nil, fmt.Errorf("missing track %s", name)
		}
	}
	if a.Tracks["other"].Melody == nil || bassMelody == nil {
		return nil, fmt.Errorf("missing lead or bass melody")
	}
	g := NewGrid(a.Rhythm, a.Tracks["mix"].Source.Duration)
	f := features{a, bassMelody, g}
	s := &Story{SchemaVersion: 1, Params: p, Grid: g, Cues: a.Cues, onsets: map[string][]audioanalysis.Event{"drums": a.Tracks["drums"].Events, "bass": a.Tracks["bass"].Events}}
	s.Lead.Clean, s.Lead.Raw = CleanNotes(a.Tracks["other"].Melody.Notes, g, p.Lead)
	s.Bass.Clean, s.Bass.Raw = CleanNotes(bassMelody.Notes, g, p.Bass)
	for i := range s.Bass.Clean {
		s.Bass.Clean[i].Voice = "bass"
	}

	// Key: RMS-weighted harmony chroma plus duration-weighted bass notes.
	var bassNotes [12]float64
	for _, n := range s.Bass.Clean {
		bassNotes[n.MIDI%12] += n.End - n.Start
	}
	h, bn := normalized(f.harmony(0, g.Duration)), normalized(bassNotes)
	var profile, edges [12]float64
	for i := range profile {
		profile[i] = h[i] + p.KeyBassWeight*bn[i]
	}
	for _, c := range a.Cues {
		if c.End-c.Start < g.BarSeconds {
			continue
		}
		for _, b := range []int{g.Bar(c.Start + 1e-3), g.Bar(c.End - 1e-3)} {
			pc := normalized(f.bassPC(g.BarStart(b), g.BarStart(b+1), s.Bass.Clean))
			for i := range edges {
				edges[i] += pc[i]
			}
		}
	}
	s.Key = EstimateKey(profile, edges, p.KeyRelativeTie)

	// Chords per half bar.
	windows := []ChordWindow{}
	step := float64(p.Chords.BeatsPerChord) * g.BeatSeconds
	for b := range g.Bars() {
		for t := g.BarStart(b); t < g.BarStart(b+1)-1e-6 && t < g.Duration; t += step {
			end := math.Min(t+step, g.Duration)
			windows = append(windows, ChordWindow{Start: t, End: end, Chroma: f.harmony(t, end), Bass: f.bassPC(t, end, s.Bass.Clean), LevelDB: f.meanDB("other", t, end)})
		}
	}
	s.Chords = DetectChords(windows, s.Key, g, p.Chords)

	s.structure(f)
	s.motifs(f)
	s.Roles = Roles(a, g, s.Lead.Clean, s.Bass.Clean, s.Chords, p.RoleActiveDB)
	s.bars(f)
	return s, nil
}

func (s *Story) structure(f features) {
	g, p := s.Grid, s.Params.Structure
	beats := len(g.Beats)
	newBlock := func(dims int, w float64, fill func(t0, t1 float64, v []float64)) block {
		b := block{weight: w}
		for i := range beats {
			v := make([]float64, dims)
			fill(g.BeatStart(i), g.BeatStart(i+1), v)
			b.values = append(b.values, v)
		}
		return b
	}
	l2 := func(c [12]float64, v []float64) {
		norm := 0.0
		for _, x := range c {
			norm += x * x
		}
		for i, x := range c {
			if norm > 0 {
				v[i] = x / math.Sqrt(norm)
			}
		}
	}
	mix := f.track("mix")
	beatVectors := assemble([]block{
		newBlock(12, p.ChromaWeight, func(t0, t1 float64, v []float64) { l2(f.harmony(t0, t1), v) }),
		newBlock(12, p.BassChromaWeight, func(t0, t1 float64, v []float64) { l2(f.bassPC(t0, t1, nil), v) }),
		newBlock(5, p.BandWeight, func(t0, t1 float64, v []float64) {
			lo, hi := g.frames(t0, t1, len(mix.RMS))
			for b := range 5 {
				sum := 0.0
				for i := lo; i < hi; i++ {
					sum += mix.Bands[b][i] * mix.Bands[b][i]
				}
				v[b] = audioanalysis.DB(math.Sqrt(sum / float64(max(1, hi-lo))))
			}
		}),
		newBlock(4, p.StemWeight, func(t0, t1 float64, v []float64) {
			for k, name := range []string{"drums", "bass", "other", "vocals"} {
				v[k] = f.meanDB(name, t0, t1)
			}
		}),
	})
	// Bars: the four beat vectors of the bar plus a 16-step drum grid.
	drums := block{weight: p.DrumGridWeight}
	bars := make([][]float64, g.Bars())
	for b := range bars {
		drums.values = append(drums.values, make([]float64, 48))
		first := int(math.Round((g.BarStart(b) - g.OriginSeconds) / g.BeatSeconds))
		for k := range 4 {
			if i := first + k; i >= 0 && i < beats {
				bars[b] = append(bars[b], beatVectors[i]...)
			} else {
				bars[b] = append(bars[b], make([]float64, len(beatVectors[0]))...)
			}
		}
	}
	kinds := map[string]int{"kick": 0, "snare": 1, "hat": 2}
	for _, e := range f.track("drums").Events {
		k, ok := kinds[e.Kind]
		b := g.Bar(e.Time + g.SixteenthSeconds/2)
		if !ok || b >= len(bars) {
			continue
		}
		pos := min(15, max(0, g.Slot(e.Time)-g.Slot(g.BarStart(b))))
		v := drums.values[b]
		v[pos*3+k] = math.Max(v[pos*3+k], e.Strength)
	}
	for b, v := range assemble([]block{drums}) {
		bars[b] = append(bars[b], v...)
	}
	beatSSM, barSSM := SelfSimilarity(beatVectors), SelfSimilarity(bars)
	s.Novelty = FooteNovelty(beatSSM, p.NoveltyHalfWidth)
	s.Boundaries = Boundaries(s.Novelty, g, f.a.Cues, p.PeakRadius, p.PeakSigma)
	for i := range s.Novelty {
		s.Novelty[i] = r3(s.Novelty[i])
	}
	phrases, toFirst := Label(barSSM, p.PhraseBars, p.SameThreshold, p.VariantThreshold, false)
	for i, l := range phrases {
		first, last := i*p.PhraseBars, min(g.Bars(), (i+1)*p.PhraseBars)-1
		start := g.BarStart(first)
		sec := Section{Label: l, Start: r6(math.Max(0, start)), End: r6(math.Min(g.Duration, g.BarStart(last+1))), FirstBar: first, LastBar: last, SimilarityToFirst: toFirst[i]}
		sec.Cue = f.cueAt(start + g.BeatSeconds/2)
		if i == 0 {
			sec.Start = 0
		}
		s.Sections = append(s.Sections, sec)
	}
	barLabels, _ := Label(barSSM, 1, p.SameThreshold, p.VariantThreshold, true)
	s.Bars = make([]Bar, g.Bars())
	for b := range s.Bars {
		s.Bars[b] = Bar{Index: b, Label: barLabels[b], Section: phrases[b/p.PhraseBars]}
	}
	round := func(m [][]float64) [][]float64 {
		for _, row := range m {
			for j := range row {
				row[j] = r3(row[j])
			}
		}
		return m
	}
	s.SSM = SSM{round(beatSSM), round(barSSM)}
}

func (s *Story) motifs(f features) {
	g, p := s.Grid, s.Params.Motifs
	spans := []Span{}
	for _, c := range f.a.Cues {
		spans = append(spans, Span{c.Name, c.Start, c.End})
	}
	beatChroma := make([][12]float64, len(g.Beats))
	for i := range beatChroma {
		c := f.harmony(g.BeatStart(i), g.BeatStart(i+1))
		if f.meanDB("other", g.BeatStart(i), g.BeatStart(i+1)) >= s.Params.Chords.GateDB {
			beatChroma[i] = c
		}
	}
	chroma := FindChromaMotifs(beatChroma, g, p)
	all := []Motif{}
	for _, src := range []struct {
		name, track string
		notes       []StoryNote
	}{{"lead", "other", s.Lead.Clean}, {"bass", "bass", s.Bass.Clean}} {
		for _, m := range FindNoteMotifs(src.notes, g, src.name, p) {
			Corroborate(&m, chroma, g.BeatSeconds, p.ConfirmShare)
			Score(&m, src.notes, spans, f.energy(src.track), g, p)
			all = append(all, m)
		}
	}
	for _, m := range chroma {
		Score(&m, nil, spans, f.energy("other"), g, p)
		all = append(all, m)
	}
	s.Motifs = Rank(all, p)
	type ranked struct {
		id   string
		rank int
	}
	lm := []ranked{}
	for _, m := range s.Motifs {
		if m.Leitmotif {
			lm = append(lm, ranked{m.ID, m.Rank})
		}
	}
	sort.Slice(lm, func(i, j int) bool { return lm[i].rank < lm[j].rank })
	s.Leitmotifs = []string{}
	for _, m := range lm {
		s.Leitmotifs = append(s.Leitmotifs, m.id)
	}
}

func (s *Story) bars(f features) {
	g := s.Grid
	roles := map[string][]bool{}
	for _, r := range s.Roles {
		roles[r.Name] = r.BarActivity
	}
	for b := range s.Bars {
		bar := &s.Bars[b]
		start, end := g.BarStart(b), math.Min(g.Duration, g.BarStart(b+1))
		bar.Start, bar.End = r6(math.Max(0, start)), r6(end)
		if b == 0 {
			bar.Start = 0
		}
		bar.Cue = f.cueAt(start + g.BeatSeconds/2)
		bar.Chords, bar.Roles, bar.Motifs = []string{}, []string{}, []string{}
		for _, c := range s.Chords {
			if c.Start < end-1e-6 && c.End > start+1e-6 {
				bar.Chords = append(bar.Chords, c.Symbol)
			}
		}
		pc := f.bassPC(start, end, s.Bass.Clean)
		if pc != ([12]float64{}) {
			bar.BassRoot = PitchNames[argmax(pc)]
		}
		bar.StemEnergyDB = map[string]float64{}
		for _, name := range []string{"drums", "bass", "other", "vocals"} {
			bar.StemEnergyDB[name] = math.Round(barLevelDB(f.track(name), g, b)*100) / 100
		}
		for _, r := range s.Roles {
			if roles[r.Name][b] {
				bar.Roles = append(bar.Roles, r.Name)
			}
		}
		for _, id := range s.Leitmotifs {
			for _, m := range s.Motifs {
				if m.ID != id {
					continue
				}
				for _, o := range m.Occurrences {
					if o.Bar == b && !slices.Contains(bar.Motifs, id) {
						bar.Motifs = append(bar.Motifs, id)
					}
				}
			}
		}
	}
}
