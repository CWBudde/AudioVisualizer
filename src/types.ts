export type TrackSource = {path: string; sha256: string; sampleRate: number; channels: number; bitDepth: number; durationSeconds: number; rmsDBFS: number; peakDBFS: number};
export type DrumKind = 'kick' | 'snare' | 'hat';
export type Onset = {timeSeconds: number; strength: number; kind?: string};
export type Note = {startSeconds: number; endSeconds: number; midi: number; strength: number};
export type Melody = {pitchMIDI: number[]; voicing: number[]; chroma: number[][]; notes: Note[]};
export type TrackAnalysis = {source: TrackSource; energyControl: number[]; bandControls: number[][]; centroidHz: number[]; stereoWidth: number[]; onsets: Onset[]; melody?: Melody};
export type Rhythm = {bpm: number; beatOriginSeconds: number; meterHypothesis: string; beatsSeconds: number[]; downbeatBeatIndex: number};
export type SectionCue = {name: string; startSeconds: number; endSeconds: number; evidence: string; confidence: string};
export type Analysis = {schemaVersion: number; stepSeconds: number; rhythm: Rhythm; cues: SectionCue[]; silence: {startSeconds: number; endSeconds: number}[]; tracks: Record<string, TrackAnalysis>};
/** A melody note relative to the current time: ages in seconds, pitch normalized to 0–1. */
export type RecentNote = {startAge: number; endAge: number; pitch: number; pitchClass: number; strength: number};
export type AudioControls = {
  bass: number; harmonic: number; high: number; energy: number; spread: number; color: number; impact: number;
  kick: number; snare: number; hat: number; kickCount: number; snareSteps: number;
  beat: number; bar: number; phrase: number;
  pitch: number; voicing: number; hue: number; tonality: number; notes: RecentNote[]; vocal: number;
  cue: SectionCue; cueIndex: number; paused: boolean;
};
