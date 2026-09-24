import { IS_TOUCH, clamp } from './util.js';

export class Input {
  constructor(dom) {
    this.dom = dom;
    this.keys = new Set();
    this.move = { x: 0, y: 0 };
    this.look = { dx: 0, dy: 0 };
    this.run = false;
    this._jump = false; this._interact = false;
    this.enabled = true;
    this.joy = null; this.lookTouch = null;
    this.touch = IS_TOUCH;

    addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      this.keys.add(e.code);
      if (e.code === 'Space') { this._jump = true; e.preventDefault(); }
      if (e.code === 'KeyE' || e.code === 'Enter') this._interact = true;
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());

    // mouse drag look
    let dragging = false, lx = 0, ly = 0;
    dom.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse') return;
      dragging = true; lx = e.clientX; ly = e.clientY;
    });
    addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      if (document.pointerLockElement === dom) { this.look.dx += e.movementX; this.look.dy += e.movementY; return; }
      if (!dragging) return;
      this.look.dx += e.clientX - lx; this.look.dy += e.clientY - ly; lx = e.clientX; ly = e.clientY;
    });
    addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse') dragging = false; });

    // touch: left side = joystick, right side = look
    this.joyBase = document.getElementById('joy');
    this.joyKnob = document.getElementById('joy-knob');
    dom.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        if (!this.joy && t.clientX < innerWidth * 0.45) {
          this.joy = { id: t.identifier, ox: t.clientX, oy: t.clientY, x: 0, y: 0 };
          this.joyBase.style.display = 'block';
          this.joyBase.style.left = t.clientX + 'px'; this.joyBase.style.top = t.clientY + 'px';
          this.joyKnob.style.transform = 'translate(-50%,-50%)';
        } else if (!this.lookTouch) {
          this.lookTouch = { id: t.identifier, x: t.clientX, y: t.clientY };
        }
      }
      e.preventDefault();
    }, { passive: false });
    dom.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (this.joy && t.identifier === this.joy.id) {
          const R = 55;
          let dx = t.clientX - this.joy.ox, dy = t.clientY - this.joy.oy;
          const l = Math.hypot(dx, dy);
          if (l > R) { dx *= R / l; dy *= R / l; }
          this.joy.x = dx / R; this.joy.y = -dy / R;
          this.joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        } else if (this.lookTouch && t.identifier === this.lookTouch.id) {
          this.look.dx += (t.clientX - this.lookTouch.x) * 1.4;
          this.look.dy += (t.clientY - this.lookTouch.y) * 1.4;
          this.lookTouch.x = t.clientX; this.lookTouch.y = t.clientY;
        }
      }
      e.preventDefault();
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (this.joy && t.identifier === this.joy.id) { this.joy = null; this.joyBase.style.display = 'none'; }
        if (this.lookTouch && t.identifier === this.lookTouch.id) this.lookTouch = null;
      }
    };
    dom.addEventListener('touchend', end);
    dom.addEventListener('touchcancel', end);
  }

  pressInteract() { this._interact = true; }
  pressJump() { this._jump = true; }

  update() {
    const k = this.keys;
    let x = 0, y = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) y += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (this.joy) { x = this.joy.x; y = this.joy.y; }
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    this.move.x = this.enabled ? x : 0; this.move.y = this.enabled ? y : 0;
    this.run = k.has('ShiftLeft') || k.has('ShiftRight') || (this.joy && Math.hypot(this.joy.x, this.joy.y) > 0.92);
    this.look.dx = clamp(this.look.dx, -300, 300);
  }

  consumeLook() { const l = { ...this.look }; this.look.dx = 0; this.look.dy = 0; return this.enabled ? l : { dx: 0, dy: 0 }; }
  consumeJump() { const j = this._jump; this._jump = false; return j && this.enabled; }
  consumeInteract() { const j = this._interact; this._interact = false; return j; }
}
