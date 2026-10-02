package audioanalysis

import (
	"fmt"
	"math"
	"sort"

	"github.com/cwbudde/algo-dsp/dsp/window"
	frequency "github.com/cwbudde/algo-dsp/stats/frequency"
	fft "github.com/cwbudde/algo-fft"
)

func Analyze(a *Audio) (*Track, error) {
	if len(a.Channels) == 0 || len(a.Channels[0]) == 0 {
		return nil, fmt.Errorf("empty audio")
	}
	length := len(a.Channels[0])
	for _, ch := range a.Channels {
		if len(ch) != length {
			return nil, fmt.Errorf("unequal channel lengths")
		}
	}
	count := (length + Hop - 1) / Hop
	t := &Track{Source: a.Source, RMS: make([]float64, count), Peak: make([]float64, count), Centroid: make([]float64, count), Width: make([]float64, count), Flux: make([]float64, count), Spectrogram: make([]float64, count*64)}
	for b := range t.Bands {
		t.Bands[b] = make([]float64, count)
	}
	plan, err := fft.NewPlanReal64(FFTSize)
	if err != nil {
		return nil, err
	}
	w, err := window.Hann(FFTSize, window.WithPeriodic())
	if err != nil {
		return nil, err
	}
	windowPower := 0.0
	for _, v := range w {
		windowPower += v * v
	}
	buf := make([]float64, FFTSize)
	sp := make([]complex128, FFTSize/2+1)
	power := make([]float64, len(sp))
	mag := make([]float64, len(sp))
	previous := make([]float64, len(sp))
	for frame := 0; frame < count; frame++ {
		center := frame * Hop
		clear(power)
		for _, ch := range a.Channels {
			for i := range buf {
				j := center + i - FFTSize/2
				buf[i] = 0
				if j >= 0 && j < length {
					buf[i] = ch[j] * w[i]
				}
			}
			if err := plan.Forward(sp, buf); err != nil {
				return nil, err
			}
			for k, v := range sp {
				power[k] += (real(v)*real(v) + imag(v)*imag(v)) / float64(len(a.Channels))
			}
		}
		for k, p := range power {
			mag[k] = math.Sqrt(p)
			hz := float64(k) * SampleRate / FFTSize
			logmag := math.Log1p(mag[k])
			if frame > 0 {
				t.Flux[frame] += math.Max(0, logmag-previous[k])
			}
			previous[k] = logmag
			for b := range t.Bands {
				if hz >= BandEdges[b] && hz < BandEdges[b+1] {
					t.Bands[b][frame] += 2 * p / (FFTSize * windowPower)
				}
			}
			if hz >= 25 && hz < 12000 {
				bin := min(63, int(math.Log(hz/25)/math.Log(12000.0/25)*64))
				t.Spectrogram[frame*64+bin] += 2 * p / (FFTSize * windowPower)
			}
		}
		for b := range t.Bands {
			t.Bands[b][frame] = math.Sqrt(t.Bands[b][frame])
		}
		for b := 0; b < 64; b++ {
			t.Spectrogram[frame*64+b] = DB(math.Sqrt(t.Spectrogram[frame*64+b]))
		}
		t.Centroid[frame] = frequency.Centroid(mag, SampleRate)
		n, energy, mid, side := 0.0, 0.0, 0.0, 0.0
		for j := max(0, center-Hop); j < min(length, center+Hop); j++ {
			for _, ch := range a.Channels {
				v := ch[j]
				energy += v * v
				n++
				t.Peak[frame] = math.Max(t.Peak[frame], math.Abs(v))
			}
			if len(a.Channels) == 2 {
				l, r := a.Channels[0][j], a.Channels[1][j]
				mid += (l + r) * (l + r) / 4
				side += (l - r) * (l - r) / 4
			}
		}
		t.RMS[frame] = math.Sqrt(energy / math.Max(1, n))
		if mid+side > 1e-12 {
			t.Width[frame] = side / (mid + side)
		}
		if t.RMS[frame] < 1e-4 {
			t.Centroid[frame] = 0
			t.Flux[frame] = 0
		}
	}
	t.Energy = Normalize(t.RMS, 0.01, 0.15)
	for b := range t.Bands {
		t.BandControls[b] = Normalize(t.Bands[b], 0.01, 0.12)
	}
	t.Events = DetectOnsets(a, t)
	return t, nil
}

func percentile(x []float64, p float64) float64 {
	if len(x) == 0 {
		return 0
	}
	y := append([]float64(nil), x...)
	sort.Float64s(y)
	return y[int(math.Round(p*float64(len(y)-1)))]
}

func Normalize(x []float64, attack, release float64) []float64 {
	active := make([]float64, 0, len(x))
	for _, v := range x {
		if v > 1e-4 {
			active = append(active, v)
		}
	}
	hi := percentile(active, 0.95)
	y := make([]float64, len(x))
	if hi < 1e-4 {
		return y
	}
	state := 0.0
	for i, v := range x {
		target := math.Min(1, math.Max(0, (v-1e-4)/(hi-1e-4)))
		seconds := release
		if target > state {
			seconds = attack
		}
		alpha := 1 - math.Exp(-float64(Hop)/SampleRate/seconds)
		state += alpha * (target - state)
		y[i] = state
	}
	return y
}

// DetectOnsets uses adaptive spectral novelty and refines its location against
// a causal 5 ms energy rise. Events are observations, not instrument labels.
func DetectOnsets(a *Audio, t *Track) []Event {
	step := SampleRate / 200
	attack := make([]float64, (len(a.Channels[0])+step-1)/step)
	prev := 0.0
	for i := range attack {
		e, count := 0.0, 0.0
		for j := i * step; j < min(len(a.Channels[0]), (i+1)*step); j++ {
			for _, ch := range a.Channels {
				e += ch[j] * ch[j]
				count++
			}
		}
		r := math.Sqrt(e / math.Max(1, count))
		attack[i] = math.Max(0, r-prev)
		prev = r
	}
	active := make([]float64, 0, len(t.Flux))
	for _, v := range t.Flux {
		if v > 0 {
			active = append(active, v)
		}
	}
	hi := percentile(active, 0.95)
	if hi <= 0 {
		return nil
	}
	candidates := []Event{}
	for i := 1; i < len(t.Flux)-1; i++ {
		if t.RMS[i] < 0.001 || t.Flux[i] < 0.12*hi || t.Flux[i] <= t.Flux[i-1] || t.Flux[i] < t.Flux[i+1] {
			continue
		}
		lo, end := max(0, i-25), min(len(t.Flux), i+26)
		avg := 0.0
		for j := lo; j < end; j++ {
			avg += t.Flux[j]
		}
		avg /= float64(end - lo)
		if t.Flux[i] < 1.35*avg {
			continue
		}
		position := float64(i) * Hop / SampleRate
		best := 0.0
		for j := max(0, i*2-10); j < min(len(attack), i*2+11); j++ {
			if attack[j] > best {
				best = attack[j]
				position = float64(j*step) / SampleRate
			}
		}
		candidates = append(candidates, Event{position, math.Min(1, t.Flux[i]/hi)})
	}
	sort.Slice(candidates, func(i, j int) bool { return candidates[i].Strength > candidates[j].Strength })
	events := []Event{}
	for _, e := range candidates {
		keep := true
		for _, existing := range events {
			if math.Abs(e.Time-existing.Time) < 0.075 {
				keep = false
				break
			}
		}
		if keep {
			events = append(events, e)
		}
	}
	sort.Slice(events, func(i, j int) bool { return events[i].Time < events[j].Time })
	return events
}
