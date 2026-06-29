// REFERENCE ONLY — this project is plain HTML/CSS/JS (no React/Vite/TS build step).
// The live integration is the framework-free ES module `wave-bg.js` in the project root,
// which loads `ogl` from a CDN and recolors this shader to the barbershop sign palette
// (red / cream / blue). Keep this file as the canonical React/shadcn version in case the
// app is later migrated to a React + Tailwind + TypeScript stack via the shadcn CLI.
//
// To use this version in a real React/shadcn project:
//   1. `npx shadcn@latest init`   (creates components/ui + tailwind config)
//   2. `npm i ogl`
//   3. import WaveBackground from "@/components/ui/wave-background"
//
import { useRef, useEffect } from "react";
import { Renderer, Program, Mesh, Triangle, Vec2 } from "ogl";

const vertex = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

// Flowing barber-pole fragment shader (recolored from the original blue-only version)
const fragment = `
#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 uResolution;
uniform float uTime;
uniform float uIntensity;

#define PI 3.14159265359

// Barbershop sign palette
const vec3 RED   = vec3(0.784, 0.063, 0.180);
const vec3 BLUE  = vec3(0.086, 0.188, 0.420);
const vec3 CREAM = vec3(0.957, 0.937, 0.886);
const vec3 BG    = vec3(0.039, 0.039, 0.047);

vec3 barber(float t) {
  t = fract(t);
  if (t < 0.25)      return mix(RED,   CREAM, smoothstep(0.0, 0.25, t));
  else if (t < 0.50) return mix(CREAM, BLUE,  smoothstep(0.25, 0.50, t));
  else if (t < 0.75) return mix(BLUE,  CREAM, smoothstep(0.50, 0.75, t));
  else               return mix(CREAM, RED,   smoothstep(0.75, 1.00, t));
}

float wave(vec2 uv, float speed, float offset) {
  return sin(uv.x * 3.0 + uTime * speed + offset) * 0.3 +
         cos(uv.y * 2.0 - uTime * speed * 0.5 + offset) * 0.2;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= uResolution.x / uResolution.y;

  float w1 = wave(p, 1.2, 0.0);
  float w2 = wave(p, 0.8, 2.0);
  float w3 = wave(p, 1.5, 4.0);
  float pattern = (w1 + w2 + w3) * 0.5;

  float diag = (p.x * 0.35 + p.y * 0.65);
  vec3 col = barber(pattern + diag + uTime * 0.04);
  col = mix(BG, col, uIntensity);

  float vig = smoothstep(1.45, 0.15, length(p));
  col *= mix(0.45, 1.0, vig);

  gl_FragColor = vec4(col, 1.0);
}
`;

type Props = {
  intensity?: number;
  resolutionScale?: number;
};

export default function WaveBackground({
  intensity = 0.55,
  resolutionScale = 1.0,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current as HTMLCanvasElement;
    const parent = canvas.parentElement as HTMLElement;

    const renderer = new Renderer({
      dpr: Math.min(window.devicePixelRatio, 2),
      canvas,
    });

    const gl = renderer.gl;
    const geometry = new Triangle(gl);

    const program = new Program(gl, {
      vertex,
      fragment,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new Vec2() },
        uIntensity: { value: intensity },
      },
    });

    const mesh = new Mesh(gl, { geometry, program });

    const resize = () => {
      const w = parent.clientWidth,
        h = parent.clientHeight;
      renderer.setSize(w * resolutionScale, h * resolutionScale);
      program.uniforms.uResolution.value.set(w, h);
    };

    window.addEventListener("resize", resize);
    resize();

    const start = performance.now();
    let frame = 0;

    const loop = () => {
      program.uniforms.uTime.value = (performance.now() - start) / 1000;
      renderer.render({ scene: mesh });
      frame = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, [intensity, resolutionScale]);

  return <canvas ref={ref} className="absolute inset-0 w-full h-full block" />;
}
