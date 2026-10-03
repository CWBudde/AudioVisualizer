// verifyrender checks the encoded deliverable against the original soundtrack.
package main

import (
	"encoding/binary"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"os/exec"
	"strconv"

	"github.com/cwbudde/AudioVisualizer/internal/audioanalysis"
)

type stream struct {
	Type        string `json:"codec_type"`
	Codec       string `json:"codec_name"`
	Width       int    `json:"width"`
	Height      int    `json:"height"`
	PixelFormat string `json:"pix_fmt"`
	FrameRate   string `json:"r_frame_rate"`
	Frames      string `json:"nb_frames"`
	Channels    int    `json:"channels"`
	SampleRate  string `json:"sample_rate"`
	Start       string `json:"start_time"`
	Duration    string `json:"duration"`
}
type window struct {
	Start       float64 `json:"startSeconds"`
	End         float64 `json:"endSeconds"`
	LagMS       float64 `json:"bestLagMS"`
	Correlation float64 `json:"correlation"`
	GainDB      float64 `json:"gainDB"`
}

func stats(a, b *audioanalysis.Audio, start, end, lag int) (float64, float64) {
	var ab, aa, bb float64
	for i := start; i < end; i += 16 {
		j := i + lag
		if j < 0 || j >= len(b.Channels[0]) {
			continue
		}
		for ch := range a.Channels {
			x, y := a.Channels[ch][i], b.Channels[ch][j]
			ab += x * y
			aa += x * x
			bb += y * y
		}
	}
	return ab / math.Sqrt(aa*bb), 10 * math.Log10(bb/aa)
}
func compare(a, b *audioanalysis.Audio, start, end float64) window {
	// Load aligns channel data at the analysis rate; source metadata retains 48kHz.
	i, j := int(start*float64(audioanalysis.SampleRate)), int(end*float64(audioanalysis.SampleRate))
	best, lag := -1.0, 0
	for offset := -480; offset <= 480; offset += 16 {
		c, _ := stats(a, b, i, j, offset)
		if c > best {
			best, lag = c, offset
		}
	}
	coarse := lag
	for offset := coarse - 16; offset <= coarse+16; offset++ {
		c, _ := stats(a, b, i, j, offset)
		if c > best {
			best, lag = c, offset
		}
	}
	c, gain := stats(a, b, i, j, lag)
	return window{start, end, float64(lag) * 1000 / float64(audioanalysis.SampleRate), c, gain}
}

