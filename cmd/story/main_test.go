package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

// compactSHA256 pins public/analysis/story.json, which is not in git.
// Update it together with analysis/story.json when the analysis changes.
const compactSHA256 = "51d3e523cd24fee06bfa1050e8e13af7aedae80fd14a1f699032e775eddb54b5"

// TestGoldenPixelParade runs the real pipeline with the cmd/story defaults
// and compares every output with the committed files in analysis/. The
// provenance map (Go version, algo-dsp commit) is taken from the committed
// story.json, so only the analysis itself is compared.
func TestGoldenPixelParade(t *testing.T) {
	t.Chdir("../..")
	o := options{features: "analysis/features.json", wav: "public/audio/PixelParade.wav", stems: "analysis/stems/htdemucs/PixelParade", same: 0.6, variant: 0.35, leitmotifs: 4}
	for _, path := range []string{o.features, o.wav, filepath.Join(o.stems, "bass.wav")} {
		if _, err := os.Stat(path); err != nil {
			t.Skipf("PixelParade input %s is missing (stems are not in git: run scripts/separate.py, then bun run analyze): %v", path, err)
		}
	}
	committed, err := os.ReadFile("analysis/story.json")
	if err != nil {
		t.Fatal(err)
	}
	var head struct {
		Provenance map[string]string `json:"provenance"`
	}
	if err := json.Unmarshal(committed, &head); err != nil {
		t.Fatal(err)
	}

	s, a, err := analyze(o)
	if err != nil {
		t.Fatal(err)
	}
	s.Provenance = head.Provenance
	files, err := encode(s, a, o.gridAligned)
	if err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"story.json", "story.md", "PixelParade.mid", "story-ssm-beats.png", "story-ssm-bars.png"} {
		want, err := os.ReadFile(filepath.Join("analysis", name))
		if err != nil {
			t.Fatal(err)
		}
		if !bytes.Equal(files[name], want) {
			t.Errorf("%s differs from analysis/%s (%d vs %d bytes)", name, name, len(files[name]), len(want))
		}
	}
	if h := sha256.Sum256(files[compactName]); hex.EncodeToString(h[:]) != compactSHA256 {
		t.Errorf("compact story.json sha256 %x, want %s", h, compactSHA256)
	}
}
