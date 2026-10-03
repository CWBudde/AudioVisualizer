package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"runtime"

	aa "github.com/cwbudde/AudioVisualizer/internal/audioanalysis"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run() error {
	input := flag.String("input", "public/audio/PixelParade.wav", "source WAV")
	stemsDir := flag.String("stems", "analysis/stems/htdemucs/PixelParade", "directory of four stems")
	output := flag.String("out", "analysis", "analysis output directory")
	prior := flag.Float64("tempo-prior", 105, "tempo hypothesis to refine; broad alternatives are also reported")
	mixOnly := flag.Bool("mix-only", false, "explicitly omit stem analysis")
	flag.Parse()
	if *prior < 63 || *prior > 177 || math.IsNaN(*prior) {
		return fmt.Errorf("tempo-prior must be between 63 and 177")
	}
	if err := os.MkdirAll(*output, 0755); err != nil {
		return err
	}
	a := &aa.Analysis{SchemaVersion: 2, SampleRate: aa.SampleRate, FFTSize: aa.FFTSize, Hop: aa.Hop, BandEdges: aa.BandEdges, SpectrogramBins: aa.SpectrogramBins, Tracks: map[string]*aa.Track{}, Provenance: map[string]string{"go": runtime.Version(), "normalization": "per-track active-sample 95th percentile, -80 dBFS gate, attack 10 ms, release 150 ms (energy) / 120 ms (bands)", "resampling": "algo-dsp QualityBest, tail flush, fractional FIR delay compensation", "stemMode": "required"}}
	mods, err := aa.ModuleProvenance("algo-dsp", "algo-fft", "algo-vecmath", "algo-approx", "wav")
	if err != nil {
		return err
	}
	for k, v := range mods {
		a.Provenance[k] = v
	}
	mix, err := aa.Load(*input)
	if err != nil {
		return err
	}
	if mix.Source.SHA256 != "20a7f80e5de0e2052071fcba6a838249437d60deb42991b42ed03f1cd955066d" {
		return fmt.Errorf("PixelParade source checksum mismatch")
	}
	if a.SpectrogramBinHz, err = aa.SpectrogramBinHz(); err != nil {
		return err
	}
	t, err := aa.Analyze(mix)
	if err != nil {
		return err
	}
	a.Tracks["mix"] = t
	fmt.Printf("mix: %.3f s, RMS %.2f dBFS, %d events\n", t.Source.Duration, t.Source.RMSDB, len(t.Events))
	stemAudio := []*aa.Audio{}
	if !*mixOnly {
		for _, name := range []string{"drums", "bass", "other", "vocals"} {
			s, err := aa.Load(filepath.Join(*stemsDir, name+".wav"))
			if err != nil {
				return fmt.Errorf("stem %s: %w (use -mix-only only for preliminary analysis)", name, err)
			}
			track, err := aa.Analyze(s)
			if err != nil {
				return err
			}
			a.Tracks[name] = track
			stemAudio = append(stemAudio, s)
			fmt.Printf("%s: %.3f s, RMS %.2f dBFS, %d events\n", name, s.Source.Duration, s.Source.RMSDB, len(track.Events))
		}
		a.Alignment, err = aa.CheckAlignment(mix, stemAudio)
		if err != nil {
			return err
		}
		if math.Abs(a.Alignment.BestLagMS) > 0.5 || a.Alignment.Correlation < 0.95 {
			return fmt.Errorf("stem alignment failed: %+v", a.Alignment)
		}
	} else {
		a.Provenance["stemMode"] = "mix-only"
	}
	rhythmTrack := a.Tracks["drums"]
	if rhythmTrack == nil {
		rhythmTrack = t
	}
	if a.Rhythm, err = aa.EstimateRhythm(rhythmTrack, *prior); err != nil {
		return err
	}
	if drums, bass := a.Tracks["drums"], a.Tracks["bass"]; drums != nil && bass != nil {
		if err := aa.ClassifyDrums(drums); err != nil {
			return err
		}
		a.Rhythm.Downbeat = aa.EstimateDownbeat(a.Rhythm, drums.Events, bass.Events)
		a.Rhythm.Meter = fmt.Sprintf("4/4; downbeat at beat index %d from kick/bass attack accents", a.Rhythm.Downbeat)
	}
	if other := a.Tracks["other"]; other != nil {
		if other.Melody, err = aa.AnalyzeMelody(stemAudio[2], other.Events); err != nil {
			return err
		}
		fmt.Printf("other melody: %d notes\n", len(other.Melody.Notes))
	}
	if a.Silence, err = aa.FindSilence(mix); err != nil {
		return err
	}
	a.Cues = aa.PixelParadeCues(mix.Source.Duration, a.Silence)
	for _, track := range a.Tracks {
		aa.QuantizeTrack(track)
	}
	data, err := json.Marshal(a)
	if err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(*output, "features.json"), append(data, '\n'), 0644); err != nil {
		return err
	}
	if err := aa.WriteReport(*output, a); err != nil {
		return err
	}
	fmt.Printf("Tempo %.3f BPM; beat origin %.3f s; median onset subdivision error %.2f ms\n", a.Rhythm.BPM, a.Rhythm.BeatOrigin, a.Rhythm.MedianOnsetErrorMS)
	if a.Alignment != nil {
		fmt.Printf("Stem sum correlation %.6f, lag %.3f ms, residual %.2f dBFS\n", a.Alignment.Correlation, a.Alignment.BestLagMS, a.Alignment.ResidualRMSDB)
	}
	fmt.Printf("Wrote %s/features.json, sections.csv, report.md, overview.html\n", *output)
	return nil
}
