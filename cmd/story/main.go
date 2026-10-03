// story derives the musical skeleton (key, chords, structure, motifs, roles)
// from the stored analysis and the bass stem, and exports it as JSON, a
// Markdown report, SSM images and a MIDI file.
package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/cwbudde/AudioVisualizer/internal/audioanalysis"
	"github.com/cwbudde/AudioVisualizer/internal/story"
	"github.com/cwbudde/algo-dsp/measure/music/melody"
	"github.com/cwbudde/midi/smf"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func sha(data []byte) string {
	h := sha256.Sum256(data)
	return hex.EncodeToString(h[:])
}

// options are the inputs and analysis settings of one run.
type options struct {
	features, wav, stems string
	gridAligned          bool
	same, variant        float64
	leitmotifs           int
}

func run() error {
	var o options
	flag.StringVar(&o.features, "features", "analysis/features.json", "feature analysis from cmd/analyze")
	flag.StringVar(&o.wav, "wav", "public/audio/PixelParade.wav", "source WAV (hash-checked)")
	flag.StringVar(&o.stems, "stems", "analysis/stems/htdemucs/PixelParade", "stem directory; bass.wav is tracked for pitch")
	out := flag.String("out", "analysis", "output directory for story.json, story.md, PNGs and MIDI")
	public := flag.String("public", "public/analysis", "output directory for the compact story.json")
	flag.BoolVar(&o.gridAligned, "midi-grid-aligned", false, "put the first beat at MIDI tick 0 instead of audio time 0")
	flag.Float64Var(&o.same, "same", 0.6, "phrase/bar similarity for the same label")
	flag.Float64Var(&o.variant, "variant", 0.35, "phrase/bar similarity for a primed variant label")
	flag.IntVar(&o.leitmotifs, "leitmotifs", 4, "maximum number of leitmotifs")
	flag.Parse()

	s, a, err := analyze(o)
	if err != nil {
		return err
	}
	files, err := encode(s, a, o.gridAligned)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(*out, 0755); err != nil {
		return err
	}
	if err := os.MkdirAll(*public, 0755); err != nil {
		return err
	}
	for name, content := range files {
		path := filepath.Join(*out, name)
		if name == compactName {
			path = filepath.Join(*public, "story.json")
		}
		if err := os.WriteFile(path, content, 0644); err != nil {
			return err
		}
	}
	compact := files[compactName]
	fmt.Printf("Key %s (r %.3f, runner-up %s); %d chords; phrases", s.Key.Name, s.Key.Correlation, s.Key.RunnerUp, len(s.Chords))
	for _, sec := range s.Sections {
		fmt.Printf(" %s", sec.Label)
	}
	fmt.Printf("; leitmotifs %v\n", s.Leitmotifs)
	fmt.Printf("Wrote %s/{story.json,story.md,PixelParade.mid,story-ssm-beats.png,story-ssm-bars.png} and %s/story.json (%d bytes)\n", *out, *public, len(compact))
	return nil
}

// analyze loads and hash-checks the inputs, tracks the bass stem and builds
// the story with sources and provenance.
func analyze(o options) (*story.Story, *audioanalysis.Analysis, error) {
	data, err := os.ReadFile(o.features)
	if err != nil {
		return nil, nil, err
	}
	var a audioanalysis.Analysis
	if err := json.Unmarshal(data, &a); err != nil {
		return nil, nil, err
	}
	if a.SchemaVersion != 2 || a.Hop != audioanalysis.Hop || a.SampleRate != audioanalysis.SampleRate {
		return nil, nil, fmt.Errorf("unsupported analysis schema or timing")
	}
	mix, bassTrack := a.Tracks["mix"], a.Tracks["bass"]
	if mix == nil || bassTrack == nil {
		return nil, nil, fmt.Errorf("missing mix or bass track")
	}
	wav, err := os.ReadFile(o.wav)
	if err != nil {
		return nil, nil, err
	}
	if sha(wav) != mix.Source.SHA256 {
		return nil, nil, fmt.Errorf("source hash does not match analysis")
	}
	bass, err := audioanalysis.Load(filepath.Join(o.stems, "bass.wav"))
	if err != nil {
		return nil, nil, err
	}
	if bass.Source.SHA256 != bassTrack.Source.SHA256 {
		return nil, nil, fmt.Errorf("bass stem hash does not match analysis")
	}
	bassMelody, err := audioanalysis.AnalyzeMelody(bass, bassTrack.Events, melody.BassPreset()...)
	if err != nil {
		return nil, nil, err
	}

	p := story.DefaultParams()
	p.Structure.SameThreshold, p.Structure.VariantThreshold = o.same, o.variant
	p.Motifs.Leitmotifs = o.leitmotifs
	p.MIDIGridAligned = o.gridAligned
	s, err := story.Build(&a, bassMelody, p)
	if err != nil {
		return nil, nil, err
	}
	s.Sources = []story.SourceRef{
		{Name: "mix", Path: o.wav, SHA256: mix.Source.SHA256},
		{Name: "features", Path: o.features, SHA256: sha(data)},
		{Name: "bass", Path: filepath.Join(o.stems, "bass.wav"), SHA256: bass.Source.SHA256},
	}
	s.Provenance = map[string]string{"go": runtime.Version(), "bassMelody": "audioanalysis.AnalyzeMelody with melody.BassPreset and bass-stem onsets", "lead": "features.json tracks.other.melody"}
	if v, err := exec.Command("git", "-C", "../algo-dsp", "rev-parse", "HEAD").Output(); err == nil {
		s.Provenance["algo-dsp"] = strings.TrimSpace(string(v))
	}
	return s, &a, nil
}

// compactName is the key of the compact public story.json in encode's result.
const compactName = "compact story.json"

// encode renders the story outputs by file name in the output directory:
// story.json, story.md, the MIDI file, both SSM images and, under
// compactName, the compact story.json for the public directory.
func encode(s *story.Story, a *audioanalysis.Analysis, gridAligned bool) (map[string][]byte, error) {
	full, err := json.Marshal(s)
	if err != nil {
		return nil, err
	}
	compact, err := json.Marshal(s.Compact(a.Tracks["mix"].Source.SHA256))
	if err != nil {
		return nil, err
	}
	var midi bytes.Buffer
	if err := smf.Write(&midi, s.MIDI(a.Tracks["drums"].Events, gridAligned)); err != nil {
		return nil, err
	}
	g := s.Grid
	beatMarks, barMarks := []float64{}, []float64{}
	for _, c := range a.Cues {
		beatMarks = append(beatMarks, (c.Start-g.Origin())/g.BeatSeconds())
		barMarks = append(barMarks, g.BarPosition(c.Start))
	}
	var beatsPNG, barsPNG bytes.Buffer
	if err := story.WriteSSMPNG(&beatsPNG, s.SSM.Beats, 4, 4, beatMarks); err != nil {
		return nil, err
	}
	if err := story.WriteSSMPNG(&barsPNG, s.SSM.Bars, 16, 4, barMarks); err != nil {
		return nil, err
	}
	return map[string][]byte{
		"story.json":          append(full, '\n'),
		"story.md":            []byte(s.Markdown()),
		"PixelParade.mid":     midi.Bytes(),
		"story-ssm-beats.png": beatsPNG.Bytes(),
		"story-ssm-bars.png":  barsPNG.Bytes(),
		compactName:           compact,
	}, nil
}
