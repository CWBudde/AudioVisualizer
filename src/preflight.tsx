import {Composition, registerRoot} from 'remotion';
const Frame = () => <div style={{width: 1080, height: 1080, background: '#060814', display: 'grid', placeItems: 'center'}}><div style={{width: 240, height: 240, border: '8px solid #36E5FF', transform: 'rotate(45deg)'}} /></div>;
registerRoot(() => <Composition id="Preflight" component={Frame} durationInFrames={60} fps={60} width={1080} height={1080}/>);
