// The intro forms' motion, as GLSL for the particle vertex shader in scene.js: heroAnim moves a
// particle of form h from its rest position (as built in hero.js and its modules), using the
// constants those modules export. Included after scene.js defines PI, rotX/Y/Z, rot2 and bez.

import { HEART_CENTRES } from './heart.js'
import { BRAIN_Z, BRAIN_VIEW } from './brain.js'
import { ATOM_ORBITS, HOLE, GEARS, GEAR_VIEW, GLASS, WORM, WORM_VIEW, DECK, NOTE_BASE } from './objects.js'
import { DRAGON_VIEW } from './creatures.js'

const f3 = (v) => `vec3(${v.map((x) => x.toFixed(4)).join(', ')})`
const HELPERS = /* glsl */ `
vec3 rotAxis(vec3 p, vec3 n, float a){ float c = cos(a), s = sin(a); return p * c + cross(n, p) * s + n * dot(n, p) * (1. - c); }
const vec3 HEART_V = ${f3(HEART_CENTRES.ventricles)};
const vec3 HEART_A = ${f3(HEART_CENTRES.atria)};
${ATOM_ORBITS.map((o, k) => `const vec3 ATOM_N${k} = ${f3(o.n)}; const float ATOM_W${k} = ${o.w.toFixed(4)};`).join('\n')}
${GEARS.map((g, k) => `const vec2 GEAR_C${k} = vec2(${g.c.map((x) => x.toFixed(4)).join(', ')}); const float GEAR_W${k} = ${g.w.toFixed(4)};`).join('\n')}
float glassR(float y){ return ${GLASS.RN.toFixed(4)} + ${(GLASS.RB - GLASS.RN).toFixed(4)} * pow(sin(PI * clamp(abs(y) / ${GLASS.H.toFixed(4)}, 0., 1.) * 0.85), 0.75); }
// where grain u (its rank) sits at sand progress st: 0 all in the top bulb … 1.035 all landed
vec3 sandAt(float u, float st, float r1, float ang){
  const float H = ${GLASS.H.toFixed(4)};
  if(u >= st){ // settled in the top bulb, with a dimple over the neck once it runs
    float s1 = min(st, 1.), top = mix(0.05, 0.72 * H, pow(1. - s1, 0.55));
    float y = mix(0.06, top, (u - s1) / max(1. - s1, 1e-3));
    float R = glassR(y) * 0.9, rr = R * sqrt(r1);
    y -= 0.08 * (1. - rr / R) * smoothstep(top - 0.18, top, y) * smoothstep(0., 0.05, st);
    return vec3(cos(ang) * rr, y, sin(ang) * rr);
  }
  float pile = mix(-0.97 * H, -0.3 * H, pow(min(st, 1.), 0.6));
  if(u > st - 0.035){ // falling through the neck in a thin stream
    float f = (st - u) / 0.035;
    return vec3(cos(ang) * 0.012 * r1, mix(0.0, pile, f * f), sin(ang) * 0.012 * r1);
  }
  float q = u / max(st - 0.035, 1e-3), y = mix(-0.97 * H, pile, 1. - pow(1. - q, 0.333)); // a cone, filled by volume
  float rr = min(glassR(y) * 0.9, (pile - y) * 1.6 + 0.015) * sqrt(r1);
  return vec3(cos(ang) * rr, y, sin(ang) * rr);
}
`

