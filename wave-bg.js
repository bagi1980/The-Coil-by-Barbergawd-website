// wave-bg.js — flowing barber-pole background (vanilla ES-module adaptation of wave-background.tsx)
// Original component used React + ogl. This project is plain HTML/JS, so we load ogl from a CDN
// as an ES module and recolor the shader to the barbershop SIGN palette: red · cream · blue.
import { Renderer, Program, Mesh, Triangle, Vec2 } from "./lib/ogl.js";

const vertex = /* glsl */ `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`;

// Flowing barber-pole fragment shader (red / cream / blue ribbons over near-black)
const fragment = /* glsl */ `
#ifdef GL_ES
precision mediump float;
#endif

uniform vec2  uResolution;
uniform float uTime;
uniform float uIntensity;   // 0..1 how vivid the ribbons are
uniform vec3  uRed;
uniform vec3  uBlue;
uniform vec3  uCream;
uniform vec3  uBg;

#define PI 3.14159265359

// 4-stop barber cycle: red -> cream -> blue -> cream -> red
vec3 barber(float t) {
  t = fract(t);
  if (t < 0.25)      return mix(uRed,   uCream, smoothstep(0.0, 0.25, t));
  else if (t < 0.50) return mix(uCream, uBlue,  smoothstep(0.25, 0.50, t));
  else if (t < 0.75) return mix(uBlue,  uCream, smoothstep(0.50, 0.75, t));
  else               return mix(uCream, uRed,   smoothstep(0.75, 1.00, t));
}

// Flowing wave function (kept from the original component)
float wave(vec2 uv, float speed, float offset) {
  return sin(uv.x * 3.0 + uTime * speed + offset) * 0.30 +
         cos(uv.y * 2.0 - uTime * speed * 0.5 + offset) * 0.20;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  vec2 p  = uv * 2.0 - 1.0;
  p.x *= uResolution.x / uResolution.y;

  // organic flow
  float w1 = wave(p, 1.2, 0.0);
  float w2 = wave(p, 0.8, 2.0);
  float w3 = wave(p, 1.5, 4.0);
  float pattern = (w1 + w2 + w3) * 0.5;

  // diagonal barber-pole bias so ribbons read as a slow upward spiral
  float diag = (p.x * 0.35 + p.y * 0.65);
  vec3 col = barber(pattern + diag + uTime * 0.04);

  // mute toward the background for a premium, non-garish look
  col = mix(uBg, col, uIntensity);

  // soft radial vignette to frame content placed on top
  float vig = smoothstep(1.45, 0.15, length(p));
  col *= mix(0.45, 1.0, vig);

  gl_FragColor = vec4(col, 1.0);
}
`;

const hexToVec3 = (hex) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

/**
 * Mount the animated background onto a canvas.
 * @param {HTMLCanvasElement} canvas - target canvas (positioned absolute inside a relative parent)
 * @param {object} opts
 *   intensity      0..1   ribbon vividness (default 0.55 — muted/premium)
 *   resolutionScale 0..1  render scale for perf (default 1)
 *   colors         { red, blue, cream, bg } hex strings
 */
export function mountWaveBackground(canvas, opts = {}) {
  const {
    intensity = 0.55,
    resolutionScale = 1.0,
    colors = {},
  } = opts;

  const red   = hexToVec3(colors.red   || "#C8102E");
  const blue  = hexToVec3(colors.blue  || "#16306B");
  const cream = hexToVec3(colors.cream || "#F4EFE2");
  const bg    = hexToVec3(colors.bg    || "#0A0A0C");

  const parent = canvas.parentElement;
  const renderer = new Renderer({ dpr: Math.min(window.devicePixelRatio, 2), canvas });
  const gl = renderer.gl;
  const geometry = new Triangle(gl);

  const program = new Program(gl, {
    vertex,
    fragment,
    uniforms: {
      uTime:       { value: 0 },
      uResolution: { value: new Vec2() },
      uIntensity:  { value: intensity },
      uRed:        { value: red },
      uBlue:       { value: blue },
      uCream:      { value: cream },
      uBg:         { value: bg },
    },
  });

  const mesh = new Mesh(gl, { geometry, program });

  const resize = () => {
    const w = parent.clientWidth, h = parent.clientHeight;
    renderer.setSize(w * resolutionScale, h * resolutionScale);
    program.uniforms.uResolution.value.set(w, h);
  };
  window.addEventListener("resize", resize);
  resize();

  // respect users who prefer reduced motion: render one static frame, no loop
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const start = performance.now();
  let frame = 0;
  const loop = () => {
    program.uniforms.uTime.value = (performance.now() - start) / 1000;
    renderer.render({ scene: mesh });
    frame = requestAnimationFrame(loop);
  };

  if (reduce) {
    program.uniforms.uTime.value = 8.0; // a pleasant frozen moment
    renderer.render({ scene: mesh });
  } else {
    loop();
  }

  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener("resize", resize);
  };
}
