// scripts/ui/CursorOverlay.js
import appState from "../core/AppState.js"; // adjust path if needed

export default class CursorOverlay {
  constructor({
    mode = "paw",
    zIndex = 20,
    maxHistory = 120,
    domElement = null,
    showDelayMs = 120, // hold before we consider it an orbit/pan
    dragThresholdPx = 8, // pixels of movement to count as a drag
    shouldSuppress = null, // (e) => boolean; return true to hide gizmo
    reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")
      ?.matches ?? false,
  } = {}) {
    this.showDelayMs = showDelayMs;
    this.dragThresholdPx = dragThresholdPx;
    this.shouldSuppress =
      typeof shouldSuppress === "function" ? shouldSuppress : null;
    this._down = null; // {x,y,timer,button,type,shown}

    /* -------- modes & state -------- */
    this.MODES = ["ink", "comet", "clickPing", "confetti", "paw"];
    this.confettiAlwaysOn = true; // run confetti regardless of this.mode

    this.mode = (reducedMotion ? "paw" : mode) || "paw";
    this.enabled = true;
    this.running = false;
    this.zIndex = zIndex;
    this.domEl =
      domElement || (appState?.renderer?.domElement ?? document.body);

    /* -------- canvas -------- */
    this.canvas = document.createElement("canvas");
    this.canvas.style.cssText = `position:fixed; inset:0; pointer-events:none; z-index:${zIndex};`;
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");
    this._resize = this._resize.bind(this);
    window.addEventListener("resize", this._resize, { passive: true });
    this._resize();

    /* -------- pointer/time -------- */
    this.pos = { x: innerWidth * 0.5, y: innerHeight * 0.5 };
    this.lastPos = { ...this.pos };
    this.vel = { x: 0, y: 0 };
    this.speed = 0;
    this.samples = [];
    this.maxHistory = maxHistory;
    this._lastT = performance.now();
    this._loop = this._loop.bind(this);

    /* -------- events -------- */
    // follow pointer everywhere (effects need this)
    this._onMove = (e) => {
      this.pos.x = e.clientX;
      this.pos.y = e.clientY;
      if (!this._isOverlayActive()) return;

      if (this._down && !this._down.shown) {
        const dx = e.clientX - this._down.x;
        const dy = e.clientY - this._down.y;
        if (dx * dx + dy * dy >= this.dragThresholdPx * this.dragThresholdPx) {
          // movement-based intent satisfied
          this._gizmoBegin(this._down.type);
          this._down.shown = true;
        }
      }
    };

    window.addEventListener("pointermove", this._onMove, { passive: true });

    /* Make sure the 3D canvas never steals touch gestures from OrbitControls */
    if (this.domEl && this.domEl.style) {
      // important for mobile: lets OrbitControls receive touch + prevents browser panning/zooming
      this.domEl.style.touchAction = "none";
    }

    /* pointerdown → HUD only if the press began on the renderer element */
    this._onDown = (e) => {
      if (!this._isOnDomEl(e) || e.defaultPrevented) return;
      if (!this._isOverlayActive()) return;

      // block if caller says this click is for UI/object interaction
      if (this.shouldSuppress?.(e)) return;

      const type =
        e.pointerType === "mouse"
          ? e.button === 2
            ? "pan"
            : "orbit"
          : "orbit";

      // start “intent” tracking; don’t show yet
      this._down = {
        x: e.clientX,
        y: e.clientY,
        button: e.button,
        type,
        shown: false,
        timer: setTimeout(() => {
          // time-based intent satisfied → show if still holding and not suppressed
          if (this._down && !this._down.shown) {
            this._gizmoBegin(type);
            this._down.shown = true;
          }
        }, this.showDelayMs),
      };

      // EDIT this block inside _onDown:
      if (e.pointerType !== "mouse" || e.button === 0) {
        if (this.confettiAlwaysOn) this._spawnConfetti(e.clientX, e.clientY);
        if (this.mode === "clickPing")
          this._spawnClickPing(e.clientX, e.clientY);
      }
    };

    /* pointer up anywhere → end HUD hold */
    this._onUp = () => {
      if (this._down) {
        clearTimeout(this._down.timer);
        this._down = null;
      }
      if (this._gizmo.hold) this._gizmoEnd();
    };

    /* wheel → show zoom HUD only over renderer (non-passive on element) */
    this._onWheel = (e) => {
      if (!this._isOnDomEl(e)) return;
      if (!this._isOverlayActive()) return;

      const dir = e.deltaY < 0 ? +1 : -1;
      this._gizmoPulseZoom(dir);
      // NOTE: do not call preventDefault here; OrbitControls will do it itself
    };

    /* context menu suppressed ONLY while panning and over renderer */
    this._onContextMenu = (e) => {
      if (
        this._isOnDomEl(e) &&
        this._gizmo.type === "pan" &&
        this._gizmo.hold
      ) {
        e.preventDefault();
      }
    };

    /* --- register listeners --- */
    // on the renderer element (so OrbitControls stays primary)
    this.domEl.addEventListener("pointerdown", this._onDown, {
      passive: true,
      capture: false,
    });
    this.domEl.addEventListener("wheel", this._onWheel, {
      passive: false,
      capture: false,
    });
    this.domEl.addEventListener("contextmenu", this._onContextMenu, {
      passive: false,
      capture: false,
    });

    // on window (release anywhere)
    window.addEventListener("pointerup", this._onUp, { passive: true });
    window.addEventListener("pointercancel", this._onUp, { passive: true });
    window.addEventListener("blur", this._onUp, { passive: true });

    /* -------- style knobs -------- */
    this.style = {
      // ink
      inkAlpha: 0.55,
      inkMinR: 8,
      inkMaxR: 14,
      inkLife: [0.7, 1.2],

      // comet
      cometDotBase: 4,
      cometDotMax: 10,
      cometStreaks: 3,
      color: "#ffffff",

      // clickPing (slower + a bit bigger)
      pingMax: 46,
      pingStroke: 2,
      pingAlpha: 0.35,
      pingLife: 0.48,

      // confetti
      confettiCount: 10,
      confettiLife: 0.6,
      confettiSpread: 220,
      // paw
      // in this.style (replace + add)
      // darker, crisper “stamp”
      pawColor: "#3d312b",
      pawAlpha: 0.75,
      pawStrokeColor: "#1e1a18",
      pawStrokeAlpha: 0.45,
      pawStrokeWidth: 0.8,
      pawComposite: "multiply", // <- key: sink into floor tones
      pawToeSquash: 0.78, // < 1.0 squashes toes vertically
      pawPadSquash: 0.85, // squash main pad a little
      pawToeTilt: 0.22, // radians, tilt the outer toes slightly
      // required by the loop:
      pawSize: 17, // px
      pawSpacing: 28, // px between stamps
      pawLife: 0.9, // seconds
      pawSkew: 0.22, // radians (left/right yaw)
      pawJitter: 2.5, // px random offset
      pawScaleSpeedBoost: 0.00035, // size grows slightly with speed
      pawForwardOffsetRad: Math.PI / 2, // align “up-facing” paw to travel dir

      // sprite (optional; when present, replaces vector drawing)
      pawSpriteUrl: "/ui-icons/paw.svg", // transparent PNG/SVG of a paw stamp
      pawSpriteBlend: "multiply", // how it sits on surfaces
      pawSpritePixels: 40, // sprite base size == your old "size"

      // --- GIZMO HUD ---
      // --- GIZMO HUD ---
      gizmoSize: 18,
      gizmoPanScale: 1.15, // pan a bit bigger
      gizmoZoomScale: 0.85, // zoom a bit smaller
      gizmoStroke: 2,
      gizmoAlpha: 0.9,
      gizmoFadeIn: 14,
      gizmoFadeOut: 8,
      gizmoZoomFlash: 0.65,
      gizmoTint: "#ffffff",
      gizmoShadow: 0.18,
    };
    this._gizmoImg = { orbit: null, pan: null, zoomIn: null, zoomOut: null };
    this._loadGizmoIcons({
      orbit: "/ui-icons/orbit.svg",
      pan: "/ui-icons/pan.svg",
      zoomIn: "/ui-icons/zoom.svg",
      zoomOut: "/ui-icons/zoom.svg",
    });

    this.ink = {
      pool: [],
      active: [],
      max: 260,
      spawnEveryPx: 10,
      splats: this._makeSplats(),
    };

    this._pings = []; // clickPing
    this._confetti = []; // confetti

    // --- GIZMO HUD state ---
    this._gizmo = {
      type: "none",
      hold: false,
      alpha: 0,
      timer: 0,
      wheelDir: +1,
    };

    // create DOM anchor for HUD (above canvas)
    this._initGizmoDOM();
    // sprite
    this._pawSprite = null;
    if (this.style.pawSpriteUrl) this._loadPawSprite(this.style.pawSpriteUrl);
    // --- paw state ---
    this.paw = {
      acc: 0, // accumulated travel distance (px)
      side: 1, // +1 / -1 alternates left/right
      stamps: [], // [{x,y,ang,side,t,life,scale,alpha}]
      maxStamps: 160, // cap to avoid unbounded growth
      lastAng: 0,
    };
  }

