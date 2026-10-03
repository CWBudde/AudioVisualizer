import data from '../../public/analysis/controls.json';
import {assertAnalysis} from './controls';
import type {Analysis} from './types';

// The only static import of the control export: every version shares one bundled copy.
export const analysis: Analysis = data;
assertAnalysis(analysis);
