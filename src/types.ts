export type TrackSource = {path: string; sha256: string; sampleRate: number; channels: number; bitDepth: number; durationSeconds: number; rmsDBFS: number; peakDBFS: number};
export type Onset = {timeSeconds: number; strength: number};
export type TrackAnalysis = {source: TrackSource; energyControl: number[]; bandControls: number[][]; centroidHz: number[]; stereoWidth: number[]; onsets: Onset[]};
export type Rhythm = {bpm: number; beatOriginSeconds: number; meterHypothesis: string; beatsSeconds: number[]};
export type SectionCue = {name: string; startSeconds: number; endSeconds: number; evidence: string; confidence: string};
export type Analysis = {schemaVersion: number; stepSeconds: number; rhythm: Rhythm; cues: SectionCue[]; silence: {startSeconds: number; endSeconds: number}[]; tracks: Record<string, TrackAnalysis>};
export type AudioControls = {bass: number; harmonic: number; high: number; energy: number; spread: number; color: number; impact: number; beat: number; cue: SectionCue; cueIndex: number; paused: boolean};