  /** Cursor FX are only allowed when overlay is enabled AND raycast is on */
  /** Cursor FX are only allowed when overlay is enabled AND raycast is on */
  _isOverlayActive() {
    const raycastOn = appState?.isRaycastEnabled;
    // if appState isn't there yet, default to true to avoid breaking things
    return this.enabled && (raycastOn ?? true);
  }

  _loadGizmoIcons(urls) {
    const fixCors = (url) => {
      // If same-origin path (starts with "/"), don’t set crossOrigin
      const isSameOrigin = /^\/[^/]/.test(url);
      const img = new Image();
      img.decoding = "async";
      img.loading = "eager";
      if (!isSameOrigin) img.crossOrigin = "anonymous";
      img.src = url;
      return img;
    };

    const load = (url, key) =>
      new Promise((resolve) => {
        if (!url) return resolve(null);
        const img = fixCors(url);
        img.onload = () => resolve(img);
        img.onerror = () => {
          console.warn(`[CursorOverlay] gizmo icon failed to load: ${url}`);
          resolve(null);
        };
      }).then((img) => {
        this._gizmoImg[key] = img;
      });

    // zoomOut can reuse the same SVG if you don’t have a minus version
    Promise.all([
      load(urls.orbit, "orbit"),
      load(urls.pan, "pan"),
      load(urls.zoomIn, "zoomIn"),
      load(urls.zoomOut || urls.zoomIn, "zoomOut"),
    ]).then(() => {
      this._iconsReady = true; // flag we can check at draw time
    });
  }
  _loadPawSprite(url) {
    const isSameOrigin = /^\/[^/]/.test(url);
    const img = new Image();
    if (!isSameOrigin) img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.loading = "eager";
    img.onload = () => (this._pawSprite = img);
    img.onerror = () => console.warn("[CursorOverlay] paw sprite failed:", url);
    img.src = url;
  }

