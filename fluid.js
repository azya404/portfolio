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
    VELOCITY_DISSIPATION: 0.90,
    PRESSURE:             0.8,
    PRESSURE_ITERATIONS:  20,
    CURL:                 25,
    SPLAT_RADIUS:         0.18,
    SPLAT_FORCE:          6000,
  };

  // Extended palette — dark-mode complementary colours, RGB 0-1
  const PALETTE = [
    { r: 0.22,  g: 0.48,  b: 1.00  },  // blue         #387aff
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
void main(){
  vec4 c = texture2D(uTexture,vUv);
  float alpha = max(max(c.r,c.g),c.b);
  gl_FragColor = vec4(c.rgb, alpha);
}`;

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

  // ── Idle burst (FSM-controlled — does NOT self-schedule) ──
  function burstSplats() {
    const w = canvas.width, h = canvas.height;
    const f = CFG.SPLAT_FORCE * 0.8;
    const count = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const x     = w * (0.1 + Math.random() * 0.8);
      const y     = h * (0.1 + Math.random() * 0.8);
      const angle = Math.random() * Math.PI * 2;
      const mag   = f * (0.5 + Math.random() * 0.7);
      splat(x, y, Math.cos(angle) * mag, Math.sin(angle) * mag, nextColour());
    }
  }

  // ── FSM: HIDDEN → IDLE ↔ ACTIVE ──────────────────────────
  // HIDDEN  : hero not in viewport — nothing fires
  // IDLE    : hero visible, no recent mouse activity — periodic bursts
  // ACTIVE  : user is moving mouse on hero — reactive splats, no idle bursts
  const S = { HIDDEN: 0, IDLE: 1, ACTIVE: 2 };
  let fsmState = S.HIDDEN;
  let idleTimer      = null;
  let inactiveTimer  = null;
  const INACTIVITY_MS = 2000; // ms of no movement before returning to IDLE

  function scheduleIdleBurst() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (fsmState === S.IDLE) {
        burstSplats();
        scheduleIdleBurst();   // chain only while IDLE
      }
    }, 5000 + Math.random() * 5000);
  }

  function enterIdle() {
    fsmState = S.IDLE;
    scheduleIdleBurst();
  }

  function enterActive() {
    fsmState = S.ACTIVE;
    clearTimeout(idleTimer);      // stop idle bursts immediately
    clearTimeout(inactiveTimer);
  }

  function enterHidden() {
    fsmState = S.HIDDEN;
    clearTimeout(idleTimer);
    clearTimeout(inactiveTimer);
  }

  // IntersectionObserver — drives HIDDEN ↔ IDLE transitions
  const heroObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      if (fsmState === S.HIDDEN) enterIdle();
    } else {
      enterHidden();
    }
  }, { threshold: 0.01 });
  heroObserver.observe(hero);

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

  // ── Lazy init — loop only starts on first hero interaction ───
  let simStarted = false;
  function startSim() {
    if (simStarted) return;
    simStarted = true;
    requestAnimationFrame(loop);
  }

  // ── Debug panel (branch-preview only — remove before merge) ──
  (function buildDebugPanel() {
    const params = [
      { key: 'SIM_RESOLUTION',       min: 32,   max: 256,  step: 32,   label: 'Sim Res' },
      { key: 'DYE_RESOLUTION',       min: 128,  max: 2048, step: 128,  label: 'Dye Res' },
      { key: 'DENSITY_DISSIPATION',  min: 0.50, max: 1.00, step: 0.01, label: 'Density Diss' },
      { key: 'VELOCITY_DISSIPATION', min: 0.50, max: 5.00, step: 0.05, label: 'Velocity Diss' },
      { key: 'PRESSURE',             min: 0.00, max: 1.00, step: 0.05, label: 'Pressure' },
      { key: 'PRESSURE_ITERATIONS',  min: 5,    max: 40,   step: 1,    label: 'Pressure Iter' },
      { key: 'CURL',                 min: 0,    max: 50,   step: 1,    label: 'Curl' },
      { key: 'SPLAT_RADIUS',         min: 0.05, max: 0.50, step: 0.01, label: 'Splat Radius' },
      { key: 'SPLAT_FORCE',          min: 500,  max: 12000,step: 500,  label: 'Splat Force' },
    ];

    const panel = document.createElement('div');
    panel.id = 'fluid-debug';
    Object.assign(panel.style, {
      position: 'fixed', bottom: '16px', right: '16px', zIndex: 9999,
      background: 'rgba(5,13,26,0.92)', border: '1px solid #4af0c4',
      borderRadius: '10px', padding: '12px 16px', color: '#ddeeff',
      fontFamily: 'monospace', fontSize: '12px', width: '240px',
      boxShadow: '0 4px 24px rgba(0,0,0,0.6)', userSelect: 'none',
    });

    const title = document.createElement('div');
    title.textContent = '⚙ fluid debug';
    Object.assign(title.style, { color: '#4af0c4', marginBottom: '10px', fontWeight: 'bold', fontSize: '13px' });
    panel.appendChild(title);

    const resolutionKeys = new Set(['SIM_RESOLUTION', 'DYE_RESOLUTION']);

    params.forEach(({ key, min, max, step, label }) => {
      const row = document.createElement('div');
      Object.assign(row.style, { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' });

      const lbl = document.createElement('span');
      lbl.textContent = label;
      Object.assign(lbl.style, { flex: '0 0 110px', fontSize: '11px', color: '#aac' });

      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = min; slider.max = max; slider.step = step;
      slider.value = CFG[key];
      Object.assign(slider.style, { flex: '1', accentColor: '#4af0c4' });

      const val = document.createElement('span');
      val.textContent = CFG[key];
      Object.assign(val.style, { flex: '0 0 38px', textAlign: 'right', fontSize: '11px' });

      slider.addEventListener('input', () => {
        const v = parseFloat(slider.value);
        CFG[key] = v;
        val.textContent = v;
        if (resolutionKeys.has(key)) initBuffers();
      });

      row.appendChild(lbl);
      row.appendChild(slider);
      row.appendChild(val);
      panel.appendChild(row);
    });

    document.body.appendChild(panel);
  })();

  // ── Mouse / touch input ───────────────────────────────────
  let px = 0, py = 0, moved = false;
  let vx = 0, vy = 0;
  let strokeColour = nextColour();

  function onMove(cx, cy) {
    const rect = canvas.getBoundingClientRect();
    const nx = cx - rect.left;
    const ny = cy - rect.top;

    const targetDx = (nx - px) / canvas.width  * CFG.SPLAT_FORCE;
    const targetDy = (ny - py) / canvas.height * CFG.SPLAT_FORCE;
    vx += (targetDx - vx) * 0.4;
    vy += (targetDy - vy) * 0.4;

    px = nx;
    py = ny;

    if (moved) splat(px, py, vx, vy, strokeColour);
    moved = true;

    // Transition to ACTIVE and reset inactivity countdown
    if (fsmState !== S.ACTIVE) enterActive();
    clearTimeout(inactiveTimer);
    inactiveTimer = setTimeout(() => {
      // No movement for INACTIVITY_MS → return to idle if hero still visible
      moved = false; vx = 0; vy = 0;
      if (fsmState === S.ACTIVE) enterIdle();
    }, INACTIVITY_MS);
  }

  hero.addEventListener('mousemove',  (e) => { startSim(); onMove(e.clientX, e.clientY); },                       { passive: true });
  hero.addEventListener('touchmove',  (e) => { startSim(); onMove(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });

  hero.addEventListener('mouseenter', () => { strokeColour = nextColour(); });
  hero.addEventListener('mouseleave', () => {
    moved = false; vx = 0; vy = 0;
    clearTimeout(inactiveTimer);
    strokeColour = nextColour();
    if (fsmState === S.ACTIVE) enterIdle();
  });
  hero.addEventListener('touchend', () => {
    moved = false; vx = 0; vy = 0;
    clearTimeout(inactiveTimer);
    if (fsmState === S.ACTIVE) enterIdle();
  });

})();
