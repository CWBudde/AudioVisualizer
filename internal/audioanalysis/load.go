package audioanalysis

import (
	"bufio"
	"crypto/sha256"
	"fmt"
	"io"
	"math"
	"os"

	"github.com/cwbudde/algo-dsp/dsp/resample"
	"github.com/cwbudde/wav"
)

func DB(v float64) float64 { return 20 * math.Log10(math.Max(v, 1e-6)) }

func Load(path string) (*Audio, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return nil, err
	}
	if _, err := f.Seek(0, io.SeekStart); err != nil {
		return nil, err
	}
	d := wav.NewDecoder(&bufferedSeeker{file: f, reader: bufio.NewReaderSize(f, 256*1024)})
	b, err := d.FullPCMBuffer()
	if err != nil {
		return nil, fmt.Errorf("decode %s: %w", path, err)
	}
	if b.Format.NumChannels < 1 || b.Format.NumChannels > 2 || len(b.Data) == 0 || len(b.Data)%b.Format.NumChannels != 0 {
		return nil, fmt.Errorf("%s: expected nonempty mono/stereo audio", path)
	}
	count := len(b.Data) / b.Format.NumChannels
	a := &Audio{Source: Source{Path: path, SHA256: fmt.Sprintf("%x", h.Sum(nil)), SampleRate: b.Format.SampleRate, Channels: b.Format.NumChannels, BitDepth: int(d.BitDepth), Duration: float64(count) / float64(b.Format.SampleRate)}}
	sum, peak := 0.0, 0.0
	for c := 0; c < b.Format.NumChannels; c++ {
		x := make([]float64, count)
		for i := range x {
			x[i] = float64(b.Data[i*b.Format.NumChannels+c])
			if math.IsNaN(x[i]) || math.IsInf(x[i], 0) {
				return nil, fmt.Errorf("%s: nonfinite sample", path)
			}
			sum += x[i] * x[i]
			peak = math.Max(peak, math.Abs(x[i]))
		}
		y, err := ResampleAligned(x, b.Format.SampleRate, SampleRate)
		if err != nil {
			return nil, err
		}
		a.Channels = append(a.Channels, y)
	}
	a.Source.RMSDB = DB(math.Sqrt(sum / float64(len(b.Data))))
	a.Source.PeakDB = DB(peak)
	return a, nil
}

// WAV decoding reads individual samples; buffering avoids millions of tiny
// filesystem reads while preserving the decoder's relative-seek semantics.
type bufferedSeeker struct {
	file   *os.File
	reader *bufio.Reader
}

func (b *bufferedSeeker) Read(p []byte) (int, error) { return b.reader.Read(p) }
func (b *bufferedSeeker) Seek(offset int64, whence int) (int64, error) {
	if whence == io.SeekCurrent {
		offset -= int64(b.reader.Buffered())
	}
	position, err := b.file.Seek(offset, whence)
	if err == nil {
		b.reader.Reset(b.file)
	}
	return position, err
}

// ResampleAligned flushes the causal FIR tail and compensates fractional group
// delay so both 48 kHz mix and 44.1 kHz stems share an exact t=0 origin.
func ResampleAligned(x []float64, inputRate, outputRate int) ([]float64, error) {
	if inputRate <= 0 || outputRate <= 0 {
		return nil, fmt.Errorf("invalid sample rate")
	}
	if inputRate == outputRate {
		return append([]float64(nil), x...), nil
	}
	r, err := resample.NewForRates(float64(inputRate), float64(outputRate), resample.WithQuality(resample.QualityBest))
	if err != nil {
		return nil, err
	}
	up, down := r.Ratio()
	delayInput := float64(len(r.Prototype())-1) / (2 * float64(up))
	delayOutput := float64(len(r.Prototype())-1) / (2 * float64(down))
	padded := make([]float64, len(x)+int(math.Ceil(delayInput))+4)
	copy(padded, x)
	raw := r.Process(padded)
	y := make([]float64, int(math.Round(float64(len(x))*float64(outputRate)/float64(inputRate))))
	for i := range y {
		pos := float64(i) + delayOutput
		j := int(pos)
		u := pos - float64(j)
		if j+1 < len(raw) {
			y[i] = raw[j]*(1-u) + raw[j+1]*u
		}
	}
	return y, nil
}
