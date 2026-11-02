export const W = 352;
export const H = 198;
export const TAU = Math.PI * 2;

/** Shared world palette. Every asset and every engine-drawn effect uses this. */
export const P = {
  ink: "#1c2928",
  cream: "#f7eccf",
  shadow: "#8b5d45",
  skyHigh: "#79bfc7",
  skyMid: "#a6d6d2",
  skyLow: "#d7ebd8",
  cloud: "#f6f0da",
  cloudShade: "#cfdfd1",
  sunHigh: "#fff7c4",
  sun: "#ffe083",
  sunDeep: "#f5b45b",
  waterDeep: "#1d4c56",
  water: "#2d696f",
  waterMid: "#4a8e86",
  waterLight: "#79b7a2",
  foam: "#c4e5ce",
  leafHigh: "#b5d387",
  leaf: "#87b06a",
  leafMid: "#5f8953",
  leafDark: "#3e6447",
  grassDeep: "#2a4b3c",
  hillFar: "#80a98d",
  hill: "#59866e",
  hillDark: "#3a6455",
  barkDark: "#4b362a",
  bark: "#74513a",
  barkLight: "#a6764f",
  stone: "#869689",
  stoneDark: "#5a6b60",
  poppy: "#d9554d",
  poppyShade: "#a93b40",
  cornflower: "#7891db",
  cornShade: "#4e63a9",
  gold: "#f1c75a",
  amber: "#d39140",
  blush: "#e8a39d",
  beeGold: "#efbf4a",
  inkWarm: "#3b3027",
  beeBrown: "#8a5b37",
  wing: "#d9ecdd",
  frog: "#78b259",
  frogDark: "#4b7b41",
  frogLight: "#aed57b",
  belly: "#e8ddab",
  shell: "#c28456",
  shellDark: "#8b5c42",
  ladyRed: "#d7483f",
  butterfly: "#e59449",
  butterflyCream: "#f2d9a6",
  lily: "#5b9661",
  lilyLight: "#8ebd71",
  firefly: "#fff2a6",
};

export const UI = {
  title: { x: 8, y: 6 },
  clock: { x: 8, y: 24, w: 46, h: 46 },
  buttons: [
    { id: "notes", x: 263, y: 5, w: 18, h: 14, label: "FIELD NOTES" },
    { id: "sound", x: 284, y: 5, w: 18, h: 14, label: "SOUND" },
    { id: "rain", x: 305, y: 5, w: 18, h: 14, label: "RAIN" },
    { id: "reset", x: 326, y: 5, w: 18, h: 14, label: "RESET" },
  ],
  bar: { x: 0, y: 181, w: W, h: 17 },
  tools: [
    { id: "look", x: 5, y: 182, w: 25, h: 14, label: "EXPLORE", key: "0" },
    { id: "poppy", x: 32, y: 182, w: 25, h: 14, label: "POPPY", key: "1" },
    { id: "cornflower", x: 59, y: 182, w: 25, h: 14, label: "CORNFLOWER", key: "2" },
    { id: "marigold", x: 86, y: 182, w: 25, h: 14, label: "MARIGOLD", key: "3" },
  ],
  status: { x: 118, y: 184, w: 226 },
  notesPanel: { x: 36, y: 12, w: 280, h: 150 },
  notesClose: { x: 299, y: 17, w: 11, h: 10 },
  toast: { x: 71, y: 30, w: 210, h: 38 },
};