  _isImgReady(img) {
    return !!(
      img &&
      img.complete &&
      img.naturalWidth > 0 &&
      img.naturalHeight > 0
    );
  }
  _isOnDomEl(e) {
    // robust hit test: supports shadow DOM and wrapped canvases
    const path = e.composedPath ? e.composedPath() : e.path || [];
    if (path && path.length) return path.includes(this.domEl);
    // fallback
    return this.domEl.contains(e.target);
  }

  /* ===== lifecycle ===== */
  start() {
    if (!this.running) {
      this.running = true;
      this._lastT = performance.now();
      requestAnimationFrame(this._loop);
    }
  }
  stop() {
    this.running = false;
  }
  setEnabled(b) {
    this.enabled = !!b;
  }
  setMode(m) {
    if (this.MODES.includes(m)) this.mode = m;
  }
  nextMode() {
    const i = this.MODES.indexOf(this.mode);
    this.mode = this.MODES[(i + 1) % this.MODES.length];
  }

  /* ===== loop ===== */
  _resize() {
    const dpr = Math.max(1, Math.min(1.75, window.devicePixelRatio || 1));
    this.dpr = dpr;
    this.canvas.width = Math.floor(innerWidth * dpr);
    this.canvas.height = Math.floor(innerHeight * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  _loop(t) {
    if (!this.running) return;

    const dt = Math.max(0.001, (t - this._lastT) / 1000);
    this._lastT = t;

    // If raycast is disabled (whiteboard/monitor mode), skip ALL FX rendering.
    if (!this._isOverlayActive()) {
      // keep positions in sync so velocity doesn’t explode when we come back
      this.lastPos.x = this.pos.x;
      this.lastPos.y = this.pos.y;
      this.ctx.clearRect(0, 0, innerWidth, innerHeight);
      requestAnimationFrame(this._loop);
      return;
    }

    this.ctx.clearRect(0, 0, innerWidth, innerHeight);

    // velocity
    const rawVx = (this.pos.x - this.lastPos.x) / dt;
    const rawVy = (this.pos.y - this.lastPos.y) / dt;
    const k = 1 - Math.exp(-dt * 12);
    this.vel.x += (rawVx - this.vel.x) * k;
    this.vel.y += (rawVy - this.vel.y) * k;
    this.speed = Math.hypot(this.vel.x, this.vel.y);

    // movement this frame
    const dx = this.pos.x - this.lastPos.x;
    const dy = this.pos.y - this.lastPos.y;
    const dFrame = Math.hypot(dx, dy);
    // Replace the paw trail section in your _loop method with this:

    if (this.mode === "paw" && !this._isGizmoActive()) {
      // accumulate distance and drop stamps at fixed spacing
      this.paw.acc += dFrame;

      // movement direction (radians) - only calculate if moving meaningfully
      let ang = this.paw.lastAng; // default to last known direction
      if (dFrame > 0.5) {
        // threshold to avoid jitter
        ang = Math.atan2(dy, dx);

        // handle angle wrapping for smooth interpolation
        let diff = ang - this.paw.lastAng;
        // normalize to [-π, π]
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        // smooth heading with faster response for sharp turns
        const turnSharpness = Math.abs(diff);
        const baseSpeed = 25; // increased from 20
        const sharpTurnBoost = 15; // extra speed for sharp turns
        const λ = baseSpeed + sharpTurnBoost * (turnSharpness / Math.PI);
        const ease = 1 - Math.exp(-dt * λ);

        this.paw.lastAng += diff * ease;
      }

      // speed-influenced size
      const base = this.style.pawSize;
      const speedScale =
        1 + Math.min(1.2, this.speed * this.style.pawScaleSpeedBoost);

      while (this.paw.acc >= this.style.pawSpacing) {
        this.paw.acc -= this.style.pawSpacing;

        // tiny jitter so it feels organic
        const jx = (Math.random() - 0.5) * 2 * this.style.pawJitter;
        const jy = (Math.random() - 0.5) * 2 * this.style.pawJitter;

        // side offset perpendicular to direction (use smoothed angle)
        const nx = -Math.sin(this.paw.lastAng);
        const ny = Math.cos(this.paw.lastAng);
        const sideOffset = base * 0.35 * this.paw.side;

        const x = this.pos.x + nx * sideOffset + jx;
        const y = this.pos.y + ny * sideOffset + jy;

        // final yaw = travel dir + fixed forward offset + left/right skew
        const yaw =
          this.paw.lastAng +
          (this.style.pawForwardOffsetRad ?? Math.PI / 2) +
          this.paw.side * this.style.pawSkew;

        this.paw.stamps.push({
          x,
          y,
          ang: yaw,
          side: this.paw.side,
          t: 0,
          life: this.style.pawLife,
          scale: base * speedScale,
          alpha: this.style.pawAlpha,
        });

        // manage pool
        if (this.paw.stamps.length > this.paw.maxStamps)
          this.paw.stamps.shift();

        // alternate feet
        this.paw.side *= -1;
      }
    }

    // keep the other visual modes fed (unchanged)
    const last = this.samples[this.samples.length - 1];
    if (!last) {
      this.samples.push({ x: this.pos.x, y: this.pos.y, t });
    } else {
      const d = Math.hypot(this.pos.x - last.x, this.pos.y - last.y);
      if (d > 0.8) {
        this.samples.push({ x: this.pos.x, y: this.pos.y, t });
        if (this.samples.length > this.maxHistory) this.samples.shift();
      } else {
        last.x = this.pos.x;
        last.y = this.pos.y;
        last.t = t;
      }
    }

    // draw current mode
    if (this.enabled) {
      // after (no ribbon/halo)
      switch (this.mode) {
        case "ink":
          this._drawInk(dt);
          break;
        case "comet":
          this._drawComet();
          break;
        case "clickPing":
          this._drawClickPing(dt);
          break;
        case "confetti":
          this._drawConfetti(dt);
          break;
        case "paw":
          this._drawPawTrail(dt);
          break;
      }
      if (this.confettiAlwaysOn) this._drawConfetti(dt); // <-- ADD this line

      this._drawGizmo(dt);
    }

    this.lastPos.x = this.pos.x;
    this.lastPos.y = this.pos.y;
    requestAnimationFrame(this._loop);
  }

  /* ===== ink ===== */
  _drawInk(dt) {
    const ctx = this.ctx;
    const last = this.samples[this.samples.length - 2];
    if (last) {
      const d = Math.hypot(this.pos.x - last.x, this.pos.y - last.y);
      if (d > this.ink.spawnEveryPx) this._spawnInk();
    }
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    for (let i = this.ink.active.length - 1; i >= 0; i--) {
      const p = this.ink.active[i];
      p.t += dt;
      const life01 = p.t / p.maxLife;
      if (life01 < 0.2) p.r *= 1 + 0.8 * dt;
      const alpha = p.alpha * Math.exp(-p.t / p.maxLife);
      if (alpha <= 0.01) {
        this.ink.pool.push(p);
        this.ink.active.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      const s = p.r / p.splat.width;
      ctx.scale(s, s);
      ctx.drawImage(p.splat, -p.splat.width * 0.5, -p.splat.height * 0.5);
      ctx.restore();
    }
    ctx.restore();
  }

  _spawnInk() {
    if (this.ink.active.length >= this.ink.max) return;
    const p = this.ink.pool.pop() || {};
    const speed = Math.min(1400, this.speed);
    p.x = this.pos.x + (Math.random() - 0.5) * 2;
    p.y = this.pos.y + (Math.random() - 0.5) * 2;
    const r0 = this.style.inkMinR,
      r1 = this.style.inkMaxR;
    p.r = r0 + (r1 - r0) * Math.random() * (1 + 0.001 * speed);
    p.rot = Math.random() * Math.PI * 2;
    p.alpha = this.style.inkAlpha;
    p.t = 0;
    p.maxLife = this._rand(this.style.inkLife[0], this.style.inkLife[1]);
    p.splat = this.ink.splats[(Math.random() * this.ink.splats.length) | 0];
    this.ink.active.push(p);
  }
  _makeSplats() {
    const make = () => {
      const c = document.createElement("canvas");
      c.width = c.height = 128;
      const g = c.getContext("2d");
      g.clearRect(0, 0, 128, 128);
      for (let i = 0; i < 6; i++) {
        const r = this._rand(18, 50),
          x = 64 + this._rand(-20, 20),
          y = 64 + this._rand(-20, 20);
        const grad = g.createRadialGradient(x, y, r * 0.2, x, y, r);
        grad.addColorStop(0, "rgba(0,0,0,0.35)");
        grad.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = grad;
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
      }
      return c;
    };
    return [make(), make(), make(), make()];
  }

  /* ===== comet ===== */
  _drawComet() {
    const ctx = this.ctx;
    const K = this.style.cometStreaks,
      pts = this.samples;
    if (pts.length >= 3) {
      const segs = [];
      let acc = 0;
      for (let i = pts.length - 1; i > 0 && acc < 120; i--) {
        const a = pts[i],
          b = pts[i - 1];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d > 0.5) {
          segs.push({ a, b, d });
          acc += d;
        }
      }
      ctx.save();
      ctx.strokeStyle = this.style.color;
      ctx.lineCap = "round";
      for (let k = 1; k <= K; k++) {
        const maxLen = Math.min(60, 8 + 0.03 * this.speed) * (k / K);
        let left = maxLen;
        const baseAlpha = 0.45 * (1 - k / (K + 1));
        const baseW = Math.min(6, 2 + 0.002 * this.speed) * (1 - k / (K + 1));
        ctx.globalAlpha = baseAlpha;
        ctx.lineWidth = baseW;
        ctx.beginPath();
        let started = false;
        for (let i = 0; i < segs.length && left > 0; i++) {
          const { a, b, d } = segs[i];
          const use = Math.min(left, d);
          const t = use / d;
          const x = a.x + (b.x - a.x) * t,
            y = a.y + (b.y - a.y) * t;
          if (!started) {
            ctx.moveTo(a.x, a.y);
            started = true;
          }
          ctx.lineTo(x, y);
          left -= use;
        }
        ctx.stroke();
      }
      ctx.restore();
    }
    const r = Math.min(
      this.style.cometDotMax,
      this.style.cometDotBase + 0.004 * this.speed
    );
    ctx.globalAlpha = 1.0;
    const grad = ctx.createRadialGradient(
      this.pos.x,
      this.pos.y,
      0,
      this.pos.x,
      this.pos.y,
      r
    );
    grad.addColorStop(0, this._rgba(this.style.color, 1));
    grad.addColorStop(1, this._rgba(this.style.color, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  /* ===== clickPing ===== */
  _drawClickPing(dt) {
    const ctx = this.ctx;

    // faint dot under cursor so you know you're in this mode
    ctx.fillStyle = this._rgba("#ffffff", 0.08);
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, 3, 0, Math.PI * 2);
    ctx.fill();

    for (let i = this._pings.length - 1; i >= 0; i--) {
      const p = this._pings[i];
      p.t += dt;
      if (p.t >= p.life) {
        this._pings.splice(i, 1);
        continue;
      }
      const k = p.t / p.life;
      const r = this.style.pingMax * k; // slow expansion (life↑)
      const a = this.style.pingAlpha * (1 - k);
      ctx.strokeStyle = `rgba(255,255,255,${a})`;
      ctx.lineWidth = this.style.pingStroke;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  _spawnClickPing(x, y) {
    this._pings.push({ x, y, t: 0, life: this.style.pingLife });
    if (this._pings.length > 16) this._pings.shift();
  }

  /* ===== confetti ===== */
  _drawConfetti(dt) {
    const ctx = this.ctx;
    for (let i = this._confetti.length - 1; i >= 0; i--) {
      const p = this._confetti[i];
      p.t += dt;
      if (p.t >= p.life) {
        this._confetti.splice(i, 1);
        continue;
      }
      p.vy += 500 * dt; // gravity
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
      const a = 1 - p.t / p.life;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = `rgba(${p.col[0]},${p.col[1]},${p.col[2]},${a})`;
      ctx.fillRect(-2.5, -2.5, 5, 5);
      ctx.restore();
    }
  }
  _spawnConfetti(x, y) {
    const n = this.style.confettiCount;
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = this.style.confettiSpread * (0.45 + Math.random() * 0.55);
      this._confetti.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd * -0.25, // bias upward
        rot: Math.random() * Math.PI,
        spin: (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 8),
        t: 0,
        life: this.style.confettiLife,
        col: [
          (200 + Math.random() * 55) | 0,
          (160 + Math.random() * 90) | 0,
          (120 + Math.random() * 135) | 0,
        ],
      });
    }
    if (this._confetti.length > 80)
      this._confetti.splice(0, this._confetti.length - 80);
  }

  /* ===== GIZMO HUD (always-on, independent of mode) ===== */
  _gizmoBegin(type) {
    this._gizmo.type = type; // "orbit" | "pan"
    this._gizmo.hold = true; // fade in
  }
  _gizmoEnd() {
    this._gizmo.hold = false; // fade out
  }
  _gizmoPulseZoom(dir /* +1 in, -1 out */) {
    this._gizmo.type = "zoom";
    this._gizmo.wheelDir = dir;
    this._gizmo.timer = this.style.gizmoZoomFlash; // seconds visible
  }

  _initGizmoDOM() {
    // DOM anchor (kept for layering; drawing still on canvas for perf)
    this._gizmoEl = document.createElement("div");
    this._gizmoEl.style.cssText = `
      position:fixed; left:0; top:0; width:0; height:0; pointer-events:none;
      z-index:${(this.zIndex || 20) + 1}; transform:translate(-9999px,-9999px);
    `;
    document.body.appendChild(this._gizmoEl);
  }
  _isGizmoActive() {
    const g = this._gizmo;
    return (
      (g.hold || (g.type === "zoom" && g.timer > 0)) &&
      g.type !== "none" &&
      g.alpha > 0.05
    );
  }

  _drawGizmo(dt) {
    const g = this._gizmo;

    // visibility easing
    const shouldShow =
      (g.hold || (g.type === "zoom" && g.timer > 0)) && g.type !== "none";
    const target = shouldShow ? 1 : 0;
    const λ =
      target > g.alpha
        ? (this.style.gizmoFadeIn ?? 14)
        : (this.style.gizmoFadeOut ?? 8);

    g.alpha += (target - g.alpha) * (1 - Math.exp(-dt * λ));

    if (g.type === "zoom" && g.timer > 0) {
      g.timer = Math.max(0, g.timer - dt);
    }

    if (g.alpha <= 0.01) {
      if (!g.hold && g.type !== "zoom") g.type = "none";
      return;
    }

    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);

    // contrast shadow (disabled for zoom gizmo)
    const baseShadow = this.style.gizmoShadow ?? 0.18;
    const sh = g.type === "zoom" ? 0 : baseShadow;

    if (sh > 0) {
      ctx.shadowColor = this._rgba("#000000", sh * g.alpha);
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    } else {
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }

    ctx.globalAlpha = (this.style.gizmoAlpha ?? 0.9) * g.alpha;

    const s = this.style.gizmoSize ?? 18;
    const scaleMap = {
      orbit: 1,
      pan: this.style.gizmoPanScale ?? 1,
      zoom: this.style.gizmoZoomScale ?? 1,
    };
    const sEff = s * (scaleMap[g.type] || 1);
    // draw image icon, preserving aspect ratio
    const drawCentered = (img) => {
      if (!this._isImgReady(img)) return false;

      const iw = img.naturalWidth || 1;
      const ih = img.naturalHeight || 1;
      const aspect = iw / ih;

      const maxSize = sEff * 2;
      let w, h;
      if (aspect >= 1) {
        // wider than tall
        w = maxSize;
        h = maxSize / aspect;
      } else {
        // taller than wide
        h = maxSize;
        w = maxSize * aspect;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      return true;
    };

    let usedImg = false;
    if (this._iconsReady) {
      switch (g.type) {
        case "orbit":
          usedImg = drawCentered(this._gizmoImg.orbit);
          break;
        case "pan":
          usedImg = drawCentered(this._gizmoImg.pan);
          break;
        case "zoom":
          usedImg = drawCentered(
            g.wheelDir > 0 ? this._gizmoImg.zoomIn : this._gizmoImg.zoomOut
          );
          break;
        default:
          break;
      }
    }

    // canvas fallback if no image (or not ready)
    if (!usedImg) {
      ctx.lineWidth = this.style.gizmoStroke ?? 2;
      const tint = this.style.gizmoTint ?? "#ffffff";
      ctx.strokeStyle = this._rgba(tint, 1);
      ctx.fillStyle = this._rgba(tint, 1);

      switch (g.type) {
        case "orbit":
          this._iconOrbit(ctx, sEff);
          break;
        case "pan":
          this._iconHand(ctx, sEff);
          break;
        case "zoom":
          this._iconMagnifier(ctx, sEff, g.wheelDir);
          break;
        default:
          break;
      }
    }

    ctx.restore();
  }

  // --- ICON DRAWERS (no external assets) ---
  _iconOrbit(ctx, s) {
    const r = s;
    const t = performance.now() * 0.001;
    const ang = (t * 1.2) % (Math.PI * 2);

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, r, ang - 0.9, ang + 0.6);
    ctx.stroke();

    const hx = Math.cos(ang + 0.6) * r;
    const hy = Math.sin(ang + 0.6) * r;
    const head = 6;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(
      hx - head * Math.cos(ang + 0.2),
      hy - head * Math.sin(ang + 0.2)
    );
    ctx.moveTo(hx, hy);
    ctx.lineTo(
      hx - head * Math.cos(ang + 1.0),
      hy - head * Math.sin(ang + 1.0)
    );
    ctx.stroke();
  }

  _iconHand(ctx, s) {
    const w = s * 1.2,
      h = s * 0.9;
    ctx.beginPath();
    ctx.roundRect?.(-w * 0.5, -h * 0.1, w * 0.9, h * 0.6, 4);
    if (!ctx.roundRect) ctx.rect(-w * 0.5, -h * 0.1, w * 0.9, h * 0.6);
    ctx.stroke();
    ctx.beginPath(); // thumb
    ctx.moveTo(-w * 0.5, -h * 0.05);
    ctx.quadraticCurveTo(-w * 0.7, 0, -w * 0.45, h * 0.25);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      // fingers
      const fx = -w * 0.2 + i * (w * 0.25);
      ctx.beginPath();
      ctx.moveTo(fx, -h * 0.1);
      ctx.lineTo(fx, -h * 0.35);
      ctx.stroke();
    }
  }

  _iconMagnifier(ctx, s, dir) {
    const r = s * 0.7;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    const ang = Math.PI / 4; // handle
    const hx = Math.cos(ang) * r,
      hy = Math.sin(ang) * r;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx + Math.cos(ang) * s * 0.9, hy + Math.sin(ang) * s * 0.9);
    ctx.stroke();
    // sign
    ctx.beginPath();
    ctx.moveTo(-r * 0.4, 0);
    ctx.lineTo(r * 0.4, 0);
    if (dir > 0) {
      ctx.moveTo(0, -r * 0.4);
      ctx.lineTo(0, r * 0.4);
    }
    ctx.stroke();
  }

