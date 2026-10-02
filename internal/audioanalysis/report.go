package audioanalysis

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"strings"
)

func QuantizeTrack(t *Track) {
	for _, x := range [][]float64{t.RMS, t.Peak, t.Centroid, t.Width, t.Flux, t.Energy} {
		for i, v := range x {
			x[i] = math.Round(v*1e6) / 1e6
		}
	}
	for b := range t.Bands {
		for _, x := range [][]float64{t.Bands[b], t.BandControls[b]} {
			for i, v := range x {
				x[i] = math.Round(v*1e6) / 1e6
			}
		}
	}
	for i, v := range t.Spectrogram {
		t.Spectrogram[i] = math.Round(v*100) / 100
	}
}

func sectionStats(t *Track, start, end float64) (rms, centroid, width float64, bands [5]float64, events int) {
	// Exclude windows crossing a boundary: a following kick must not inflate
	// statistics for the silent interval preceding it.
	margin := float64(FFTSize) / 2 / SampleRate
	lo, hi := int(math.Ceil((start+margin)*SampleRate/Hop)), min(len(t.RMS), int(math.Floor((end-margin)*SampleRate/Hop))+1)
	if hi <= lo {
		return
	}
	count := float64(hi - lo)
	total := 0.0
	for i := lo; i < hi; i++ {
		rms += t.RMS[i] * t.RMS[i]
		centroid += t.Centroid[i]
		width += t.Width[i]
		for b := range bands {
			v := t.Bands[b][i]
			bands[b] += v * v
			total += v * v
		}
	}
	rms = DB(math.Sqrt(rms / count))
	centroid /= count
	width /= count
	if total > 0 {
		for b := range bands {
			bands[b] = 100 * bands[b] / total
		}
	}
	for _, e := range t.Events {
		if e.Time >= start && e.Time < end {
			events++
		}
	}
	return
}

