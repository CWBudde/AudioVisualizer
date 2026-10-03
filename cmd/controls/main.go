// controls exports the measured Go timeline without diagnostic spectra.
package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/cwbudde/AudioVisualizer/internal/audioanalysis"
)

type track struct {
	Source   audioanalysis.Source  `json:"source"`
	Energy   []float64             `json:"energyControl"`
	Bands    [5][]float64          `json:"bandControls"`
	Centroid []float64             `json:"centroidHz"`
	Width    []float64             `json:"stereoWidth"`
	Events   []audioanalysis.Event `json:"onsets"`
	Melody   *audioanalysis.Melody `json:"melody,omitempty"`
}
type controls struct {
	Schema  int                      `json:"schemaVersion"`
	Step    float64                  `json:"stepSeconds"`
	Rhythm  audioanalysis.Rhythm     `json:"rhythm"`
	Cues    []audioanalysis.Cue      `json:"cues"`
	Silence []audioanalysis.Interval `json:"silence"`
	Tracks  map[string]track         `json:"tracks"`
}

func run() error {
	data, err := os.ReadFile("analysis/features.json")
	if err != nil {
		return err
	}
	var a audioanalysis.Analysis
	if err := json.Unmarshal(data, &a); err != nil {
		return err
	}
	if a.SchemaVersion != 2 || a.Hop <= 0 || a.SampleRate <= 0 {
		return fmt.Errorf("unsupported analysis schema or timing")
	}
	mix := a.Tracks["mix"]
	if mix == nil {
		return fmt.Errorf("missing mix")
	}
	wav, err := os.ReadFile("public/audio/PixelParade.wav")
	if err != nil {
		return err
	}
	hash := sha256.Sum256(wav)
	if hex.EncodeToString(hash[:]) != mix.Source.SHA256 {
		return fmt.Errorf("source hash does not match analysis")
	}
	c := controls{2, float64(a.Hop) / float64(a.SampleRate), a.Rhythm, a.Cues, a.Silence, make(map[string]track)}
	for _, name := range []string{"mix", "drums", "bass", "other", "vocals"} {
		t := a.Tracks[name]
		if t == nil {
			return fmt.Errorf("missing %s", name)
		}
		c.Tracks[name] = track{t.Source, t.Energy, t.BandControls, t.Centroid, t.Width, t.Events, t.Melody}
	}
	data, err = json.Marshal(c)
	if err != nil {
		return err
	}
	path := "public/analysis/controls.json"
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	if err := os.WriteFile(path, data, 0644); err != nil {
		return err
	}
	fmt.Printf("Exported %s (%d bytes), original %s\n", path, len(data), mix.Source.SHA256)
	return nil
}
func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
