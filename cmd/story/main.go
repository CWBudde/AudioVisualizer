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
	"github.com/cwbudde/AudioVisualizer/internal/smf"
	"github.com/cwbudde/AudioVisualizer/internal/story"
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

func run() error {
	featuresPath := flag.String("features", "analysis/features.json", "feature analysis from cmd/analyze")
	wavPath := flag.String("wav", "public/audio/PixelParade.wav", "source WAV (hash-checked)")
	stems := flag.String("stems", "analysis/stems/htdemucs/PixelParade", "stem directory; bass.wav is tracked for pitch")
	out := flag.String("out", "analysis", "output directory for story.json, story.md, PNGs and MIDI")
	public := flag.String("public", "public/analysis", "output directory for the compact story.json")
	gridAligned := flag.Bool("midi-grid-aligned", false, "put the first beat at MIDI tick 0 instead of audio time 0")
	same := flag.Float64("same", 0.6, "phrase/bar similarity for the same label")
	variant := flag.Float64("variant", 0.35, "phrase/bar similarity for a primed variant label")
	leitmotifs := flag.Int("leitmotifs", 4, "maximum number of leitmotifs")
	flag.Parse()

	data, err := os.ReadFile(*featuresPath)
	if err != nil {
		return err
	}
	var a audioanalysis.Analysis
	if err := json.Unmarshal(data, &a); err != nil {
		return err
	}
	if a.SchemaVersion != 2 || a.Hop != audioanalysis.Hop || a.SampleRate != audioanalysis.SampleRate {
		return fmt.Errorf("unsupported analysis schema or timing")
	}
	mix, bassTrack := a.Tracks["mix"], a.Tracks["bass"]
	if mix == nil || bassTrack == nil {
		return fmt.Errorf("missing mix or bass track")
	}
	wav, err := os.ReadFile(*wavPath)
	if err != nil {
		return err
	}
	if sha(wav) != mix.Source.SHA256 {
		return fmt.Errorf("source hash does not match analysis")
	}
	bass, err := audioanalysis.Load(filepath.Join(*stems, "bass.wav"))
	if err != nil {
		return err
	}
	if bass.Source.SHA256 != bassTrack.Source.SHA256 {
		return fmt.Errorf("bass stem hash does not match analysis")
	}
	bassMelody, err := audioanalysis.AnalyzeMelody(bass, bassTrack.Events, audioanalysis.BassMelodyOptions()...)
	if err != nil {
		return err
	}

	p := story.DefaultParams()
	p.Structure.SameThreshold, p.Structure.VariantThreshold = *same, *variant
	p.Motifs.Leitmotifs = *leitmotifs
	p.MIDIGridAligned = *gridAligned
	p.MIDITicksPerSecs = a.Rhythm.BPM / 60 * smf.PPQ
	s, err := story.Build(&a, bassMelody, p)
	if err != nil {
		return err
	}
	s.Sources = []story.SourceRef{
		{Name: "mix", Path: *wavPath, SHA256: mix.Source.SHA256},
		{Name: "features", Path: *featuresPath, SHA256: sha(data)},
		{Name: "bass", Path: filepath.Join(*stems, "bass.wav"), SHA256: bass.Source.SHA256},
	}
	s.Provenance = map[string]string{"go": runtime.Version(), "bassMelody": "audioanalysis.AnalyzeMelody with BassMelodyOptions and bass-stem onsets", "lead": "features.json tracks.other.melody"}
	if v, err := exec.Command("git", "-C", "../algo-dsp", "rev-parse", "HEAD").Output(); err == nil {
		s.Provenance["algo-dsp"] = strings.TrimSpace(string(v))
	}

	if err := os.MkdirAll(*out, 0755); err != nil {
		return err
	}
	if err := os.MkdirAll(*public, 0755); err != nil {
		return err
	}
	full, err := json.Marshal(s)
	if err != nil {
		return err
	}
	compact, err := json.Marshal(s.Compact(mix.Source.SHA256))
	if err != nil {
		return err
	}
	var midi bytes.Buffer
	if err := smf.Write(&midi, s.MIDI(a.Tracks["drums"].Events, *gridAligned)); err != nil {
		return err
	}
	g := s.Grid
	beatMarks, barMarks := []float64{}, []float64{}
	for _, c := range a.Cues {
		beatMarks = append(beatMarks, (c.Start-g.OriginSeconds)/g.BeatSeconds)
		barMarks = append(barMarks, g.BarPosition(c.Start))
	}
	var beatsPNG, barsPNG bytes.Buffer
	if err := story.WriteSSMPNG(&beatsPNG, s.SSM.Beats, 4, 4, beatMarks); err != nil {
		return err
	}
	if err := story.WriteSSMPNG(&barsPNG, s.SSM.Bars, 16, 4, barMarks); err != nil {
		return err
	}
	for path, content := range map[string][]byte{
		filepath.Join(*out, "story.json"):          append(full, '\n'),
		filepath.Join(*out, "story.md"):            []byte(s.Markdown()),
		filepath.Join(*out, "PixelParade.mid"):     midi.Bytes(),
		filepath.Join(*out, "story-ssm-beats.png"): beatsPNG.Bytes(),
		filepath.Join(*out, "story-ssm-bars.png"):  barsPNG.Bytes(),
		filepath.Join(*public, "story.json"):       compact,
	} {
		if err := os.WriteFile(path, content, 0644); err != nil {
			return err
		}
	}
	fmt.Printf("Key %s (r %.3f, runner-up %s); %d chords; phrases", s.Key.Name, s.Key.Correlation, s.Key.RunnerUp, len(s.Chords))
	for _, sec := range s.Sections {
		fmt.Printf(" %s", sec.Label)
	}
	fmt.Printf("; leitmotifs %v\n", s.Leitmotifs)
	fmt.Printf("Wrote %s/{story.json,story.md,PixelParade.mid,story-ssm-beats.png,story-ssm-bars.png} and %s/story.json (%d bytes)\n", *out, *public, len(compact))
	return nil
}