// Parse top-level ISO BMFF boxes rather than looking for strings in compressed data.
func fastStart(path string) (bool, error) {
	f, err := os.Open(path)
	if err != nil {
		return false, err
	}
	defer f.Close()
	var head [8]byte
	for {
		if _, err := f.Read(head[:]); err != nil {
			return false, err
		}
		size := int64(binary.BigEndian.Uint32(head[:4]))
		kind := string(head[4:])
		header := int64(8)
		if size == 1 {
			var extended [8]byte
			if _, err := f.Read(extended[:]); err != nil {
				return false, err
			}
			size = int64(binary.BigEndian.Uint64(extended[:]))
			header = 16
		}
		if kind == "moov" {
			return true, nil
		}
		if kind == "mdat" {
			return false, nil
		}
		if size < header {
			return false, fmt.Errorf("invalid MP4 box")
		}
		if _, err := f.Seek(size-header, 1); err != nil {
			return false, err
		}
	}
}
func run() error {
	const path = "out/PixelParade.mp4"
	probe, err := exec.Command("ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", path).Output()
	if err != nil {
		return err
	}
	if err := os.WriteFile("analysis/render-probe.json", probe, 0644); err != nil {
		return err
	}
	var p struct {
		Streams []stream `json:"streams"`
	}
	if err := json.Unmarshal(probe, &p); err != nil {
		return err
	}
	var video, audio bool
	for _, s := range p.Streams {
		if s.Type == "video" {
			video = s.Codec == "h264" && s.Width == 1080 && s.Height == 1080 && s.FrameRate == "60/1" && s.Frames == "5168" && s.PixelFormat == "yuv420p" && s.Start == "0.000000"
		} else if s.Type == "audio" {
			audio = s.Codec == "aac" && s.Channels == 2 && s.SampleRate == "48000" && s.Start == "0.000000"
		}
	}
	if !video || !audio {
		return fmt.Errorf("unexpected output streams: video=%v audio=%v", video, audio)
	}
	fast, err := fastStart(path)
	if err != nil {
		return err
	}
	if !fast {
		return fmt.Errorf("MP4 not fast start")
	}
	decoded := ".cache/rendered-audio.wav"
	// Standard PCM16 avoids this WAV decoder's unsupported extensible float header.
	// This is a verification scratch file; the MP4 and original remain untouched.
	if output, err := exec.Command("ffmpeg", "-v", "error", "-y", "-i", path, "-vn", "-acodec", "pcm_s16le", decoded).CombinedOutput(); err != nil {
		return fmt.Errorf("decode audio: %v: %s", err, output)
	}
	a, err := audioanalysis.Load("public/audio/PixelParade.wav")
	if err != nil {
		return err
	}
	b, err := audioanalysis.Load(decoded)
	if err != nil {
		return err
	}
	if b.Source.SampleRate != a.Source.SampleRate || len(b.Channels) != len(a.Channels) || math.Abs(b.Source.Duration-a.Source.Duration) > .04 {
		return fmt.Errorf("audio duration or format mismatch")
	}
	globalGain := b.Source.RMSDB - a.Source.RMSDB
	if math.Abs(globalGain) > .2 {
		return fmt.Errorf("whole-file gain mismatch: %.3f dB", globalGain)
	}
	windows := []window{compare(a, b, 2, 12), compare(a, b, 35, 45), compare(a, b, 72, 82), compare(a, b, 82.3, 86.12)}
	for _, w := range windows {
		if w.Correlation < .98 || math.Abs(w.GainDB) > .2 || math.Abs(w.LagMS) > 1000.0/60 {
			return fmt.Errorf("encoded audio mismatch: %+v", w)
		}
	}
	if output, err := exec.Command("ffmpeg", "-v", "error", "-i", path, "-f", "null", "-").CombinedOutput(); err != nil || len(output) > 0 {
		return fmt.Errorf("full decode: %v: %s", err, output)
	}
	frameData, err := exec.Command("ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "frame=best_effort_timestamp_time", "-of", "json", path).Output()
	if err != nil {
		return err
	}
	var timestamps struct {
		Frames []struct {
			Time string `json:"best_effort_timestamp_time"`
		} `json:"frames"`
	}
	if err := json.Unmarshal(frameData, &timestamps); err != nil {
		return err
	}
	if len(timestamps.Frames) != 5168 {
		return fmt.Errorf("decoded frame count: %d", len(timestamps.Frames))
	}
	var maximumClockError float64
	for i, frame := range timestamps.Frames {
		t, err := strconv.ParseFloat(frame.Time, 64)
		if err != nil {
			return err
		}
		e := math.Abs(t - float64(i)/60)
		maximumClockError = math.Max(maximumClockError, e)
		if e > .000001 {
			return fmt.Errorf("discontinuous video clock at frame %d: %f", i, t)
		}
	}
	result := struct {
		VideoFormat              string   `json:"videoFormat"`
		FastStart                bool     `json:"fastStart"`
		SourceSeconds            float64  `json:"sourceSeconds"`
		DecodedSeconds           float64  `json:"decodedAudioSeconds"`
		Windows                  []window `json:"audioComparisons"`
		FullDecode               string   `json:"fullDecode"`
		MaximumFrameClockErrorMS float64  `json:"maximumFrameClockErrorMS"`
		WaveformComparisonRate   int      `json:"waveformComparisonSampleRate"`
		GlobalGainDB             float64  `json:"wholeFileGainDB"`
	}{"1080x1080 / 60 fps / 5168 frames / H.264 / yuv420p / AAC stereo 48kHz", fast, a.Source.Duration, b.Source.Duration, windows, "passed", maximumClockError * 1000, audioanalysis.SampleRate, globalGain}
	data, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		return err
	}
	if err := os.WriteFile("analysis/render-validation.json", data, 0644); err != nil {
		return err
	}
	fmt.Println(string(data))
	return nil
}
func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
