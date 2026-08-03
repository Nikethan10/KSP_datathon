// Ambient module declarations for three.js (no @types/three installed, and the
// bundled build ships no d.ts). We only use three for a couple of runtime helpers
// in the 3D network graph, so `any` is sufficient here.
declare module 'three'
declare module 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
