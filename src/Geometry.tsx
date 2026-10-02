import {COLORS, TAU, sceneAt, tokenPose} from './choreography';
import type {Scene} from './choreography';
import type {Analysis, AudioControls} from './types';
import {clamp, ease, getAudioControls, lerp} from './controls';

export const Ribbons = ({c, scene}: {c: AudioControls; scene: Scene}) => <g fill="none" strokeLinecap="round">
  {Array.from({length: 5}, (_, ribbon) => {
    const alpha = clamp(scene.ribbons - ribbon) * .38 * scene.ceiling;
    if (!alpha) return null;
    const points = Array.from({length: 97}, (_, j) => {
      const angle = j / 96 * TAU + c.beat * TAU / 32 * (ribbon % 2 ? -1 : 1);
      const radius = 230 + ribbon * 29 + Math.sin(angle * (3 + ribbon % 2) + c.beat * TAU / 8 + ribbon) * (10 + c.harmonic * 18);
      return `${Math.cos(angle) * radius * c.spread},${Math.sin(angle) * radius * (.65 + .18 * Math.sin(c.beat * TAU / 64 + ribbon))}`;
    }).join(' ');
    return <g key={ribbon} opacity={alpha}>
      <polyline points={points} stroke={COLORS[ribbon % 3]} strokeWidth={3 + 11 * c.bass * scene.ceiling}/>
      <polyline points={points} stroke="#C9F5FF" strokeWidth=".8" opacity=".65"/>
    </g>;
  })}
</g>;
export const Tunnel = ({c, scene, t}: {c: AudioControls; scene: Scene; t: number}) => <g fill="none" opacity={scene.tunnel * .32}>
  {Array.from({length: 7}, (_, i) => {
    const z = (i / 7 + t * .045) % 1;
    const r = 45 + z * 370;
    return <rect key={i} x={-r / Math.SQRT2} y={-r / Math.SQRT2} width={r * Math.SQRT2} height={r * Math.SQRT2} rx="6" stroke={COLORS[i % 3]} strokeWidth={.8 + z * 1.6} opacity={Math.sin(z * Math.PI)} transform={`rotate(${45 + Math.sin(c.beat * TAU / 64) * 18})`}/>;
  })}
</g>;
export const Formation = ({a, t, trails}: {a: Analysis; t: number; trails?: boolean}) => {
  const c = getAudioControls(a, t), scene = sceneAt(a, c, t);
  return <g>
  {Array.from({length: 80}, (_, id) => {
    const p = tokenPose(a, id, t, c, scene); if (p.opacity <= .001) return null;
    const color = COLORS[id % 11 === 0 ? 3 : id % 3];
    const s = p.size;
    return <g key={id} transform={`translate(${p.x},${p.y}) rotate(${p.angle})`} opacity={p.opacity * (trails ? .14 : 1)}>
      {id % 5 === 0 ? <circle r={s * .85} fill="none" stroke={color} strokeWidth="2"/> : <rect x={-s / 2} y={-s / 2} width={s} height={s} rx="1" fill={id % 7 === 0 ? color : '#070D20'} stroke={color} strokeWidth="2"/>}
      {!trails && <>
        <path d={`M ${-s * .25} ${-s * .25} h ${s * .5}`} stroke="#E6FCFF" strokeWidth=".9" opacity=".85"/>
        {id % 3 === 0 && <circle r="2" fill={color}/>}
      </>}
    </g>;
  })}
</g>;
};
export const ImpactRings = ({a, c, t, scene}: {a: Analysis; c: AudioControls; t: number; scene: Scene}) => {
  if (c.paused || c.cueIndex === 9) return null;
  const events = a.tracks.drums.onsets.filter(e => t >= e.timeSeconds && t - e.timeSeconds <= .5).slice(-4);
  return <g fill="none">{events.map(e => {
    const p = (t - e.timeSeconds) / .5, radius = lerp(32, 352, 1 - Math.pow(1 - p, 2));
    return <g key={e.timeSeconds} opacity={Math.pow(1 - p, 2) * e.strength * scene.ceiling * .6}>
      <circle r={radius} stroke={e.strength > .8 ? COLORS[3] : COLORS[0]} strokeWidth={1 + (1 - p) * 3}/>
      <circle r={radius + 9} stroke={COLORS[1]} strokeWidth=".8" strokeDasharray="16 30" transform={`rotate(${c.beat * 10})`}/>
    </g>;
  })}</g>;
};
export const Core = ({c, scene, t}: {c: AudioControls; scene: Scene; t: number}) => {
  const quiet = c.paused ? .35 : 1;
  const tail = c.cueIndex === 9 ? lerp(1, .35, ease((t - 82.3) / 2.5)) : 1;
  const scale = (1 + c.bass * (c.cueIndex === 8 ? .32 : .16) + c.impact * .045 * scene.ceiling) * tail;
  const angle = c.beat * 360 / 64;
  return <g transform={`scale(${scale})`} opacity={quiet}>
    <circle r="127" fill="none" stroke={COLORS[2]} strokeWidth=".8" opacity=".55"/>
    <g transform={`rotate(${angle})`} fill="none">
      <circle r="120" stroke={COLORS[0]} strokeWidth="2" strokeDasharray="120 68" opacity={.35 + c.bass * .4}/>
      <circle r="140" stroke={COLORS[1]} strokeWidth="1" strokeDasharray="2 16" opacity={.2 + scene.ceiling * .35}/>
      {Array.from({length: 16}, (_, i) => <path key={i} d="M 150 0 h 6" transform={`rotate(${i / 16 * 360})`} stroke={i % 4 === 0 ? COLORS[3] : COLORS[0]} strokeWidth={i % 4 === 0 ? 2 : 1} opacity=".5"/>)}
    </g>
    <g transform={`rotate(${45 + Math.sin(c.beat * TAU / 32) * 12})`}>
      <rect x="-60" y="-60" width="120" height="120" rx="4" fill="url(#coreFill)" stroke={`rgb(${lerp(134, 54, c.color)},${lerp(88, 229, c.color)},255)`} strokeWidth="3"/>
      <rect x="-45" y="-45" width="90" height="90" rx="2" fill="none" stroke={COLORS[1]} strokeWidth="1.5"/>
      <path d="M -60 -35 V -60 H -35 M 35 60 H 60 V 35" stroke="#D4F8FF" strokeWidth="2" fill="none"/>
      <rect x="-13" y="-13" width="26" height="26" fill={COLORS[0]} opacity={.4 + c.impact * .4}/>
      <rect x="-6" y="-6" width="12" height="12" fill="#D9F9FF" opacity=".8"/>
    </g>
    <g transform={`rotate(${-angle * 1.5})`}>
      {Array.from({length: 4}, (_, i) => <path key={i} d="M 100 -8 L 112 0 L 100 8" transform={`rotate(${i * 90})`} fill="none" stroke={COLORS[i % 3]} strokeWidth="2" opacity={.3 + c.harmonic * .4}/>)}
    </g>
  </g>;
};