export const WORLD = {
  horizon: 86,
  skyline: [
    [0, 0], [352, 0], [352, 82], [340, 80], [320, 84], [300, 86], [280, 84], [260, 80],
    [240, 82], [220, 80], [200, 78], [180, 80], [160, 84], [140, 86], [120, 84], [100, 80],
    [80, 76], [60, 72], [40, 74], [20, 78], [0, 82],
  ],
  water: [
    [100, 126], [120, 120], [140, 118], [160, 117], [180, 118], [200, 118], [220, 119],
    [240, 120], [258, 121], [274, 123], [282, 126], [280, 134], [280, 144], [283, 154],
    [287, 164], [291, 174], [295, 180], [292, 178], [270, 176], [240, 177], [210, 176],
    [180, 177], [150, 176], [120, 177], [90, 177], [78, 179], [80, 172], [84, 162],
    [88, 152], [92, 142], [96, 134],
  ],
  banks: {
    left: [
      [0, 108], [24, 104], [48, 106], [72, 110], [94, 116], [100, 126], [96, 134],
      [92, 142], [88, 152], [84, 162], [80, 172], [78, 179], [0, 179],
    ],
    right: [
      [352, 102], [330, 102], [306, 106], [288, 112], [282, 126], [280, 134],
      [280, 144], [283, 154], [287, 164], [291, 174], [295, 180], [352, 180],
    ],
  },
  boulder: { x: 40, y: 142, w: 30, h: 16 },
  hive: { x: 315, y: 104, w: 30, h: 32 },
  log: { x: 214, y: 156, w: 74, h: 22 },
  lilyPads: [
    { x: 144, y: 148, variant: 0, phase: 0.2 },
    { x: 166, y: 139, variant: 1, phase: 1.7 },
    { x: 190, y: 151, variant: 2, phase: 3.1 },
    { x: 214, y: 141, variant: 0, phase: 4.4 },
    { x: 234, y: 154, variant: 1, phase: 5.3 },
  ],
  reeds: [
    { x: 88, y: 179, flip: false, scale: 1 },
    { x: 264, y: 179, flip: true, scale: 1 },
  ],
  grass: [
    { x: 22, y: 170, phase: 0.1 },
    { x: 60, y: 174, phase: 1.2 },
    { x: 96, y: 176, phase: 2.4 },
    { x: 300, y: 174, phase: 3.3 },
    { x: 336, y: 176, phase: 4.2 },
    { x: 250, y: 180, phase: 5.1 },
  ],
  initialFlowers: [
    { species: "marigold", x: 12, y: 126 },
    { species: "poppy", x: 34, y: 124 },
    { species: "cornflower", x: 10, y: 144 },
    { species: "poppy", x: 32, y: 168 },
    { species: "poppy", x: 288, y: 124 },
    { species: "cornflower", x: 334, y: 124 },
    { species: "marigold", x: 310, y: 142 },
    { species: "poppy", x: 316, y: 170 },
  ],
  beeHome: { x: 315, y: 100 },
};

export const FLOWERS = {
  poppy: {
    id: "poppy",
    name: "POPPY",
    shortName: "POPPY",
    frameStart: 0,
    petal: P.poppy,
    accent: P.poppyShade,
  },
  cornflower: {
    id: "cornflower",
    name: "CORNFLOWER",
    shortName: "CORNFLOWER",
    frameStart: 3,
    petal: P.cornflower,
    accent: P.cornShade,
  },
  marigold: {
    id: "marigold",
    name: "MARSH MARIGOLD",
    shortName: "MARIGOLD",
    frameStart: 6,
    petal: P.gold,
    accent: P.amber,
  },
};

export const FLOWER_ORDER = ["poppy", "cornflower", "marigold"];

export const NOTES = [
  {
    id: "honeybee",
    name: "HONEYBEE",
    line: "Dances directions to the best flowers.",
  },
  {
    id: "bumblebee",
    name: "BUMBLEBEE",
    line: "A slow, fuzzy heavyweight that works the deep blooms.",
  },
  {
    id: "dragonfly",
    name: "DRAGONFLY",
    line: "Skims the pond and writes rings on the water.",
  },
  {
    id: "damselfly",
    name: "DAMSELFLY",
    line: "Folds its wings like a leaf and rides the reeds.",
  },
  {
    id: "butterfly",
    name: "BUTTERFLY",
    line: "Settles only where the petals are sweetest.",
  },
  {
    id: "ladybug",
    name: "LADYBUG",
    line: "A little red shell with a taste for aphids.",
  },
  {
    id: "ant",
    name: "ANT",
    line: "Follows the log road, always carrying something.",
  },
  {
    id: "snail",
    name: "SNAIL",
    line: "Carries its house and leaves a silver thought.",
  },
  {
    id: "waterstrider",
    name: "WATER STRIDER",
    line: "Walks on water; feels every ripple before it arrives.",
  },
  {
    id: "tadpole",
    name: "TADPOLE",
    line: "All tail and appetite. One day, a frog.",
  },
  {
    id: "frog",
    name: "FROG",
    line: "A patient green philosopher with a mighty croak.",
  },
  {
    id: "firefly",
    name: "FIREFLY",
    line: "Only comes out when the sun touches the horizon.",
  },
  {
    id: "gnat",
    name: "GNAT",
    line: "A speck with opinions. The frogs are listening.",
  },
];