export const HERO_ANIM = HELPERS + /* glsl */ `
vec3 heroAnim(int h, vec3 p, vec4 o, inout float alpha, inout float glow){
  float part = o.w;
  if(part > 7.5 && part < 8.5){ // drifting sparkles
    p += vec3(sin(uTime * 0.4 + o.y * 20.) * 0.12, sin(uTime * 0.3 + o.y * 13.) * 0.14, 0.);
    alpha *= 0.3 + 0.7 * abs(sin(uTime * 1.7 + o.y * 30.));
  }
  if(h == 0){ // butterfly: flies in from deep space with quick wingbeats, then hovers and flaps
    float arriving = 1. - smoothstep(0.75, 1., uEntry);
    if(part > 5.5 && part < 6.5){
      float a = 0.12 + mix(0.62, 0.95, arriving) * (0.5 + 0.5 * sin(uTime * mix(3.4, 9., arriving)));
      p = vec3(p.x * cos(a), p.y, abs(p.x) * sin(a) + p.z);
    }
    vec3 rest = rotX(p, -0.4) + vec3(0., sin(uTime * 1.6) * 0.08, 0.);
    if(uEntry >= 1.) return rest;
    // sweeps in from far behind, banking through a curve; a few particles lag and draw streaks
    float lag = step(0.7, aRnd.y) * aRnd.z * 0.075;
    float t = clamp(uEntry * 1.08 - lag, 0., 1.);
    float et = 1. - pow(1. - t, 2.2);
    vec3 A = vec3(-9., 5.5, -24.), B = vec3(7.5, 2.2, -2.5), C = vec3(0.);
    vec3 v = normalize(mix(B - A, C - B, et) + vec3(0., 0., 1e-3));
    float yaw = atan(v.x, v.z), pitch = -atan(v.y, length(v.xz)), bank = -sin(PI * et) * 0.8;
    vec3 q = vec3(-p.x, p.z, p.y); // body frame: head forward (+z), back up (+y)
    vec3 fly = rotY(rotX(rotZ(q, bank), pitch + 0.35), yaw) + bez(A, B, C, et);
    glow += lag * 6.;
    return mix(fly, rest, smoothstep(0.8, 1., t));
  }
  if(h == 1){ // rocket: rolling, with a live plume
    if(part > 1.5 && part < 2.5){
      float t = fract(fract(o.y * 13.37) + uTime * 1.7), ang = o.y * 6.2831;
      float rr = 0.27 * o.z * (1. - t * 0.55) * (0.75 + 0.25 * sin(t * 20. - uTime * 15.));
      p = vec3(cos(ang) * rr, -1.05 - t * 1.15, sin(ang) * rr);
      alpha *= (1. - t) * 1.2;
      glow += 1.4 * (1. - t);
    }
    return rotZ(rotY(p, uTime * 0.7), -0.3) + vec3(0., sin(uTime * 1.3) * 0.06, 0.);
  }
  if(h == 2) return rotY(p, uSpin);
  if(h == 3){ // heart: lub-dub at ~66 bpm. Atria squeeze, then the ventricles; the arteries pulse
    float bt = fract(uTime * 1.1);
    float atr = exp(-pow((bt - 0.06) / 0.05, 2.));
    float ven = smoothstep(0.1, 0.2, bt) * (1. - smoothstep(0.32, 0.55, bt));
    if(o.y < 0.5){ vec3 c = HEART_V; p = c + (p - c) * vec3(1. - 0.075 * ven, 1. - 0.045 * ven, 1. - 0.075 * ven); glow += ven * 0.2; }
    else if(o.y < 1.5){ vec3 c = HEART_A; p = c + (p - c) * (1. - 0.07 * atr); }
    else { glow += ven * 0.25; p = p * (1. + 0.015 * ven); } // the arteries swell with each beat
    return rotY(rotX(p, 0.05), 0.1 + sin(uTime * 0.35) * 0.4);
  }
  if(h == 4){ // brain: waves of activity sweep front to back over the gyri, neurons spark
    float zf = (p.z - ${BRAIN_Z[0].toFixed(3)}) / ${(BRAIN_Z[1] - BRAIN_Z[0]).toFixed(3)};
    float wave = exp(-pow((fract(uTime * 0.22) * 1.6 - 0.3 - (1. - zf)) / 0.08, 2.));
    if(part > 23.5 && part < 24.5) glow += wave * (0.25 + 0.5 * o.y);
    if(part > 24.5 && part < 25.5){
      float f = fract(o.y * 7.31 + uTime * (0.35 + o.y * 0.4));
      float spark = exp(-f * 14.);
      alpha *= 0.15 + spark * 1.4 + wave * 0.6;
      glow += spark * 1.3 + wave * 0.4;
    }
    p *= 1. + 0.01 * sin(uTime * 1.2);
    return rotY(rotX(p, ${BRAIN_VIEW[0].toFixed(3)}), ${BRAIN_VIEW[1].toFixed(3)} + sin(uTime * 0.3) * 0.3);
  }
  if(h == 5){ // atom: nucleons jiggle, electrons race round their orbits trailing light
    if(part > 29.5 && part < 30.5) p += 0.012 * vec3(sin(uTime * 7. + o.y * 3.1), sin(uTime * 6.3 + o.y * 1.7), sin(uTime * 5.1 + o.y * 2.3));
    if(part > 30.5 && part < 31.5){
      vec3 n = o.y < 0.5 ? ATOM_N0 : o.y < 1.5 ? ATOM_N1 : ATOM_N2;
      float w = o.y < 0.5 ? ATOM_W0 : o.y < 1.5 ? ATOM_W1 : ATOM_W2;
      p = rotAxis(p, n, uTime * w);
      alpha *= pow(1. - o.z, 1.4); glow += (1. - o.z) * 1.2;
    }
    return rotY(rotX(p, sin(uTime * 0.4) * 0.08), sin(uTime * 0.3) * 0.35);
  }
  if(h == 6){ // black hole: a Keplerian disk, Doppler-beamed, hidden behind the shadow; lensed light stays put
    if(part > 32.5 && part < 33.5){
      alpha *= 0.7 + 0.3 * sin(o.z * 9. - uTime * 2.4 + o.y * 14.);
      return p;
    }
    vec3 q = p;
    if(part > 31.5 && part < 32.5) q = rotY(p, -uTime * 1.25 / pow(o.y, 1.5));
    if(part > 33.5 && part < 34.5){ // gas spiralling in from the outer disk
      float t = fract(o.y + uTime * 0.07), r = mix(2.6, ${HOLE.inner.toFixed(3)}, t * t);
      float ph = o.z - uTime * 1.25 / pow(r, 1.5) - t * 3.;
      q = vec3(cos(ph) * r, 0., sin(ph) * r);
      alpha *= sin(PI * t) * 0.8;
    }
    float beam = 1. + 0.45 * q.x / max(length(q.xz), 1e-3); // the side coming towards us is brighter
    alpha *= beam; glow += max(0., beam - 1.) * 0.5;
    vec3 w = rotX(q, ${HOLE.tilt.toFixed(3)});
    if(w.z < 0. && length(w.xy) < ${HOLE.shadow.toFixed(3)}) alpha = 0.; // behind the hole
    return w;
  }
  if(h == 7){ // gears: each turns about its own axle at its true ratio
    if(part > 34.5 && part < 35.5){
      vec2 c = o.y < 0.5 ? GEAR_C0 : o.y < 1.5 ? GEAR_C1 : o.y < 2.5 ? GEAR_C2 : GEAR_C3;
      float w = o.y < 0.5 ? GEAR_W0 : o.y < 1.5 ? GEAR_W1 : o.y < 2.5 ? GEAR_W2 : GEAR_W3;
      p.xy = rot2(p.xy - c, uTime * w) + c;
    }
    return rotY(rotX(p, ${GEAR_VIEW[0].toFixed(3)}), ${GEAR_VIEW[1].toFixed(3)} + sin(uTime * 0.25) * 0.22);
  }
  if(h == 8){ // hourglass: the sand runs through, the glass turns over, the sand settles again
    float cyc = fract(uTime / 12.);
    float flip = PI * smoothstep(0.88, 0.99, cyc);
    if(part > 35.5 && part < 36.5){
      float r1 = fract(o.z * 91.7), ang = o.z * 6.2831853;
      float st = clamp((cyc - 0.07) / 0.78, 0., 1.) * 1.035;
      p = sandAt(o.y, st, r1, ang);
      if(cyc < 0.07){ vec3 s0 = sandAt(o.y, 1.035, r1, ang); p = mix(vec3(-s0.x, -s0.y, s0.z), p, smoothstep(0., 0.07, cyc)); }
    }
    return rotY(rotZ(p, flip), sin(uTime * 0.3) * 0.3);
  }
  if(h == 9){ // tesseract: turning in the xw and zw planes, projected in 4D perspective
    vec4 q = vec4(p, o.y);
    q.xw = rot2(q.xw, uTime * 0.42);
    q.zw = rot2(q.zw, uTime * 0.27);
    q.yz = rot2(q.yz, uTime * 0.11);
    vec3 pp = q.xyz * (2.6 / (3.4 - q.w));
    alpha *= mix(0.5, 1.2, clamp((q.w + 1.4) / 2.8, 0., 1.));
    if(o.z > 0.5 && o.z < 1.5) glow += 0.5;
    return rotX(rotY(pp, uTime * 0.1), 0.35);
  }
  if(h == 10){ // wormhole: light spirals in over one sheet, through the throat and out the other
    if(part > 37.5 && part < 38.5){
      float s = fract(o.y + uTime * 0.1), y = (1. - 2. * s) * ${WORM.YMAX.toFixed(4)};
      float r = ${WORM.R0.toFixed(4)} * cosh(y / ${WORM.A.toFixed(4)}) * 1.015;
      float ph = o.z - 2.6 * tanh(y / ${(WORM.A * 1.4).toFixed(4)});
      p = vec3(cos(ph) * r, y, sin(ph) * r);
      alpha *= smoothstep(0., 0.1, s) * smoothstep(1., 0.9, s);
      glow += 0.35 * exp(-abs(y) * 5.);
    }
    return rotX(rotY(p, uTime * 0.12), ${WORM_VIEW.toFixed(3)});
  }
  if(h == 11){ // turntable: the record spins at 33⅓ under a fixed sheen; notes drift up
    if(part > 39.5 && part < 40.5){
      float t = fract(uTime * 0.16 + o.y * 0.15 + o.z * 0.33);
      vec3 b = o.z < 0.5 ? ${f3(NOTE_BASE[0])} : o.z < 1.5 ? ${f3(NOTE_BASE[1])} : ${f3(NOTE_BASE[2])};
      alpha *= sin(PI * t);
      return b + rotZ(p, sin(uTime + o.z) * 0.2) * 0.6 + vec3(sin(t * 5. + o.z * 2.) * 0.12, t * 1.3, 0.);
    }
    if(part > 38.5 && part < 39.5){
      vec2 c = ${`vec2(${DECK.c[0].toFixed(3)}, ${DECK.c[2].toFixed(3)})`};
      p.xz = rot2(p.xz - c, -uTime * 3.49) + c;
      if(o.y > 0.33 && o.y < 1.){ float ph = atan(p.z - c.y, p.x - c.x), sheen = pow(abs(cos(ph - 0.7)), 10.); alpha *= 0.5 + sheen; glow += sheen * 0.35; }
    }
    return rotY(rotX(p, ${DECK.view[0].toFixed(3)}), ${DECK.view[1].toFixed(3)} + sin(uTime * 0.25) * 0.15);
  }
  if(h == 12){ // jellyfish: the bell pulses, margin first; tentacles and arms follow in a wave
    float ph = uTime * 2.4, c = pow(0.5 + 0.5 * sin(ph), 2.);
    if(part > 40.5 && part < 41.5){ float v = o.y; p.xz *= 1. - 0.15 * c * v * v; p.y += 0.07 * c * v * v; }
    if(part > 41.5 && part < 42.5){
      float t = o.y, lag = ph - t * 3.4;
      p.xz *= 1. - 0.15 * c * (1. - t * 0.6);
      p.x += sin(lag + o.z * 2.) * 0.13 * t; p.z += cos(lag * 0.8 + o.z * 3.) * 0.13 * t;
      p.y += 0.12 * c * t;
    }
    if(part > 42.5 && part < 43.5){ float t = o.y; p.x += sin(uTime * 1.2 - t * 2.5 + o.z) * 0.1 * t; p.z += cos(uTime * 1. - t * 2. + o.z * 1.7) * 0.1 * t; }
    glow += 0.15 * c;
    return rotZ(rotX(p, 0.3), sin(uTime * 0.4) * 0.07) + vec3(0., 0.1 * sin(ph - 1.3) - 0.05, 0.);
  }
  if(h == 13){ // samurai: the eyes smoulder, the hair stirs, the helmet turns to look about
    if(part > 43.5 && part < 44.5){ float e = 0.5 + 0.5 * sin(uTime * 2.2); glow += (0.15 + 0.45 * e) * (1. - o.y * 0.6); alpha *= 0.7 + 0.3 * e; }
    if(part > 44.5 && part < 45.5) p.x += sin(uTime * 1.3 + p.y * 3.) * 0.025 * o.y;
    return rotY(rotX(p, sin(uTime * 0.5) * 0.04), -0.2 + sin(uTime * 0.35) * 0.45) + vec3(0., sin(uTime * 0.9) * 0.04, 0.);
  }
  if(h == 14){ // dragon: a wave runs down the body to the tail, the barbels trail
    if(part > 45.5 && part < 46.5) p += vec3(0., sin(uTime * 1.7 - o.y * 16.) * 0.07, cos(uTime * 1.4 - o.y * 13.) * 0.06) * smoothstep(0., 0.25, o.y);
    if(part > 47.5 && part < 48.5) p += vec3(sin(uTime * 1.5 - o.y * 4.) * 0.03, sin(uTime * 2.2 - o.y * 5.) * 0.05, cos(uTime * 1.8 - o.y * 4.) * 0.04) * o.y;
    return rotY(rotX(p, ${DRAGON_VIEW[0].toFixed(3)}), ${DRAGON_VIEW[1].toFixed(3)} + sin(uTime * 0.22) * 0.3) + vec3(0., sin(uTime * 0.8) * 0.05, 0.);
  }
  return p;
}
`