func WriteReport(dir string, a *Analysis) error {
	f, err := os.Create(filepath.Join(dir, "sections.csv"))
	if err != nil {
		return err
	}
	w := csv.NewWriter(f)
	if err := w.Write([]string{"track", "section", "start_s", "end_s", "rms_dbfs", "centroid_hz", "stereo_side_fraction", "low_pct", "bass_pct", "mid_pct", "high_pct", "air_pct", "onsets"}); err != nil {
		f.Close()
		return err
	}
	var report strings.Builder
	fmt.Fprint(&report, "# PixelParade audio analysis\n\n")
	fmt.Fprintf(&report, "Source SHA-256: `%s`. Duration: %.3f s. Features are centered at `i × 0.01` seconds.\n\n", a.Tracks["mix"].Source.SHA256, a.Tracks["mix"].Source.Duration)
	fmt.Fprintln(&report, "| Track | Rate | Duration | RMS dBFS | Peak dBFS | RMS relative to mix | Detected onsets |\n|---|---:|---:|---:|---:|---:|---:|")
	for _, name := range []string{"mix", "drums", "bass", "other", "vocals"} {
		t := a.Tracks[name]
		if t == nil {
			continue
		}
		fmt.Fprintf(&report, "| %s | %d | %.3f s | %.2f | %.2f | %+.2f dB | %d |\n", name, t.Source.SampleRate, t.Source.Duration, t.Source.RMSDB, t.Source.PeakDB, t.Source.RMSDB-a.Tracks["mix"].Source.RMSDB, len(t.Events))
		for _, cue := range a.Cues {
			r, c, width, bands, events := sectionStats(t, cue.Start, cue.End)
			row := []string{name, cue.Name, fmt.Sprintf("%.6f", cue.Start), fmt.Sprintf("%.6f", cue.End), fmt.Sprintf("%.3f", r), fmt.Sprintf("%.1f", c), fmt.Sprintf("%.4f", width)}
			for _, v := range bands {
				row = append(row, fmt.Sprintf("%.2f", v))
			}
			row = append(row, fmt.Sprint(events))
			if err := w.Write(row); err != nil {
				f.Close()
				return err
			}
		}
	}
	w.Flush()
	err = w.Error()
	closeErr := f.Close()
	if err != nil {
		return err
	}
	if closeErr != nil {
		return closeErr
	}
	fmt.Fprintf(&report, "\n## Rhythm\n\nEstimated tempo: **%.3f BPM**. Beat origin: **%.3f s**. Quarter-note period: %.6f s. Four-bar phrase under 4/4: %.6f s.\n\n%s.\n\nMeter: %s. Median detected-onset distance to the nearest sixteenth-note subdivision: %.2f ms. This metric measures grid fit, not detection accuracy or downbeat certainty.\n\n", a.Rhythm.BPM, a.Rhythm.BeatOrigin, 60/a.Rhythm.BPM, 16*60/a.Rhythm.BPM, a.Rhythm.Evidence, a.Rhythm.Meter, a.Rhythm.MedianOnsetErrorMS)
	fmt.Fprintln(&report, "| Alternative BPM | Correlation |\n|---:|---:|")
	for _, c := range a.Rhythm.Candidates {
		fmt.Fprintf(&report, "| %.2f | %.4f |\n", c.BPM, c.Correlation)
	}
	if a.Alignment != nil {
		fmt.Fprintf(&report, "\n## Stem validation\n\nSum correlation with the mono reference: %.8f; strongest cross-correlation lag: %.4f ms; residual RMS: %.2f dBFS; maximum duration difference: %.4f ms. Stems are float32 with rescaling disabled. Correlation is an alignment/reconstruction check, not a separation-quality score.\n", a.Alignment.Correlation, a.Alignment.BestLagMS, a.Alignment.ResidualRMSDB, a.Alignment.MaxDurationErrorMS)
	}
	fmt.Fprintln(&report, "\n## Mix sections\n\nBand percentages describe energy within 25 Hz–12 kHz after analysis resampling. Statistics exclude a 42.7 ms margin at each boundary to avoid overlapping adjacent sections. Onset counts include the full section.\n\n| Section | Start–end | RMS dBFS | Centroid Hz | Low-band energy | Onsets |\n|---|---:|---:|---:|---:|---:|")
	for _, cue := range a.Cues {
		r, c, _, bands, events := sectionStats(a.Tracks["mix"], cue.Start, cue.End)
		fmt.Fprintf(&report, "| %s | %.3f–%.3f s | %.2f | %.0f | %.1f%% | %d |\n", cue.Name, cue.Start, cue.End, r, c, bands[0], events)
	}
	fmt.Fprintln(&report, "\n## Interpretation limits\n\nThe stem names are model outputs, not verified instrument identities. In particular, vocal-stem energy can contain synthesizer leakage. No lyrics, key, or precise genre are asserted. Section boundaries outside measured silence are authored from energy changes and retain approximate timing. The 105 BPM prior comes from preliminary mix analysis; broad alternatives remain available in the JSON. Resampling includes fractional-delay interpolation, so analysis samples are not archival copies.\n\nOpen [overview.html](overview.html) to audition the mix or individual stems, scrub the aligned envelopes/spectrogram, and inspect cues. [sections.csv](sections.csv) contains all stem/section measurements.")
	if err := os.WriteFile(filepath.Join(dir, "report.md"), []byte(report.String()), 0644); err != nil {
		return err
	}
	return writeOverview(filepath.Join(dir, "overview.html"), a)
}

