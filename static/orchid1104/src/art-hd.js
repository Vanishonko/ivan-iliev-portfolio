import { ART_TEXT_HD, ART_LAYERS_HD, ELEMENTS_HD } from './art-data-hd.js';
import { parseArt } from './art-core.js';

// The 96×60 plate is the desktop composition: denser, with finer veins and roots.
export const ART_HD = parseArt(
  { text: ART_TEXT_HD, layers: ART_LAYERS_HD, elements: ELEMENTS_HD },
  { bloomGap: 0.55 }
);
