/* ============================================
   HAASYA SHAH · PORTFOLIO
   fluid.js — WebGL Navier-Stokes fluid sim
   Hero-section confined, site-palette colours
   Adapted from WebGL-Fluid-Simulation (MIT) by Pavel Dobryakov
   ============================================ */

(function () {
  'use strict';

  // Respect reduced-motion preference
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const canvas = document.getElementById('fluid-canvas');
  const hero   = document.getElementById('hero');
  if (!canvas || !hero) return;

  // ── Config ───────────────────────────────────────────────
  const mobile = window.innerWidth < 768;
  const CFG = {
    SIM_RESOLUTION:       128,
    DYE_RESOLUTION:       mobile ? 512 : 1024,
    DENSITY_DISSIPATION:  0.98,
    VELOCITY_DISSIPATION: 0.94,
    PRESSURE:             0.8,
    PRESSURE_ITERATIONS:  20,
    CURL:                 1,
    SPLAT_RADIUS:         0.30,
    SPLAT_FORCE:          3000,
  };

  // Extended palette — dark-mode complementary colours, RGB 0-1
  const PALETTE = [
    { r: 0.29,  g: 0.94,  b: 0.77  },  // teal         #4af0c4  (site accent)
    { r: 0.22,  g: 0.48,  b: 1.00  },  // blue         #387aff
    { r: 0.55,  g: 0.36,  b: 0.96  },  // indigo       #8c5cf5
    { r: 0.00,  g: 0.75,  b: 1.00  },  // cyan         #00bfff
    { r: 0.96,  g: 0.25,  b: 0.40  },  // rose-red     #f54066
    { r: 1.00,  g: 0.55,  b: 0.10  },  // amber        #ff8c1a
    { r: 1.00,  g: 0.85,  b: 0.20  },  // yellow       #ffd933
    { r: 0.90,  g: 0.30,  b: 0.80  },  // hot pink     #e64dcc
    { r: 0.70,  g: 0.20,  b: 0.95  },  // violet       #b233f2
    { r: 0.20,  g: 0.90,  b: 0.40  },  // lime green   #33e666
    { r: 0.95,  g: 0.95,  b: 0.90  },  // off-white    #f2f2e6
    { r: 0.00,  g: 0.85,  b: 0.65  },  // emerald      #00d9a6
  ];
  let palIdx = 0;
  function nextColour() {
    const c = PALETTE[palIdx % PALETTE.length];
    palIdx++;
    return { r: c.r, g: c.g, b: c.b };
  }

  // ── WebGL context ────────────────────────────────────────
  const ctxOpts = { alpha: true, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: false };
  let gl = canvas.getContext('webgl2', ctxOpts);
  const isWebGL2 = !!gl;
  if (!isWebGL2) gl = canvas.getContext('webgl', ctxOpts) || canvas.getContext('experimental-webgl', ctxOpts);
  if (!gl) return;

  let halfFloat, linFilter;
  if (isWebGL2) {
    gl.getExtension('EXT_color_buffer_float');
    linFilter = !!gl.getExtension('OES_texture_float_linear');
  } else {
    halfFloat = gl.getExtension('OES_texture_half_float');
    linFilter = !!gl.getExtension('OES_texture_half_float_linear');
  }
  gl.clearColor(0, 0, 0, 0);

  const HF = isWebGL2 ? gl.HALF_FLOAT : (halfFloat && halfFloat.HALF_FLOAT_OES);
  if (!HF) return;

  // ── Texture format detection ─────────────────────────────
  function fmtOK(inFmt, fmt) {
    const t   = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, inFmt, 4, 4, 0, fmt, HF, null);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.deleteTexture(t);
    gl.deleteFramebuffer(fbo);
    return ok;
  }
  function bestFmt(inFmt, fmt) {
    if (fmtOK(inFmt, fmt)) return { internalFormat: inFmt, format: fmt };
    if (isWebGL2) {
      if (inFmt === gl.R16F)  return bestFmt(gl.RG16F,   gl.RG);
      if (inFmt === gl.RG16F) return bestFmt(gl.RGBA16F, gl.RGBA);
    }
    return { internalFormat: gl.RGBA, format: gl.RGBA };
  }
  const fmtRGBA = isWebGL2 ? bestFmt(gl.RGBA16F, gl.RGBA) : { internalFormat: gl.RGBA, format: gl.RGBA };
  const fmtRG   = isWebGL2 ? bestFmt(gl.RG16F,   gl.RG)   : { internalFormat: gl.RGBA, format: gl.RGBA };
  const fmtR    = isWebGL2 ? bestFmt(gl.R16F,    gl.RED)   : { internalFormat: gl.RGBA, format: gl.RGBA };

  // ── Quad geometry ─────────────────────────────────────────
  const qBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, qBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, -1,1, 1,1, 1,-1]), gl.STATIC_DRAW);
  const iBuf = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuf);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0,1,2, 0,2,3]), gl.STATIC_DRAW);

  // ── Shader helpers ────────────────────────────────────────
  function mkProg(vSrc, fSrc) {
    const prog = gl.createProgram();
    const vs   = gl.createShader(gl.VERTEX_SHADER);
    const fs   = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(vs, vSrc); gl.compileShader(vs);
    gl.shaderSource(fs, fSrc); gl.compileShader(fs);
    gl.attachShader(prog, vs); gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.useProgram(prog);
    // bind quad position attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, qBuf);
    const loc = gl.getAttribLocation(prog, 'aPosition');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const cache = {};
    return {
      bind()             { gl.useProgram(prog); },
      u1i(n, v)          { gl.uniform1i(this._u(n), v); },
      u1f(n, v)          { gl.uniform1f(this._u(n), v); },
      u2f(n, x, y)       { gl.uniform2f(this._u(n), x, y); },
      u3f(n, x, y, z)    { gl.uniform3f(this._u(n), x, y, z); },
      _u(n) { return (n in cache) ? cache[n] : (cache[n] = gl.getUniformLocation(prog, n)); },
    };
  }

  function blit(target) {
    if (target == null) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      gl.viewport(0, 0, target.width, target.height);
    }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuf);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  }

  // ── GLSL sources ──────────────────────────────────────────
  const baseVert = `
precision highp float;
attribute vec2 aPosition;
varying vec2 vUv;
varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
uniform vec2 texelSize;
void main(){
  vUv = aPosition*0.5+0.5;
  vL = vUv-vec2(texelSize.x,0.0); vR = vUv+vec2(texelSize.x,0.0);
  vT = vUv+vec2(0.0,texelSize.y); vB = vUv-vec2(0.0,texelSize.y);
  gl_Position = vec4(aPosition,0.0,1.0);
}`;

  const simpleVert = `
precision highp float;
attribute vec2 aPosition;
varying vec2 vUv;
void main(){
  vUv = aPosition*0.5+0.5;
  gl_Position = vec4(aPosition,0.0,1.0);
}`;

  const displayFrag = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTexture;