func writeOverview(path string, a *Analysis) error {
	// Keep the inspection artifact compact: 10 Hz display data, separate from
	// the full 100 Hz controls. Display reduction averages power, not dB.
	type displayTrack struct {
		RMS    []float64    `json:"rms"`
		Bands  [5][]float64 `json:"bands"`
		Source string       `json:"src"`
	}
	d := struct {
		Duration    float64                 `json:"duration"`
		Tracks      map[string]displayTrack `json:"tracks"`
		Spectrogram []float64               `json:"spectrogram"`
		Cues        []Cue                   `json:"cues"`
		Beats       []float64               `json:"beats"`
		BPM         float64                 `json:"bpm"`
	}{Duration: a.Tracks["mix"].Source.Duration, Tracks: map[string]displayTrack{}, Cues: a.Cues, Beats: a.Rhythm.Beats, BPM: a.Rhythm.BPM}
	for name, t := range a.Tracks {
		src := "../" + filepath.ToSlash(t.Source.Path)
		if name != "mix" {
			src = filepath.ToSlash(strings.TrimPrefix(t.Source.Path, "analysis/"))
		}
		v := displayTrack{Source: src}
		for i := 0; i < len(t.RMS); i += 10 {
			count := float64(min(10, len(t.RMS)-i))
			r := 0.0
			bs := [5]float64{}
			for j := i; j < min(i+10, len(t.RMS)); j++ {
				r += t.RMS[j] * t.RMS[j]
				for b := range bs {
					bs[b] += t.Bands[b][j] * t.Bands[b][j]
				}
			}
			v.RMS = append(v.RMS, DB(math.Sqrt(r/count)))
			for b := range bs {
				v.Bands[b] = append(v.Bands[b], DB(math.Sqrt(bs[b]/count)))
			}
		}
		d.Tracks[name] = v
	}
	mix := a.Tracks["mix"]
	for i := 0; i < len(mix.RMS); i += 10 {
		for b := 0; b < 64; b++ {
			p := 0.0
			n := 0.0
			for j := i; j < min(i+10, len(mix.RMS)); j++ {
				p += math.Pow(10, mix.Spectrogram[j*64+b]/10)
				n++
			}
			d.Spectrogram = append(d.Spectrogram, 10*math.Log10(math.Max(1e-12, p/n)))
		}
	}
	data, err := json.Marshal(d)
	if err != nil {
		return err
	}
	page := strings.Replace(overviewHTML, "__DATA__", string(data), 1)
	// Source names are fixed by the CLI; JSON escapes HTML-significant bytes.
	return os.WriteFile(path, []byte(page), 0644)
}

