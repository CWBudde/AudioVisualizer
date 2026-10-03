package story

import (
	"image"
	"image/color"
	"image/png"
	"io"
	"math"
)

// heat maps [0, 1] from darkness through purple, red and orange to yellow.
func heat(x float64) color.RGBA {
	stops := [][3]float64{{6, 3, 10}, {59, 15, 79}, {179, 22, 46}, {255, 123, 28}, {255, 216, 74}, {255, 243, 196}}
	x = math.Min(1, math.Max(0, x)) * float64(len(stops)-1)
	i := min(len(stops)-2, int(x))
	f := x - float64(i)
	var c [3]uint8
	for k := range c {
		c[k] = uint8(math.Round(stops[i][k] + f*(stops[i+1][k]-stops[i][k])))
	}
	return color.RGBA{c[0], c[1], c[2], 255}
}

// WriteSSMPNG draws a self-similarity matrix with px pixels per unit,
// similarity -1..1 mapped onto the heat ramp, grey grid lines every
// gridEvery units and cyan marks at fractional unit positions (cues).
func WriteSSMPNG(w io.Writer, s [][]float64, px, gridEvery int, marks []float64) error {
	n := len(s) * px
	img := image.NewRGBA(image.Rect(0, 0, n, n))
	for i, row := range s {
		for j, v := range row {
			c := heat((v + 1) / 2)
			for y := i * px; y < (i+1)*px; y++ {
				for x := j * px; x < (j+1)*px; x++ {
					img.SetRGBA(x, y, c)
				}
			}
		}
	}
	blend := func(x, y int, c color.RGBA, a float64) {
		o := img.RGBAAt(x, y)
		mix := func(p, q uint8) uint8 { return uint8(math.Round(float64(p)*(1-a) + float64(q)*a)) }
		img.SetRGBA(x, y, color.RGBA{mix(o.R, c.R), mix(o.G, c.G), mix(o.B, c.B), 255})
	}
	line := func(p int, c color.RGBA, a float64) {
		if p < 0 || p >= n {
			return
		}
		for k := range n {
			blend(p, k, c, a)
			blend(k, p, c, a)
		}
	}
	for u := gridEvery; u < len(s); u += gridEvery {
		line(u*px, color.RGBA{128, 128, 128, 255}, 0.35)
	}
	for _, m := range marks {
		line(int(math.Round(m*float64(px))), color.RGBA{54, 229, 255, 255}, 0.8)
	}
	return png.Encode(w, img)
}
