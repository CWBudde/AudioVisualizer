import {staticFile} from 'remotion';
import {Audio} from '@remotion/media';

export const Soundtrack = () => <Audio src={staticFile('audio/PixelParade.wav')}/>;
