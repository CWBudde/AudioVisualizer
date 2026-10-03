package story

import (
	"fmt"
	"math"
	"slices"
	"sort"

	"github.com/cwbudde/AudioVisualizer/internal/audioanalysis"
	"github.com/cwbudde/algo-dsp/measure/music/features"
	"github.com/cwbudde/algo-dsp/measure/music/harmony"
	"github.com/cwbudde/algo-dsp/measure/music/motif"
	"github.com/cwbudde/algo-dsp/measure/music/structure"
	"github.com/cwbudde/midi/smf"
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

// input gives windowed access to the stored tracks and the bass melody.
type input struct {
	a    *audioanalysis.Analysis
	bass *audioanalysis.Melody
	g    Grid
}

func (in input) track(name string) *audioanalysis.Track { return in.a.Tracks[name] }

// windows pools the other-stem chroma (each frame weighted by its RMS,
// because the stored chroma is normalised per frame) over spans. Bass is
// voicing-weighted bass chroma (in seconds) plus clean bass note overlap ×
// strength; LevelDB is the other-stem level.
func (in input) windows(spans []harmony.Span, bassNotes []StoryNote) ([]harmony.Window, error) {
	other := in.track("other")
	return harmony.Windows(other.Melody.Chroma, other.RMS, frameRate, spans,
		harmony.WithBassChroma(in.bass.Chroma, in.bass.Voicing), harmony.WithBassNotes(melodyNotes(bassNotes)))
}

// levels runs features.Activity on frame-level series (RMS or band levels)
// over spans; SpanDB is each span's RMS level in dBFS.
func levels(series map[string][]float64, spans []harmony.Span, opts ...features.ActivityOption) (map[string]features.TrackActivity, error) {
	intervals := make([]features.Interval, len(spans))
	for i, s := range spans {
		intervals[i] = features.Interval(s) // harmony.Span mirrors features.Interval field for field
	}
	return features.Activity(series, frameRate, intervals, opts...)
}

func (in input) rms(names ...string) map[string][]float64 {
	out := map[string][]float64{}
	for _, name := range names {
		out[name] = in.track(name).RMS
	}
	return out
}

func (in input) energy(name string) func(t0, t1 float64) float64 {
	return func(t0, t1 float64) float64 {
		t := in.track(name)
		lo, hi := frames(t0, t1, len(t.Energy))
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

func (in input) cueAt(t float64) string {
	for _, c := range in.a.Cues {
		if t >= c.Start && t < c.End {
			return c.Name
		}
	}
	return ""
}

func argmax(c [12]float64) int {
	best := 0
	for i, v := range c {
		if v > c[best] {
			best = i
		}
	}
	return best
}

var stems = []string{"drums", "bass", "other", "vocals"}

// Build runs the whole pipeline on a feature analysis plus the bass-stem
// melody tracked with melody.BassPreset. It sets p.MIDITicksPerSecs from the
// grid tempo.
func Build(a *audioanalysis.Analysis, bassMelody *audioanalysis.Melody, p Params) (*Story, error) {
	for _, name := range []string{"mix", "drums", "bass", "other", "vocals"} {
		if a.Tracks[name] == nil {
			return nil, fmt.Errorf("missing track %s", name)
		}
	}
	if a.Tracks["other"].Melody == nil || bassMelody == nil {
		return nil, fmt.Errorf("missing lead or bass melody")
	}
	g, err := NewGrid(a.Rhythm, a.Tracks["mix"].Source.Duration)
	if err != nil {
		return nil, err
	}
	in := input{a, bassMelody, g}
	p.MIDITicksPerSecs = g.BPM() / 60 * smf.PPQ
	s := &Story{SchemaVersion: 1, Params: p, Grid: g, Cues: a.Cues, onsets: map[string][]audioanalysis.Event{"drums": a.Tracks["drums"].Events, "bass": a.Tracks["bass"].Events}}
	if s.Lead.Clean, s.Lead.Raw, err = CleanNotes(a.Tracks["other"].Melody.Notes, g, p.Lead); err != nil {
		return nil, err
	}
	if s.Bass.Clean, s.Bass.Raw, err = CleanNotes(bassMelody.Notes, g, p.Bass); err != nil {
		return nil, err
	}
	for i := range s.Bass.Clean {
		s.Bass.Clean[i].Voice = "bass"
	}

	// Key: RMS-weighted harmony chroma plus duration-weighted bass notes;
	// bass at the first and last bar of every cue is the tonic evidence.
	var bassNotes, profile, edges [12]float64
	for _, n := range s.Bass.Clean {
		bassNotes[n.MIDI%12] += n.End - n.Start
	}
	spans := []harmony.Span{{Start: 0, End: g.Duration()}}
	for _, c := range a.Cues {
		if c.End-c.Start < g.BarSeconds() {
			continue
		}
		for _, b := range []int{g.Bar(c.Start + 1e-3), g.Bar(c.End - 1e-3)} {
			spans = append(spans, harmony.Span{Start: g.BarStart(b), End: g.BarStart(b + 1)})
		}
	}
	keyWindows, err := in.windows(spans, s.Bass.Clean)
	if err != nil {
		return nil, err
	}
	h, bn := harmony.Normalize(keyWindows[0].Chroma), harmony.Normalize(bassNotes)
	for i := range profile {
		profile[i] = h[i] + p.KeyBassWeight*bn[i]
	}
	for _, w := range keyWindows[1:] {
		pc := harmony.Normalize(w.Bass)
		for i := range edges {
			edges[i] += pc[i]
		}
	}
	key, ke, err := estimateKey(profile, edges, p.KeyRelativeTie)
	if err != nil {
		return nil, err
	}
	s.Key = ke

	// Chords per half bar.
	spans = nil
	step := float64(p.Chords.BeatsPerChord) * g.BeatSeconds()
	for b := range g.Bars() {
		for t := g.BarStart(b); t < g.BarStart(b+1)-1e-6 && t < g.Duration(); t += step {
			spans = append(spans, harmony.Span{Start: t, End: math.Min(t+step, g.Duration())})
		}
	}
	chordWindows, err := in.windows(spans, s.Bass.Clean)
	if err != nil {
		return nil, err
	}
	if s.Chords, err = detectChords(chordWindows, key, g, p.Chords); err != nil {
		return nil, err
	}

	beats, err := in.windows(g.beatSpans(), nil)
	if err != nil {
		return nil, err
	}
	if err := s.structure(in, beats); err != nil {
		return nil, err
	}
	if err := s.motifs(in, beats); err != nil {
		return nil, err
	}
	active, err := levels(in.rms(stems...), g.barSpans(), features.WithActivityThreshold(p.RoleActiveDB))
	if err != nil {
		return nil, err
	}
	s.Roles = Roles(active, g, s.Lead.Clean, s.Bass.Clean, s.Chords)
	return s, s.bars(in, active)
}

func (s *Story) structure(in input, beats []harmony.Window) error {
	g, p := s.Grid, s.Params.Structure
	l2 := func(c [12]float64) []float64 {
		v, norm := make([]float64, 12), 0.0
		for _, x := range c {
			norm += x * x
		}
		for i, x := range c {
			if norm > 0 {
				v[i] = x / math.Sqrt(norm)
			}
		}
		return v
	}
	mix := in.track("mix")
	series := in.rms(stems...)
	for b := range 5 {
		series[fmt.Sprint("band", b)] = mix.Bands[b]
	}
	beatDB, err := levels(series, g.beatSpans())
	if err != nil {
		return err
	}
	chroma, bass, bands, stemDB := [][]float64{}, [][]float64{}, [][]float64{}, [][]float64{}
	for i, w := range beats {
		chroma, bass = append(chroma, l2(w.Chroma)), append(bass, l2(w.Bass))
		bands, stemDB = append(bands, make([]float64, 5)), append(stemDB, make([]float64, 4))
		for b := range 5 {
			bands[i][b] = beatDB[fmt.Sprint("band", b)].SpanDB[i]
		}
		for k, name := range stems {
			stemDB[i][k] = beatDB[name].SpanDB[i]
		}
	}
	beatVectors, err := structure.Blocks([]structure.Block{{Rows: chroma, Weight: p.ChromaWeight}, {Rows: bass, Weight: p.BassChromaWeight},
		{Rows: bands, Weight: p.BandWeight}, {Rows: stemDB, Weight: p.StemWeight}})
	if err != nil {
		return err
	}
	// Bars: the four beat vectors of the bar plus a 16-step drum grid.
	drums := make([][]float64, g.Bars())
	bars := make([][]float64, g.Bars())
	for b := range bars {
		drums[b] = make([]float64, 48)
		first := int(math.Round((g.BarStart(b) - g.Origin()) / g.BeatSeconds()))
		for k := range 4 {
			if i := first + k; i >= 0 && i < len(beats) {
				bars[b] = append(bars[b], beatVectors[i]...)
			} else {
				bars[b] = append(bars[b], make([]float64, len(beatVectors[0]))...)
			}
		}
	}
	kinds := map[string]int{"kick": 0, "snare": 1, "hat": 2}
	for _, e := range in.track("drums").Events {
		k, ok := kinds[e.Kind]
		b := g.Bar(e.Time + g.SlotSeconds()/2)
		if !ok || b >= len(bars) {
			continue
		}
		pos := min(15, max(0, g.Slot(e.Time)-g.Slot(g.BarStart(b))))
		drums[b][pos*3+k] = math.Max(drums[b][pos*3+k], e.Strength)
	}
	drumVectors, err := structure.Blocks([]structure.Block{{Rows: drums, Weight: p.DrumGridWeight}})
	if err != nil {
		return err
	}
	for b, v := range drumVectors {
		bars[b] = append(bars[b], v...)
	}
	beatSSM, err := structure.SelfSimilarity(beatVectors)
	if err != nil {
		return err
	}
	barSSM, err := structure.SelfSimilarity(bars)
	if err != nil {
		return err
	}
	if s.Novelty, err = structure.FooteNovelty(beatSSM, p.NoveltyHalfWidth); err != nil {
		return err
	}
	if s.Boundaries, err = boundaries(s.Novelty, g, in.a.Cues, p.PeakRadius, p.PeakSigma); err != nil {
		return err
	}
	for i := range s.Novelty {
		s.Novelty[i] = r3(s.Novelty[i])
	}
	phrases, toFirst, err := label(barSSM, p.PhraseBars, p.SameThreshold, p.VariantThreshold)
	if err != nil {
		return err
	}
	for i, l := range phrases {
		first, last := i*p.PhraseBars, min(g.Bars(), (i+1)*p.PhraseBars)-1
		start := g.BarStart(first)
		sec := Section{Label: l, Start: r6(math.Max(0, start)), End: r6(math.Min(g.Duration(), g.BarStart(last+1))), FirstBar: first, LastBar: last, SimilarityToFirst: toFirst[i]}
		sec.Cue = in.cueAt(start + g.BeatSeconds()/2)
		if i == 0 {
			sec.Start = 0
		}
		s.Sections = append(s.Sections, sec)
	}
	barLabels, _, err := label(barSSM, 1, p.SameThreshold, p.VariantThreshold, structure.WithLowercase())
	if err != nil {
		return err
	}
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
	return nil
}

// motifs finds chroma motifs first (other-stem beat chroma, silent below the
// chord gate), then lead and bass note motifs corroborated by them, and
// ranks all of them.
func (s *Story) motifs(in input, beats []harmony.Window) error {
	g, opts := s.Grid, s.Params.Motifs.options()
	spans := []motif.Span{}
	for _, c := range in.a.Cues {
		spans = append(spans, motif.Span{Name: c.Name, Start: c.Start, End: c.End})
	}
	beatChroma := make([][12]float64, len(beats))
	for i, w := range beats {
		if w.LevelDB >= s.Params.Chords.GateDB {
			beatChroma[i] = w.Chroma
		}
	}
	chroma, err := motif.FindChromaMotifs(beatChroma, g.Grid, opts...)
	if err != nil {
		return err
	}
	all := []motif.Motif{}
	for _, src := range []struct {
		name, track string
		notes       []StoryNote
	}{{"lead", "other", s.Lead.Clean}, {"bass", "bass", s.Bass.Clean}} {
		notes := cleanNotes(src.notes)
		found, err := motif.FindNoteMotifs(notes, g.Grid, src.name, opts...)
		if err != nil {
			return err
		}
		for i := range found {
			if err := motif.Corroborate(&found[i], chroma, g.Grid, opts...); err != nil {
				return err
			}
			if err := motif.Score(&found[i], notes, spans, in.energy(src.track), g.Grid, opts...); err != nil {
				return err
			}
		}
		all = append(all, found...)
	}
	for i := range chroma {
		if err := motif.Score(&chroma[i], nil, spans, in.energy("other"), g.Grid, opts...); err != nil {
			return err
		}
	}
	ranked, err := motif.Rank(append(all, chroma...), opts...)
	if err != nil {
		return err
	}
	s.Motifs = make([]Motif, len(ranked))
	for i, m := range ranked {
		s.Motifs[i] = toMotif(m)
	}
	type rankedID struct {
		id   string
		rank int
	}
	lm := []rankedID{}
	for _, m := range s.Motifs {
		if m.Leitmotif {
			lm = append(lm, rankedID{m.ID, m.Rank})
		}
	}
	sort.Slice(lm, func(i, j int) bool { return lm[i].rank < lm[j].rank })
	s.Leitmotifs = []string{}
	for _, m := range lm {
		s.Leitmotifs = append(s.Leitmotifs, m.id)
	}
	return nil
}

func (s *Story) bars(in input, active map[string]features.TrackActivity) error {
	g := s.Grid
	roles := map[string][]bool{}
	for _, r := range s.Roles {
		roles[r.Name] = r.BarActivity
	}
	spans := make([]harmony.Span, len(s.Bars))
	for b := range spans {
		spans[b] = harmony.Span{Start: g.BarStart(b), End: math.Min(g.Duration(), g.BarStart(b+1))}
	}
	windows, err := in.windows(spans, s.Bass.Clean)
	if err != nil {
		return err
	}
	for b := range s.Bars {
		bar := &s.Bars[b]
		start, end := spans[b].Start, spans[b].End
		bar.Start, bar.End = r6(math.Max(0, start)), r6(end)
		if b == 0 {
			bar.Start = 0
		}
		bar.Cue = in.cueAt(start + g.BeatSeconds()/2)
		bar.Chords, bar.Roles, bar.Motifs = []string{}, []string{}, []string{}
		for _, c := range s.Chords {
			if c.Start < end-1e-6 && c.End > start+1e-6 {
				bar.Chords = append(bar.Chords, c.Symbol)
			}
		}
		if pc := windows[b].Bass; pc != ([12]float64{}) {
			bar.BassRoot = PitchNames[argmax(pc)]
		}
		bar.StemEnergyDB = map[string]float64{}
		for _, name := range stems {
			bar.StemEnergyDB[name] = math.Round(active[name].SpanDB[b]*100) / 100
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
	return nil
}
