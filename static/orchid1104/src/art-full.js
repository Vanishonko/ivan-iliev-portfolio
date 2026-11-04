import { ART_TEXT_FULL, ART_LAYERS_FULL, ELEMENTS_FULL } from './art-data-full.js';
import { parseArt } from './art-core.js';

// The 96×60 plate is the whole-plant view: readable at a glance, with all three
// blooms, the buds, leaves, roots and pot in frame.
export const ART_FULL = parseArt(
  { text: ART_TEXT_FULL, layers: ART_LAYERS_FULL, elements: ELEMENTS_FULL },
  { bloomGap: 0.55 }
);
