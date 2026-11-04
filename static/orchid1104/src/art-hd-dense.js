import { ART_TEXT_HD_DENSE, ART_LAYERS_HD_DENSE, ELEMENTS_HD_DENSE } from './art-data-hd-dense.js';
import { parseArt } from './art-core.js';

// The dense 160×100 plate fills the petal interiors with stipple and hatching.
// It is the whole-plant view: the characters blend into an engraved mass.
export const ART_HD_DENSE = parseArt(
  { text: ART_TEXT_HD_DENSE, layers: ART_LAYERS_HD_DENSE, elements: ELEMENTS_HD_DENSE },
  { bloomGap: 0 }
);
