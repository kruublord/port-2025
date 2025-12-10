// TVEyesChannel.js — Googly eyes screensaver for your TV (CanvasTexture-based)
import * as THREE from "three";

export default class TVEyesChannel {
  constructor({ width = 960, height = 540, themeHue = 210 } = {}) {
    this.w = width;
    this.h = height;
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.w;
    this.canvas.height = this.h;
    this.ctx = this.canvas.getContext("2d");
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;

    // layout
    this.eyeR = Math.min(this.w, this.h) * 0.18;
    this.left = { x: this.w * 0.36, y: this.h * 0.5 };
    this.right = { x: this.w * 0.64, y: this.h * 0.5 };
    // how big the pupil is (as a fraction of eye radius)
    this.pupilScale = 0.46; // try 0.42–0.48 (0.36 was your old value)
    // how much white rim you want to always keep visible
    this.rimPaddingScale = 0.05; // 5% of eye radius (0.03–0.08 looks good)

    // pupil state
    this.targetUV = null; // .setTargetUV({x:0..1,y:0..1})
    this.idleT = Math.random() * 10;

    // blink state
    this.blink = 0; // 0=open, 1=closed
    this._blinkCool = 0; // time until next blink
    this._resetBlinkCooldown();

    // timing
    this._last = performance.now();

    // in constructor
    this._aim = { x: this.w * 0.5, y: this.h * 0.5 }; // smoothed target (px)
    this._rawTarget = { x: this.w * 0.5, y: this.h * 0.5 }; // last raw (px)
    this._k = 16; // responsiveness (higher = snappier), try 12–20
  }

  getTexture() {
    return this.texture;
  }

  setTargetUV(uv) {
    this.targetUV = uv ? { x: uv.x, y: uv.y } : null;
  }

  onClick() {
    // silly gag: quick cross-eye
    this.idleT += 1.5;
  }

  update() {
    const now = performance.now();
    const dt = Math.min(0.033, (now - this._last) / 1000);
    this._last = now;
    this.idleT += dt;

    // --- blink (unchanged) ---
    this._blinkCool -= dt;
    if (this._blinkCool <= 0 && this.blink === 0) {
      this.blink = 0.001;
      this._blinkCool = 999;
    }
    if (this.blink > 0) {
      const speed = 10;
      const p = Math.min(1, this.blink + speed * dt);
      this._blinkPhase = p < 0.5 ? p / 0.5 : 1 - (p - 0.5) / 0.5;
      this.blink = p < 1 ? p : 0;
      if (this.blink === 0) this._resetBlinkCooldown();
    }

    // --- RAW TARGET (px) ---
    if (this.targetUV) {
      // note: UV may be outside [0..1] now — that’s fine
      this._rawTarget.x = this.targetUV.x * this.w;
      this._rawTarget.y = (1 - this.targetUV.y) * this.h;
    } else {
      // idle drift (same as before)
      const a = this.idleT * 0.9,
        b = this.idleT * 1.3;
      this._rawTarget.x = this.w * 0.5 + Math.cos(a) * this.eyeR * 0.4;
      this._rawTarget.y = this.h * 0.5 + Math.sin(b) * this.eyeR * 0.3;
    }

    // --- SMOOTH to aim using critical damping ---
    const alpha = 1 - Math.exp(-this._k * dt); // frame-rate independent
    this._aim.x += (this._rawTarget.x - this._aim.x) * alpha;
    this._aim.y += (this._rawTarget.y - this._aim.y) * alpha;

    this._draw();
    this.texture.needsUpdate = true;
  }

  _resetBlinkCooldown() {
    // next blink in 3–7s
    this._blinkCool = 3 + Math.random() * 4;
  }

  _bg(ctx) {
    // subtle blue gradient + faint scanlines
    const g = ctx.createLinearGradient(0, 0, 0, this.h);
    g.addColorStop(0, "#0e244bff");
    g.addColorStop(1, "#081220");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = "#000";
    for (let y = 0; y < this.h; y += 2) ctx.fillRect(0, y, this.w, 1);
    ctx.globalAlpha = 1;
  }

  _pupilTargetForEye(eye, targetPx = null) {
    // decide target in *pixels* (works with or without your smoothing step)
    let tx, ty;
    if (targetPx) {
      tx = targetPx.x;
      ty = targetPx.y;
    } else if (this.targetUV) {
      tx = this.targetUV.x * this.w;
      ty = (1 - this.targetUV.y) * this.h;
    } else {
      const a = this.idleT * 0.9,
        b = this.idleT * 1.3;
      tx =
        this.w * 0.5 +
        Math.cos(a + (eye === this.left ? 0 : 0.2)) * this.eyeR * 0.4;
      ty =
        this.h * 0.5 +
        Math.sin(b + (eye === this.left ? 0.3 : 0)) * this.eyeR * 0.3;
    }

    const pupilR = this.eyeR * this.pupilScale;
    const padding = this.eyeR * this.rimPaddingScale;
    const maxOffset = Math.max(0, this.eyeR - pupilR - padding);

    const vx = tx - eye.x,
      vy = ty - eye.y;
    const len = Math.hypot(vx, vy) || 1;
    const s = Math.min(1, maxOffset / len);

    return { x: eye.x + vx * s, y: eye.y + vy * s, pupilR };
  }
  setPupilSize(scale) {
    this.pupilScale = THREE.MathUtils.clamp(scale, 0.2, 0.48);
  }

  _drawEye(ctx, cx, cy, R, blinkPhase) {
    // white plastic disk
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();

    // subtle rim
    ctx.lineWidth = Math.max(2, R * 0.08);
    ctx.strokeStyle = "#d7dee8";
    ctx.stroke();

    // soft gloss (top-left)
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.beginPath();
    ctx.arc(cx - R * 0.35, cy - R * 0.35, R * 0.55, 0, Math.PI * 2);
    ctx.fill();

    // (optional) blink – comment out next block to disable completely
    if (blinkPhase > 0) {
      const h = R * blinkPhase;
      ctx.fillStyle = "#0A1933";
      ctx.fillRect(cx - R - 1, cy - R - 1, R * 2 + 2, h);
      ctx.fillRect(cx - R - 1, cy + R - h + 1, R * 2 + 2, h);
    }
  }

  _drawPupil(ctx, px, py, eyeR, pupilR) {
    const r = pupilR; // no hardcoded multipliers anymore
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.arc(px - r * 0.35, py - r * 0.35, r * 0.18, 0, Math.PI * 2);
    ctx.fill();
  }

  _draw() {
    const ctx = this.ctx;
    this._bg(ctx);

    const blinkPhase = this._blinkPhase || 0;

    this._drawEye(ctx, this.left.x, this.left.y, this.eyeR, blinkPhase);
    this._drawEye(ctx, this.right.x, this.right.y, this.eyeR, blinkPhase);

    const L = this._pupilTargetForEye(
      this.left,
      this._aim /* if you use smoothing */
    );
    const R = this._pupilTargetForEye(this.right, this._aim);
    this._drawPupil(ctx, L.x, L.y, this.eyeR, L.pupilR);
    this._drawPupil(ctx, R.x, R.y, this.eyeR, R.pupilR);
  }

  dispose() {
    this.texture.dispose();
  }
}