void main(){ gl_FragColor = texture2D(uTexture,vUv); }`;

  const clearFrag = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTexture;
uniform float value;
void main(){ gl_FragColor = value*texture2D(uTexture,vUv); }`;

  const splatFrag = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTarget;
uniform float aspectRatio;
uniform vec3 color;
uniform vec2 point;
uniform float radius;
void main(){
  vec2 p = vUv-point;
  p.x *= aspectRatio;
  vec3 splat = exp(-dot(p,p)/radius)*color;
  vec3 base  = texture2D(uTarget,vUv).xyz;
  gl_FragColor = vec4(base+splat,1.0);
}`;

  const advFrag = (manual) => `
precision highp float;
varying vec2 vUv;
uniform sampler2D uVelocity; uniform sampler2D uSource;
uniform vec2 texelSize; uniform vec2 dyeTexelSize;
uniform float dt; uniform float dissipation;
${manual ? `
vec4 bilerp(sampler2D s,vec2 uv,vec2 ts){
  vec2 st=uv/ts-0.5; vec2 iuv=floor(st); vec2 fuv=fract(st);
  vec4 a=texture2D(s,(iuv+vec2(0.5,0.5))*ts);
  vec4 b=texture2D(s,(iuv+vec2(1.5,0.5))*ts);
  vec4 c=texture2D(s,(iuv+vec2(0.5,1.5))*ts);
  vec4 d=texture2D(s,(iuv+vec2(1.5,1.5))*ts);
  return mix(mix(a,b,fuv.x),mix(c,d,fuv.x),fuv.y);
}` : ''}
void main(){
  ${manual
    ? 'vec2 coord=vUv-dt*bilerp(uVelocity,vUv,texelSize).xy*texelSize; vec4 r=bilerp(uSource,coord,dyeTexelSize);'
    : 'vec2 coord=vUv-dt*texture2D(uVelocity,vUv).xy*texelSize;         vec4 r=texture2D(uSource,coord);'}
  gl_FragColor = r/(1.0+dissipation*dt);
}`;

  const divFrag = `