  /* ===== utils ===== */
  _rand(a, b) {
    return a + Math.random() * (b - a);
  }
  _rgba(hex, a = 1) {
    let c = hex.replace("#", "");
    if (c.length === 3)
      c = c
        .split("")
        .map((ch) => ch + ch)
        .join("");
    const r = parseInt(c.slice(0, 2), 16),
      g = parseInt(c.slice(2, 4), 16),
      b = parseInt(c.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  _drawPawTrail(dt) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = this.style.pawComposite || "multiply";
    // update + draw newest on top
    for (let i = this.paw.stamps.length - 1; i >= 0; i--) {
      const s = this.paw.stamps[i];
      s.t += dt;
      const k = s.t / s.life; // 0..1
      if (k >= 1) {
        this.paw.stamps.splice(i, 1);
        continue;
      }
      // ease out opacity + slight shrink as it fades
      const fade = Math.max(0, 1 - k);
      const alpha = s.alpha * fade;
      const size = s.scale * (0.95 + 0.05 * fade);

      this._drawPawStamp(s.x, s.y, s.ang, size, alpha);
    }
    ctx.restore();
    // subtle head hint (optional): a tiny live pad at the cursor
    // this._drawPawStamp(this.pos.x, this.pos.y, 0, this.style.pawSize*0.65, 0.18);
  }
  _drawPawStamp(x, y, ang, size, alpha) {
    const s = this.style;
    const ctx = this.ctx;

    // --- sprite path (preferred) ---
    if (
      this._pawSprite &&
      this._pawSprite.complete &&
      this._pawSprite.naturalWidth > 0
    ) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);

      const prevOp = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation =
        s.pawSpriteBlend || s.pawComposite || "source-over";
      ctx.globalAlpha = alpha;
      ctx.imageSmoothingEnabled = true;

      const w = size * (s.pawSpriteScale || 1); // size is in px already
      ctx.drawImage(this._pawSprite, -w * 0.5, -w * 0.5, w, w);

      ctx.globalCompositeOperation = prevOp;
      ctx.restore();
      return; // done
    }