export const NOTE_BY_ID = Object.fromEntries(NOTES.map((n) => [n.id, n]));

export const SEED_TOOLS = FLOWER_ORDER;

/** Rendering/load specs. Agents write these files; the loader verifies them. */
export const ASSETS = {
  landscape: {
    src: "src/assets/landscape/pond-base.png",
    fw: 352,
    fh: 198,
    frames: 1,
  },
  clouds: {
    src: "src/assets/sprites/clouds.png",
    fw: 64,
    fh: 32,
    frames: 3,
  },
  flowers: {
    src: "src/assets/sprites/flowers.png",
    fw: 15,
    fh: 25,
    frames: 9,
  },
  lilypad: {
    src: "src/assets/sprites/lilypad.png",
    fw: 30,
    fh: 15,
    frames: 3,
  },
  reeds: {
    src: "src/assets/sprites/reeds.png",
    fw: 30,
    fh: 50,
    frames: 2,
  },
  grass: {
    src: "src/assets/sprites/grass.png",
    fw: 20,
    fh: 15,
    frames: 4,
  },
  honeybee: {
    src: "src/assets/sprites/bee-honey.png",
    fw: 10,
    fh: 8,
    frames: 4,
  },
  bumblebee: {
    src: "src/assets/sprites/bee-bumble.png",
    fw: 12,
    fh: 9,
    frames: 4,
  },
  dragonfly: {
    src: "src/assets/sprites/dragonfly.png",
    fw: 22,
    fh: 12,
    frames: 4,
  },
  damselfly: {
    src: "src/assets/sprites/damselfly.png",
    fw: 17,
    fh: 10,
    frames: 4,
  },
  butterfly: {
    src: "src/assets/sprites/butterfly.png",
    fw: 14,
    fh: 11,
    frames: 4,
  },
  ladybug: {
    src: "src/assets/sprites/ladybug.png",
    fw: 9,
    fh: 7,
    frames: 4,
  },
  "ladybug-fly": {
    src: "src/assets/sprites/ladybug-fly.png",
    fw: 12,
    fh: 10,
    frames: 2,
  },
  ant: {
    src: "src/assets/sprites/ant.png",
    fw: 7,
    fh: 5,
    frames: 4,
  },
  snail: {
    src: "src/assets/sprites/snail.png",
    fw: 11,
    fh: 9,
    frames: 4,
  },
  waterstrider: {
    src: "src/assets/sprites/waterstrider.png",
    fw: 13,
    fh: 7,
    frames: 4,
  },
  tadpole: {
    src: "src/assets/sprites/tadpole.png",
    fw: 6,
    fh: 5,
    frames: 4,
  },
  frog: {
    src: "src/assets/sprites/frog.png",
    fw: 20,
    fh: 15,
    frames: 8,
  },
  firefly: {
    src: "src/assets/sprites/firefly.png",
    fw: 5,
    fh: 5,
    frames: 4,
  },
  gnat: {
    src: "src/assets/sprites/gnat.png",
    fw: 5,
    fh: 4,
    frames: 2,
  },
};

export const HINTS = [
  "TURN THE CLOCK HANDS TO CHANGE THE HOUR",
  "CLICK THE WATER AND WATCH THE RINGS",
  "PLANT A SEED, THEN WAIT FOR THE BEES",
  "CLICK A LILY PAD TO MAKE A FROG HOP",
  "CLICK A CREATURE TO BEGIN YOUR FIELD NOTES",
  "CLICK THE HIVE TO CALL THE WAGGLE DANCE",
  "THE REEDS BEND WHEN YOU SWEEP THEM",
];