precision highp float;
varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
uniform sampler2D uVelocity;
void main(){
  float L=texture2D(uVelocity,vL).x; float R=texture2D(uVelocity,vR).x;
  float T=texture2D(uVelocity,vT).y; float B=texture2D(uVelocity,vB).y;
  gl_FragColor = vec4(0.5*(R-L+T-B),0.0,0.0,1.0);
}`;

  const curlFrag = `
precision highp float;
varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
uniform sampler2D uVelocity;
void main(){
  float L=texture2D(uVelocity,vL).y; float R=texture2D(uVelocity,vR).y;
  float T=texture2D(uVelocity,vT).x; float B=texture2D(uVelocity,vB).x;
  gl_FragColor = vec4(0.5*(R-L-T+B),0.0,0.0,1.0);
}`;

  const vortFrag = `
precision highp float;
varying vec2 vUv;
varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
uniform sampler2D uVelocity; uniform sampler2D uCurl;
uniform float curl; uniform float dt;
void main(){
  float L=texture2D(uCurl,vL).x; float R=texture2D(uCurl,vR).x;
  float T=texture2D(uCurl,vT).x; float B=texture2D(uCurl,vB).x;
  float C=texture2D(uCurl,vUv).x;
  vec2 f=0.5*vec2(abs(T)-abs(B),abs(R)-abs(L));
  float len=max(length(f),0.0001);
  f=curl*C*(f/len);
  vec2 v=texture2D(uVelocity,vUv).xy;
  gl_FragColor = vec4(v+f*dt,0.0,1.0);
}`;

  const presFrag = `
precision highp float;
varying vec2 vUv;
varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
uniform sampler2D uPressure; uniform sampler2D uDivergence;
void main(){
  float L=texture2D(uPressure,vL).x; float R=texture2D(uPressure,vR).x;
  float T=texture2D(uPressure,vT).x; float B=texture2D(uPressure,vB).x;
  float C=texture2D(uDivergence,vUv).x;
  gl_FragColor = vec4(0.25*(L+R+T+B-C),0.0,0.0,1.0);
}`;

  const gradFrag = `
