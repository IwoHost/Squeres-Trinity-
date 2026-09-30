// Screen effects over the finished frame: a fish-eye bulge, blue glass shading and a CRT look on the game square, and TV static.
// The game draws into an offscreen 2D canvas; this pass copies it to the visible (and recorded) canvas with WebGL.
(function () {
  const SQ = window.SQ;

  const VERT = `
attribute vec2 p;
varying vec2 uv;
void main() {
  uv = vec2(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5);
  gl_Position = vec4(p, 0.0, 1.0);
}`;

  const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D tex;
uniform float fish;    // 0..1 bulge strength
uniform float crt;     // 0..1 old tube look on the game square: scanlines, phosphor grid, glow
uniform float noise;   // 0..1 how much static is on screen right now
uniform float glitch;  // 0..1 burst when something big happens
uniform float seed;    // changes every frame so the static moves
uniform vec2 res;
uniform vec4 box;      // the game square, as x0, y0, x1, y1 in 0..1 screen units
varying vec2 uv;

// kept to small numbers so it also works on phones with low-precision GPUs
float rand(vec2 c) {
  c = mod(c, 289.0);
  return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 u = uv;
  // fish-eye only inside the game square
  vec2 size = box.zw - box.xy;
  vec2 l = (uv - box.xy) / size;
  float inBox = step(0.0, l.x) * step(l.x, 1.0) * step(0.0, l.y) * step(l.y, 1.0);
  vec2 c = l - 0.5;
  float r2 = dot(c, c) / 0.5; // 0 in the middle, 1 in the corners
  if (inBox > 0.5) {
    // the corners stay pinned, so the square is always filled with the game; the middle swells
    vec2 s = c * (1.0 - fish * 0.25 * (1.0 - r2));
    u = box.xy + (s + 0.5) * size;
  }
  vec2 tube = u; // where this pixel sits on the curved tube, before any tearing
  float row = floor(uv.y * res.y / 3.0);
  // torn rows: a few bands slide sideways, more with static, a lot during a glitch
  float band = floor(uv.y * 48.0 + seed * 7.0);
  float tear = step(1.0 - (noise * 0.08 + glitch * 0.35), rand(vec2(band, seed)));
  u.x += tear * (rand(vec2(band, seed + 1.0)) - 0.5) * (0.015 + noise * 0.03 + glitch * 0.12);
  // a slow rolling bar, like a badly tuned signal
  float roll = fract(uv.y * 0.9 - seed * 0.013);
  float bar = smoothstep(0.0, 0.08, roll) * smoothstep(0.2, 0.08, roll);
  u.x += bar * noise * 0.006;
  // colors split apart during a glitch
  float split = glitch * 0.012 + noise * 0.0025;
  vec3 col;
  col.r = texture2D(tex, u + vec2(split, 0.0)).r;
  col.g = texture2D(tex, u).g;
  col.b = texture2D(tex, u - vec2(split, 0.0)).b;
  // CRT: bright things glow, colors fringe toward the edges, and the picture is made of lines and phosphors
  if (inBox > 0.5 && crt > 0.0) {
    vec2 px = 1.0 / res;
    vec3 glow = texture2D(tex, u + vec2(px.x * 3.0, 0.0)).rgb + texture2D(tex, u - vec2(px.x * 3.0, 0.0)).rgb
              + texture2D(tex, u + vec2(0.0, px.y * 3.0)).rgb + texture2D(tex, u - vec2(0.0, px.y * 3.0)).rgb;
    glow *= 0.25;
    // only the brightest things glow, and in their own color, so yellow stays yellow
    float lum = dot(glow, vec3(0.3, 0.55, 0.15));
    col += glow * smoothstep(0.55, 1.0, lum) * 0.22 * crt;
    vec2 fringe = c * r2 * crt * 0.006;
    col.r = mix(col.r, texture2D(tex, u + fringe).r, crt);
    col.b = mix(col.b, texture2D(tex, u - fringe).b, crt);
    // scanlines follow the curve of the tube
    float line = 0.5 + 0.5 * cos(tube.y * res.y * 2.0944);
    col *= 1.0 - crt * 0.26 * (1.0 - line);
    float m = mod(floor(gl_FragCoord.x), 3.0);
    vec3 mask = m < 1.0 ? vec3(1.0, 0.82, 0.82) : m < 2.0 ? vec3(0.82, 1.0, 0.82) : vec3(0.82, 0.82, 1.0);
    col *= mix(vec3(1.0), mask, crt * 0.3); // kept soft so it doesn't shimmer when the video is scaled down
    col *= 1.0 - crt * 0.25 * max(0.0, r2 - 0.35); // the tube is dimmer in its corners
    col *= 1.0 + (rand(vec2(seed, 3.0)) - 0.5) * 0.03 * crt; // a faint flicker
  }
  // static: grain over everything, stronger bright specks
  float n = rand(vec2(floor(uv.x * res.x / 2.0), row) + seed);
  float amount = noise * 0.5 + glitch * 0.35;
  col = mix(col, vec3(n), amount * (0.55 + 0.45 * n));
  col += bar * noise * 0.08;
  // faint scanlines
  col *= 1.0 - 0.06 * noise * step(0.5, fract(uv.y * res.y / 4.0));
  // the game square gets a glass look: a cool blue shade toward its edges and a soft sheen
  if (inBox > 0.5) {
    vec2 d = min(l, 1.0 - l);
    float edge = 1.0 - smoothstep(0.0, 0.2, min(d.x, d.y));
    float shade = fish * (0.3 * edge + 0.3 * max(0.0, r2 - 0.25));
    col = mix(col, col * vec3(0.55, 0.68, 1.0) + vec3(0.0, 0.015, 0.06), clamp(shade, 0.0, 0.8));
    float sheen = smoothstep(0.6, 0.0, length((l - vec2(0.2, 0.12)) * vec2(1.0, 1.6)));
    col += vec3(0.04, 0.07, 0.13) * sheen * fish;
  }
  gl_FragColor = vec4(col, 1.0);
}`;

  class PostFX {
    // view: the visible canvas. Returns an object whose .ok says whether WebGL is available.
    constructor(view) {
      this.view = view;
      this.ok = false;
      let gl = null;
      try {
        gl = view.getContext('webgl', { alpha: false, antialias: false, depth: false, preserveDrawingBuffer: true });
      } catch (e) {}
      if (!gl) return;
      const sh = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
      };
      const vs = sh(gl.VERTEX_SHADER, VERT);
      const fs = sh(gl.FRAGMENT_SHADER, FRAG);
      if (!vs || !fs) return;
      const prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'p');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.gl = gl;
      this.u = {};
      for (const k of ['fish', 'crt', 'noise', 'glitch', 'seed', 'res', 'box']) this.u[k] = gl.getUniformLocation(prog, k);
      this.ok = true;
    }

    // Copies the scene to the screen with the effects applied.
    draw(scene, fish, noise, glitch, crt) {
      const gl = this.gl;
      if (this.view.width !== scene.width || this.view.height !== scene.height) {
        this.view.width = scene.width;
        this.view.height = scene.height;
      }
      gl.viewport(0, 0, scene.width, scene.height);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, scene);
      gl.uniform1f(this.u.fish, fish);
      gl.uniform1f(this.u.crt, crt || 0);
      gl.uniform1f(this.u.noise, noise);
      gl.uniform1f(this.u.glitch, glitch);
      gl.uniform1f(this.u.seed, (Math.random() * 97) | 0);
      gl.uniform2f(this.u.res, scene.width, scene.height);
      const A = SQ.ARENA;
      gl.uniform4f(this.u.box, A.x / SQ.W, A.y / SQ.H, (A.x + A.size) / SQ.W, (A.y + A.size) / SQ.H);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  }

  SQ.PostFX = PostFX;
})();
