/// <reference types="vite/client" />
import {StrictMode, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Player} from '@remotion/player';
import type {ComponentType} from 'react';
import {PixelParadeV1} from '../src/v1/PixelParade';
import {PixelParadeV2} from '../src/v2/PixelParade';
import {PixelParadeV3} from '../src/v3/PixelParade';
import {assertStory} from '../src/v3/story';
import {FPS, FRAMES, SIZE} from '../src/versions';
import storyData from '../public/analysis/story.json';
import './style.css';

// staticFile() resolves against this base, so the soundtrack loads under the Pages subpath too.
(window as unknown as {remotion_staticBase: string}).remotion_staticBase = import.meta.env.BASE_URL.replace(/\/$/, '');
const story: unknown = storyData;
assertStory(story);

type Entry = {label: string; title: string; text: string; component: ComponentType<any>; props: Record<string, unknown>};
const VERSIONS: Record<'v3' | 'v2' | 'v1', Entry> = {
  v3: {label: 'v3 · WICK', title: 'WICK', component: PixelParadeV3, props: {story},
    text: 'A pixel flame crosses a sleeping plain of dark tiles. Every note lights a tile, and the lit tiles rise and follow. React Three Fiber, driven by the song\'s analysed motifs, chords and structure.'},
  v2: {label: 'v2 · shaders', title: 'Shader worlds', component: PixelParadeV2, props: {},
    text: 'Raw WebGL2 shader worlds with a melody ribbon, switched by per-cue shot presets.'},
  v1: {label: 'v1 · parade', title: 'Neon parade', component: PixelParadeV1, props: {},
    text: 'The first version: an SVG and Canvas neon geometric parade.'},
};

const App = () => {
  const [version, setVersion] = useState<keyof typeof VERSIONS>('v3');
  const entry = VERSIONS[version];
  return <main>
    <header>
      <h1>PixelParade</h1>
      <nav>{(Object.keys(VERSIONS) as (keyof typeof VERSIONS)[]).map(v =>
        <button key={v} aria-pressed={v === version} onClick={() => setVersion(v)}>{VERSIONS[v].label}</button>)}</nav>
    </header>
    <div className="stage">
      <Player key={version} component={entry.component} inputProps={entry.props}
        durationInFrames={FRAMES} fps={FPS} compositionWidth={SIZE} compositionHeight={SIZE}
        controls clickToPlay doubleClickToFullscreen allowFullscreen acknowledgeRemotionLicense
        style={{width: '100%', aspectRatio: '1 / 1'}}/>
    </div>
    <section>
      <h2>{entry.title}</h2>
      <p>{entry.text}</p>
      <p className="note">Rendered live in your browser, frame by frame, as a pure function of song time. Press play to start the soundtrack. A GPU with WebGL2 is required for v2 and v3.</p>
    </section>
  </main>;
};

createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>);