precision highp float;
varying vec2 vUv;
varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
uniform sampler2D uPressure; uniform sampler2D uVelocity;
void main(){
  float L=texture2D(uPressure,vL).x; float R=texture2D(uPressure,vR).x;
  float T=texture2D(uPressure,vT).x; float B=texture2D(uPressure,vB).x;
  vec2 v=texture2D(uVelocity,vUv).xy-0.5*vec2(R-L,T-B);
  gl_FragColor = vec4(v,0.0,1.0);
}`;

  // ── Compile programs ──────────────────────────────────────
  const progDisplay = mkProg(simpleVert, displayFrag);
  const progClear   = mkProg(simpleVert, clearFrag);
  const progSplat   = mkProg(simpleVert, splatFrag);
  const progAdvect  = mkProg(simpleVert, advFrag(!linFilter));
  const progDiv     = mkProg(baseVert,   divFrag);
  const progCurl    = mkProg(baseVert,   curlFrag);
  const progVort    = mkProg(baseVert,   vortFrag);
  const progPres    = mkProg(baseVert,   presFrag);
  const progGrad    = mkProg(baseVert,   gradFrag);

  // ── FBO / texture helpers ─────────────────────────────────
  let texSlot = 0;
  function mkTex(filter, fmt, w, h) {
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + texSlot);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, fmt.internalFormat, w, h, 0, fmt.format, HF, null);
    texSlot++;
    function attach(unit) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      return unit;
    }
    return { tex, width: w, height: h, attach };
  }

  function mkFBO(filter, fmt, w, h) {
    const texture = mkTex(filter, fmt, w, h);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture.tex, 0);
    gl.viewport(0, 0, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return {
      fbo, width: w, height: h, texture,
      attach(unit) { return this.texture.attach(unit); },
    };
  }

  function mkDouble(filter, fmt, w, h) {
    let a = mkFBO(filter, fmt, w, h);
    let b = mkFBO(filter, fmt, w, h);
    return {
      width: w, height: h,
      get read()  { return a; },
      get write() { return b; },
      swap()      { const t = a; a = b; b = t; },
    };
  }

  // ── Buffer allocation ─────────────────────────────────────
  const F = linFilter ? gl.LINEAR : gl.NEAREST;

  function simDims() {
    const ar  = canvas.width / canvas.height;
    const sr  = CFG.SIM_RESOLUTION;
    const dr  = CFG.DYE_RESOLUTION;
    const sw  = ar > 1 ? Math.round(sr * ar) : sr;
    const sh  = ar > 1 ? sr : Math.round(sr / ar);
    const dw  = ar > 1 ? Math.round(dr * ar) : dr;
    const dh  = ar > 1 ? dr : Math.round(dr / ar);
    return { sw, sh, dw, dh };
  }

  let velocity, dye, pressure, divergence, curlFBO;

  function initBuffers() {
    texSlot = 0;
    const { sw, sh, dw, dh } = simDims();
    velocity   = mkDouble(F,           fmtRG,   sw, sh);
    dye        = mkDouble(F,           fmtRGBA, dw, dh);
    pressure   = mkDouble(gl.NEAREST,  fmtR,    sw, sh);
    divergence = mkFBO(   gl.NEAREST,  fmtR,    sw, sh);
    curlFBO    = mkFBO(   gl.NEAREST,  fmtR,    sw, sh);
  }

  // ── Canvas + buffer resize ────────────────────────────────
  function resize() {
    const w = hero.offsetWidth;
    const h = hero.offsetHeight;
    if (canvas.width === w && canvas.height === h) return;
    canvas.width  = w;
    canvas.height = h;
    initBuffers();
  }

  canvas.width  = hero.offsetWidth;
  canvas.height = hero.offsetHeight;
  initBuffers();
  window.addEventListener('resize', resize, { passive: true });

  // ── Splat ─────────────────────────────────────────────────
  function splat(x, y, dx, dy, col) {
    const ar = canvas.width / canvas.height;
    progSplat.bind();
    progSplat.u1i('uTarget',     velocity.read.attach(0));
    progSplat.u1f('aspectRatio', ar);
    progSplat.u2f('point',       x / canvas.width, 1.0 - y / canvas.height);
    progSplat.u3f('color',       dx, -dy, 0.0);
    progSplat.u1f('radius',      CFG.SPLAT_RADIUS / 100.0);
    blit(velocity.write);
    velocity.swap();

    progSplat.u1i('uTarget', dye.read.attach(0));
    progSplat.u3f('color',   col.r, col.g, col.b);
    blit(dye.write);
    dye.swap();
  }

  // Seed initial splats so the canvas isn't blank on load
  function seedSplats() {
    const w = canvas.width, h = canvas.height, f = CFG.SPLAT_FORCE * 0.8;
    [
      { x: w*0.20, y: h*0.35, dx:  0.4*f, dy:  0.2*f, c: PALETTE[0]  },  // teal
      { x: w*0.75, y: h*0.40, dx: -0.3*f, dy:  0.3*f, c: PALETTE[2]  },  // indigo
      { x: w*0.50, y: h*0.65, dx:  0.2*f, dy: -0.4*f, c: PALETTE[4]  },  // rose
      { x: w*0.35, y: h*0.55, dx: -0.2*f, dy: -0.2*f, c: PALETTE[1]  },  // blue
      { x: w*0.65, y: h*0.25, dx:  0.1*f, dy:  0.3*f, c: PALETTE[8]  },  // violet
    ].forEach(s => splat(s.x, s.y, s.dx, s.dy, s.c));
  }

  // ── Simulation step ───────────────────────────────────────
  function step(dt) {
    gl.disable(gl.BLEND);
    const sw = velocity.read.width, sh = velocity.read.height;
    const tsx = 1 / sw, tsy = 1 / sh;

    // Curl
    progCurl.bind();
    progCurl.u2f('texelSize', tsx, tsy);
    progCurl.u1i('uVelocity', velocity.read.attach(0));
    blit(curlFBO);

    // Vorticity confinement
    progVort.bind();
    progVort.u2f('texelSize', tsx, tsy);
    progVort.u1i('uVelocity', velocity.read.attach(0));
    progVort.u1i('uCurl',     curlFBO.attach(1));
    progVort.u1f('curl',      CFG.CURL);
    progVort.u1f('dt',        dt);
    blit(velocity.write);
    velocity.swap();

    // Divergence
    progDiv.bind();
    progDiv.u2f('texelSize', tsx, tsy);
    progDiv.u1i('uVelocity', velocity.read.attach(0));
    blit(divergence);

    // Clear pressure
    progClear.bind();
    progClear.u1i('uTexture', pressure.read.attach(0));
    progClear.u1f('value',    CFG.PRESSURE);
    blit(pressure.write);
    pressure.swap();

    // Pressure Jacobi iterations
    progPres.bind();
    progPres.u2f('texelSize',   tsx, tsy);
    progPres.u1i('uDivergence', divergence.attach(0));
    for (let i = 0; i < CFG.PRESSURE_ITERATIONS; i++) {
      progPres.u1i('uPressure', pressure.read.attach(1));
      blit(pressure.write);
      pressure.swap();
    }

    // Gradient subtract
    progGrad.bind();
    progGrad.u2f('texelSize', tsx, tsy);
    progGrad.u1i('uPressure', pressure.read.attach(0));
    progGrad.u1i('uVelocity', velocity.read.attach(1));
    blit(velocity.write);
    velocity.swap();

    // Advect velocity (self-advection)
    progAdvect.bind();
    progAdvect.u2f('texelSize',    tsx, tsy);
    progAdvect.u2f('dyeTexelSize', tsx, tsy);
    progAdvect.u1i('uVelocity',    velocity.read.attach(0));
    progAdvect.u1i('uSource',      velocity.read.attach(0));
    progAdvect.u1f('dt',           dt);
    progAdvect.u1f('dissipation',  CFG.VELOCITY_DISSIPATION);
    blit(velocity.write);
    velocity.swap();

    // Advect dye
    const dw = dye.read.width, dh = dye.read.height;
    progAdvect.u2f('dyeTexelSize', 1/dw, 1/dh);
    progAdvect.u1i('uVelocity',    velocity.read.attach(0));
    progAdvect.u1i('uSource',      dye.read.attach(1));
    progAdvect.u1f('dissipation',  CFG.DENSITY_DISSIPATION);
    blit(dye.write);
    dye.swap();
  }

  // ── Render to canvas ──────────────────────────────────────
  function render() {
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.BLEND);
    progDisplay.bind();
    progDisplay.u1i('uTexture', dye.read.attach(0));
    blit(null);
  }

  // ── Animation loop ────────────────────────────────────────
  let lastTime = performance.now();
  function loop(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.016667);
    lastTime = now;
    if (!document.hidden) {
      step(dt);
      render();
    }
    requestAnimationFrame(loop);
  }

  seedSplats();
  requestAnimationFrame(loop);

  // ── Mouse / touch input ───────────────────────────────────
  let px = 0, py = 0, moved = false;

  function onMove(cx, cy) {
    const rect = canvas.getBoundingClientRect();
    const nx   = cx - rect.left;
    const ny   = cy - rect.top;
    // Clamp delta so fast sweeps don't explode the simulation
    const clamp = (v, max) => Math.min(Math.abs(v), max) * Math.sign(v);
    const dx   = clamp(nx - px, 25) * CFG.SPLAT_FORCE;
    const dy   = clamp(ny - py, 25) * CFG.SPLAT_FORCE;
    px = nx; py = ny;
    if (moved) splat(px, py, dx, dy, nextColour());
    moved = true;
  }

  hero.addEventListener('mousemove',  (e) => onMove(e.clientX, e.clientY),           { passive: true });
  hero.addEventListener('touchmove',  (e) => onMove(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
  hero.addEventListener('mouseleave', ()  => { moved = false; });
  hero.addEventListener('touchend',   ()  => { moved = false; });

})();
