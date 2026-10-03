module github.com/cwbudde/AudioVisualizer

go 1.26.0

replace github.com/cwbudde/algo-dsp => ../algo-dsp

replace github.com/cwbudde/algo-fft => ../algo-fft

replace github.com/cwbudde/algo-approx => ../algo-approx

replace github.com/cwbudde/algo-vecmath => ../algo-vecmath

replace github.com/cwbudde/wav => ../wav

require (
	github.com/cwbudde/algo-dsp v0.0.0-00010101000000-000000000000
	github.com/cwbudde/wav v0.0.0-00010101000000-000000000000
)

require (
	github.com/cwbudde/algo-fft v0.8.0 // indirect
	github.com/cwbudde/algo-vecmath v0.1.3 // indirect
	github.com/go-audio/audio v1.0.0 // indirect
	github.com/go-audio/riff v1.0.0 // indirect
	golang.org/x/sys v0.40.0 // indirect
)