    // --- vector fallback ---
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);

    const fill = this._rgba(s.pawColor || "#3d312b", alpha);
    const stroke = this._rgba(
      s.pawStrokeColor || "#2e2e2e",
      Math.min(1, alpha * (s.pawStrokeAlpha ?? 0.35))
    );
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = s.pawStrokeWidth ?? 1;

    // normalized design space (40 == design width)
    const S = size / 40;
    const oval = (ox, oy, rx, ry, rot = 0) => {
      ctx.save();
      ctx.translate(ox * S, oy * S);
      ctx.rotate(rot);
      ctx.beginPath();
      ctx.ellipse(0, 0, rx * S, ry * S, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };

    // main pad (slightly squashed peanut + base)
    const ps = s.pawPadSquash ?? 0.85;
    oval(-7, 0, 12, 11 * ps);
    oval(7, 0, 12, 11 * ps);
    oval(0, 10, 15, 10 * ps);

    // toes (squashed + subtle tilt)
    const qs = s.pawToeSquash ?? 0.78;
    const tilt = s.pawToeTilt ?? 0.22;
    oval(-16, -14, 6.4, 8.2 * qs, -tilt);
    oval(-6, -18, 7.0, 9.0 * qs, -tilt * 0.35);
    oval(6, -18, 7.0, 9.0 * qs, tilt * 0.35);
    oval(16, -14, 6.4, 8.2 * qs, tilt);

    ctx.restore();
  }
}
