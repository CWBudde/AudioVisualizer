package audioanalysis

import (
	"bufio"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"os"
	"path/filepath"
	"testing"
)

func TestResamplingTimingAndAliasing(t *testing.T) {
	for _, rate := range []int{48000, 44100} {
		t.Run(fmt.Sprint(rate), func(t *testing.T) {
			x := make([]float64, rate)
			x[rate/2] = 1
			y, err := ResampleAligned(x, rate, SampleRate)
			if err != nil {
				t.Fatal(err)
			}
			if len(y) != SampleRate {
				t.Fatalf("length %d", len(y))
			}
			peak := 0
			for i, v := range y {
				if math.Abs(v) > math.Abs(y[peak]) {
					peak = i
				}
			}
			if math.Abs(float64(peak)/SampleRate-0.5) > 1.0/SampleRate {
				t.Fatalf("uncompensated FIR delay: peak %d", peak)
			}
			for i := range x {
				x[i] = math.Sin(2 * math.Pi * 16000 * float64(i) / float64(rate))
			}
			y, err = ResampleAligned(x, rate, SampleRate)
			if err != nil {
				t.Fatal(err)
			}
			energy := 0.0
			for _, v := range y[1000 : len(y)-1000] {
				energy += v * v
			}
			rms := math.Sqrt(energy / float64(len(y)-2000))
			if rms > 0.003 {
				t.Fatalf("16 kHz aliases above -50 dBFS: %.5f", rms)
			}
		})
	}
}

func TestBufferedWAVDecoderAndRelativeSeek(t *testing.T) {
	path := filepath.Join(t.TempDir(), "stereo.wav")
	f, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	// A known PCM16 fixture exercises the sibling decoder, channel ordering,
	// source statistics, and its seeks through a buffered reader.
	values := []int16{16384, -16384, 8192, -8192, 0, 0, 32767, -32768}
	f.WriteString("RIFF")
	binary.Write(f, binary.LittleEndian, uint32(36+len(values)*2))
	f.WriteString("WAVEfmt ")
	for _, v := range []any{uint32(16), uint16(1), uint16(2), uint32(48000), uint32(192000), uint16(4), uint16(16)} {
		if err := binary.Write(f, binary.LittleEndian, v); err != nil {
			t.Fatal(err)
		}
	}
	f.WriteString("data")
	binary.Write(f, binary.LittleEndian, uint32(len(values)*2))
	binary.Write(f, binary.LittleEndian, values)
	f.Close()
	a, err := Load(path)
	if err != nil {
		t.Fatal(err)
	}
	if a.Source.Channels != 2 || a.Source.SampleRate != 48000 || math.Abs(a.Source.Duration-4.0/48000) > 1e-10 {
		t.Fatalf("wrong decoded metadata: %+v", a.Source)
	}
	if len(a.Channels[0]) != 2 || a.Source.PeakDB > 0.001 || a.Source.PeakDB < -0.01 {
		t.Fatal("wrong decoded length/peak")
	}
	f, err = os.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	b := &bufferedSeeker{file: f, reader: bufio.NewReaderSize(f, 128)}
	read := make([]byte, 4)
	if _, err := io.ReadFull(b, read); err != nil {
		t.Fatal(err)
	}
	if _, err := b.Seek(-4, io.SeekCurrent); err != nil {
		t.Fatal(err)
	}
	if _, err := io.ReadFull(b, read); err != nil || string(read) != "RIFF" {
		t.Fatalf("buffered relative seek: %q %v", read, err)
	}
}

