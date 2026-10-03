import {clamp} from '../../shared/controls';

export {clamp, ease, lerp} from '../../shared/controls';
export const smoothstep = (a: number, b: number, x: number) => {x = clamp((x - a) / (b - a)); return x * x * (3 - 2 * x);};
export const easeOutCubic = (x: number) => 1 - (1 - clamp(x)) ** 3;
export const easeInOutCubic = (x: number) => {x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;};
/** 0 before start, eased up over fadeIn, held, eased down over fadeOut to 0 at end. */
export const envelope = (t: number, start: number, end: number, fadeIn: number, fadeOut: number) =>
  (fadeIn > 0 ? smoothstep(start, start + fadeIn, t) : +(t >= start)) * (fadeOut > 0 ? 1 - smoothstep(end - fadeOut, end, t) : +(t < end));
/** Exponential flash after an event; 0 before it (age < 0). */
export const pulse = (age: number, decay: number) => age < 0 ? 0 : Math.exp(-age / decay);
