package audioanalysis

const SampleRate = 24000
const FFTSize = 2048
const Hop = 240

var BandEdges = [6]float64{25, 140, 400, 2000, 6000, 12000}

type Source struct {
	Path       string  `json:"path"`
	SHA256     string  `json:"sha256"`
	SampleRate int     `json:"sampleRate"`
	Channels   int     `json:"channels"`
	BitDepth   int     `json:"bitDepth"`
	Duration   float64 `json:"durationSeconds"`
	RMSDB      float64 `json:"rmsDBFS"`
	PeakDB     float64 `json:"peakDBFS"`
}

type Audio struct {
	Source   Source
	Channels [][]float64
}

type Event struct {
	Time     float64 `json:"timeSeconds"`
	Strength float64 `json:"strength"`
}

// Track arrays are centered at i*hop/sampleRate, including a padded first frame.
// Spectrogram is frame-major, 64 logarithmic bins, in dB relative to full scale.
type Track struct {
	Source       Source       `json:"source"`
	RMS          []float64    `json:"rms"`
	Peak         []float64    `json:"peak"`
	Centroid     []float64    `json:"centroidHz"`
	Width        []float64    `json:"stereoWidth"`
	Flux         []float64    `json:"spectralFlux"`
	Bands        [5][]float64 `json:"bandAmplitudes"`
	Energy       []float64    `json:"energyControl"`
	BandControls [5][]float64 `json:"bandControls"`
	Events       []Event      `json:"onsets"`
	Spectrogram  []float64    `json:"spectrogramDB"`
}

type TempoCandidate struct {
	BPM         float64 `json:"bpm"`
	Correlation float64 `json:"correlation"`
}

type Rhythm struct {
	BPM                float64          `json:"bpm"`
	BeatOrigin         float64          `json:"beatOriginSeconds"`
	Meter              string           `json:"meterHypothesis"`
	Candidates         []TempoCandidate `json:"candidates"`
	Beats              []float64        `json:"beatsSeconds"`
	MedianOnsetErrorMS float64          `json:"medianOnsetGridErrorMS"`
	Evidence           string           `json:"evidence"`
}

type Cue struct {
	Name       string  `json:"name"`
	Start      float64 `json:"startSeconds"`
	End        float64 `json:"endSeconds"`
	Evidence   string  `json:"evidence"`
	Confidence string  `json:"confidence"`
}

type Interval struct {
	Start float64 `json:"startSeconds"`
	End   float64 `json:"endSeconds"`
}

type Alignment struct {
	Correlation        float64 `json:"sumCorrelation"`
	ResidualRMSDB      float64 `json:"sumResidualRMSDBFS"`
	BestLagMS          float64 `json:"bestLagMS"`
	MaxDurationErrorMS float64 `json:"maxDurationErrorMS"`
}

type Analysis struct {
	SchemaVersion   int               `json:"schemaVersion"`
	SampleRate      int               `json:"analysisSampleRate"`
	FFTSize         int               `json:"fftSize"`
	Hop             int               `json:"hopSamples"`
	BandEdges       [6]float64        `json:"bandEdgesHz"`
	SpectrogramBins int               `json:"spectrogramBins"`
	Tracks          map[string]*Track `json:"tracks"`
	Rhythm          Rhythm            `json:"rhythm"`
	Silence         []Interval        `json:"silence"`
	Cues            []Cue             `json:"cues"`
	Alignment       *Alignment        `json:"stemAlignment,omitempty"`
	Provenance      map[string]string `json:"provenance"`
}