func TestStereoPowerAndFrequencyBands(t *testing.T) {
	x := make([]float64, SampleRate)
	opposite := make([]float64, len(x))
	for i := range x {
		x[i] = 0.5 * math.Sin(2*math.Pi*1000*float64(i)/SampleRate)
		opposite[i] = -x[i]
	}
	a := &Audio{Source: Source{Duration: 1}, Channels: [][]float64{x, opposite}}
	track, err := Analyze(a)
	if err != nil {
		t.Fatal(err)
	}
	i := 50
	if math.Abs(track.RMS[i]-0.5/math.Sqrt2) > 0.001 {
		t.Fatalf("anti-phase stereo lost energy: %f", track.RMS[i])
	}
	if math.Abs(track.Centroid[i]-1000) > 20 || track.Width[i] < 0.999 {
		t.Fatalf("wrong spectral shape: centroid %f width %f", track.Centroid[i], track.Width[i])
	}
	if track.Bands[2][i] < 0.34 {
		t.Fatalf("tone missing from 400–2000 Hz band: %f", track.Bands[2][i])
	}
	for b := range track.Bands {
		if b != 2 && track.Bands[b][i] > 0.005 {
			t.Fatalf("tone leaks into band %d", b)
		}
	}
}

func TestSilenceFiniteAndNoTriggers(t *testing.T) {
	a := &Audio{Source: Source{Duration: 1}, Channels: [][]float64{make([]float64, SampleRate)}}
	track, err := Analyze(a)
	if err != nil {
		t.Fatal(err)
	}
	if len(track.Events) != 0 {
		t.Fatal("silent audio produced onsets")
	}
	if _, err := json.Marshal(track); err != nil {
		t.Fatalf("nonfinite features: %v", err)
	}
	for _, v := range track.Energy {
		if v != 0 {
			t.Fatal("silent controls nonzero")
		}
	}
	intervals, err := FindSilence(a)
	if err != nil {
		t.Fatal(err)
	}
	if len(intervals) != 1 || intervals[0].End != 1 {
		t.Fatalf("silence intervals: %+v", intervals)
	}
	r, err := EstimateRhythm(track, 105)
	if err != nil {
		t.Fatal(err)
	}
	if r.BPM != 0 || len(r.Beats) != 0 {
		t.Fatal("invented tempo for silence")
	}
}

func TestTransientTimingAndNormalization(t *testing.T) {
	x := make([]float64, 2*SampleRate)
	for _, time := range []float64{0.25, 0.75, 1.25, 1.75} {
		start := int(time * SampleRate)
		for j := 0; j < SampleRate/20; j++ {
			x[start+j] = 0.8 * math.Cos(2*math.Pi*1000*float64(j)/SampleRate) * math.Exp(-float64(j)/(SampleRate*0.006))
		}
	}
	track, err := Analyze(&Audio{Source: Source{Duration: 2}, Channels: [][]float64{x}})
	if err != nil {
		t.Fatal(err)
	}
	if len(track.Events) != 4 {
		t.Fatalf("expected 4 isolated transients, got %+v", track.Events)
	}
	for i, e := range track.Events {
		if math.Abs(e.Time-(0.25+float64(i)*0.5)) > 1.0/60 {
			t.Fatalf("onset %d off by > frame: %+v", i, e)
		}
	}
	for _, v := range track.Energy {
		if v < 0 || v > 1 || math.IsNaN(v) {
			t.Fatal("unbounded control")
		}
	}
}

func TestTempoRecoversKnownPulseTrain(t *testing.T) {
	track := &Track{Source: Source{Duration: 20}, RMS: make([]float64, 2000), Flux: make([]float64, 2000)}
	for b := range track.Bands {
		track.Bands[b] = make([]float64, 2000)
	}
	for i := 10; i < 2000; i += 50 {
		track.Flux[i] = 1
		track.Bands[0][i] = 1
		track.Events = append(track.Events, Event{Time: float64(i) * 0.01, Strength: 1})
	}
	r, err := EstimateRhythm(track, 120)
	if err != nil {
		t.Fatal(err)
	}
	if math.Abs(r.BPM-120) > 0.1 {
		t.Fatalf("tempo %.3f", r.BPM)
	}
	if r.MedianOnsetErrorMS > 12 {
		t.Fatalf("bad grid fit %.2f ms", r.MedianOnsetErrorMS)
	}
}