const overviewHTML = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PixelParade audio inspection</title>
<style>body{margin:24px;background:#080c18;color:#e1e8f5;font:15px system-ui}h1{font-size:24px}main{max-width:1440px;margin:auto}audio{width:min(650px,100%)}select,button{padding:8px;background:#172238;color:white;border:1px solid #456;border-radius:5px}canvas{display:block;width:100%;border:1px solid #26334b;background:#0b1120;margin:12px 0;cursor:crosshair}#readout{font-variant-numeric:tabular-nums}p{color:#9eacc3}label{margin-right:20px}#legend{color:#b8c8da}</style>
<main><h1>PixelParade · aligned audio inspection</h1><p>Click or drag a chart to seek. Choose a stem to hear its contribution. These charts show measured audio, with authored section boundaries.</p><label>Listen <select id="track"></select></label><span id="readout"></span><br><br><audio id="audio" controls preload="metadata"></audio><div id="legend">Bands: <span style="color:#36e5ff">25–140 Hz</span> · <span style="color:#ff3da8">140–400 Hz</span> · <span style="color:#8658ff">400–2000 Hz</span> · <span style="color:#e9ff70">2–6 kHz</span> · <span style="color:#eee">6–12 kHz</span></div><canvas id="envelopes" width="1440" height="670"></canvas><p>Mix spectrogram · logarithmic frequency 25 Hz–12 kHz, brighter means more energy</p><canvas id="spectrum" width="1440" height="280"></canvas><p id="cue"></p></main>
<script>const d=__DATA__;const audio=document.querySelector('#audio'),select=document.querySelector('#track'),env=document.querySelector('#envelopes'),spec=document.querySelector('#spectrum');const names=['mix','drums','bass','other','vocals'].filter(n=>d.tracks[n]);const colors=['#36e5ff','#ff3da8','#8658ff','#e9ff70','#eeeeff'];const left=110,right=20,W=env.width-left-right;let time=0,drag=false;for(const n of names){const o=document.createElement('option');o.textContent=n;o.value=n;select.append(o)}audio.src=d.tracks.mix.src;select.onchange=()=>{const was=!audio.paused;time=audio.currentTime;audio.src=d.tracks[select.value].src;audio.onloadedmetadata=()=>{audio.currentTime=Math.min(time,audio.duration);if(was)audio.play()}};const tx=t=>left+t/d.duration*W;
function base(ctx,h){ctx.fillStyle='#0b1120';ctx.fillRect(0,0,1440,h);for(const c of d.cues){ctx.fillStyle=c.name.includes('pause')?'#371c36':'#182137';ctx.fillRect(tx(c.startSeconds),0,tx(c.endSeconds)-tx(c.startSeconds),24);ctx.strokeStyle='#40506b';ctx.beginPath();ctx.moveTo(tx(c.startSeconds),0);ctx.lineTo(tx(c.startSeconds),h);ctx.stroke()}ctx.fillStyle='#a8b7ce';ctx.font='12px system-ui';for(let t=0;t<d.duration;t+=5){ctx.fillText(t+'s',tx(t),h-5)}}
const envBack=document.createElement('canvas');envBack.width=1440;envBack.height=env.height;let ctx=envBack.getContext('2d');base(ctx,env.height);const rh=(env.height-50)/names.length;for(let k=0;k<names.length;k++){const tr=d.tracks[names[k]],top=28+k*rh;ctx.fillStyle='#d2ddf0';ctx.fillText(names[k],12,top+22);for(const v of [-60,-40,-20,0]){const y=top+rh-15-(v+70)/70*(rh-20);ctx.strokeStyle='#1c2940';ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(1420,y);ctx.stroke();ctx.fillStyle='#64748b';ctx.fillText(v+' dB',40,y)}const lines=[...tr.bands,tr.rms];for(let b=0;b<lines.length;b++){const v=lines[b];ctx.strokeStyle=b===5?'#6e809b':colors[b];ctx.lineWidth=b===5?2:1;ctx.beginPath();for(let i=0;i<v.length;i++){let x=tx(i*.1),y=top+rh-15-(Math.max(-70,v[i])+70)/70*(rh-20);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)}ctx.stroke()}}
const specBack=document.createElement('canvas');specBack.width=1440;specBack.height=spec.height;ctx=specBack.getContext('2d');base(ctx,spec.height);let cols=d.spectrogram.length/64;for(let i=0;i<cols;i++){for(let b=0;b<64;b++){const power=Math.max(0,Math.min(1,(d.spectrogram[i*64+b]+75)/65));ctx.fillStyle='hsl('+(260-power*220)+',85%,'+(4+power*65)+'%)';ctx.fillRect(tx(i*.1),26+(63-b)*3.6,W/cols+1,4)}}for(const [hz,b]of [[25,0],[140,18],[400,29],[2000,45],[6000,57],[12000,63]]){ctx.fillStyle='#ccd5e5';ctx.fillText(hz+' Hz',12,26+(63-b)*3.6+4)}
function draw(){for(const [c,back]of [[env,envBack],[spec,specBack]]){const ct=c.getContext('2d');ct.drawImage(back,0,0);ct.strokeStyle='#ffffff';ct.lineWidth=1;ct.beginPath();ct.moveTo(tx(time),0);ct.lineTo(tx(time),c.height);ct.stroke()}document.querySelector('#readout').textContent=time.toFixed(3)+' / '+d.duration.toFixed(3)+' s · '+d.bpm.toFixed(2)+' BPM';const cue=d.cues.find(c=>time>=c.startSeconds&&time<c.endSeconds);document.querySelector('#cue').textContent=cue?cue.name+' — '+cue.evidence:''}function seek(e){const box=e.currentTarget.getBoundingClientRect();time=Math.max(0,Math.min(d.duration,((e.clientX-box.left)/box.width*1440-left)/W*d.duration));if(Number.isFinite(audio.duration))audio.currentTime=Math.min(time,audio.duration);draw()}for(const c of [env,spec]){c.onpointerdown=e=>{drag=true;c.setPointerCapture(e.pointerId);seek(e)};c.onpointermove=e=>{if(drag)seek(e)};c.onpointerup=()=>drag=false}audio.ontimeupdate=()=>{time=audio.currentTime;draw()};draw();</script></html>`
