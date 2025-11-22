// calenderDate.js
import * as THREE from "three";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";

export default class CalendarDate {
  /**
   * @param {Object} options
   * @param {THREE.Object3D} options.parent - Object to attach the date to (e.g. your calendar mesh or an anchor on its face)
   * @param {string} [options.fontUrl] - Path to your .typeface.json font
   * @param {number} [options.size] - Digit height (world units)
   * @param {number} [options.height] - Extrusion depth
   * @param {number} [options.color] - Mesh color (hex)
   * @param {THREE.Vector3} [options.offset] - Local position offset on the parent
   */
  constructor({
    parent,
    fontUrl = "/fonts/Sniglet_Regular.json",
    size = 0.45,
    height = 0.12,
    color = 0xe06a6a,
    offset = new THREE.Vector3(0, 0.02, 0.01), // slightly in front of the "paper"
  } = {}) {
    if (!parent) {
      throw new Error("CalendarDate: parent Object3D is required.");
    }

    this.parent = parent;
    this.fontUrl = fontUrl;
    this.size = size;
    this.height = height;
    this.color = color;
    this.offset = offset;

    this.font = null;
    this.numberMesh = null;
    this.midnightTimeout = null;

    // local anchor so you can move/rotate this separately from the parent
    this.anchor = new THREE.Object3D();
    this.parent.add(this.anchor);
    this.anchor.position.copy(this.offset);

    this.fontLoader = new FontLoader();
    this._loadFont();
  }

  _loadFont() {
    this.fontLoader.load(
      this.fontUrl,
      (font) => {
        this.font = font;
        this.setToToday();
        this._scheduleMidnightUpdate();
      },
      undefined,
      (err) => {
        console.error("CalendarDate: failed to load font:", err);
      }
    );
  }

  /**
   * Create/replace the 3D number mesh.
   * @param {string|number} value - e.g. 1..31
   */
  setNumber(value) {
    if (!this.font) return;

    const text = String(value);

    // remove old mesh
    if (this.numberMesh) {
      this._disposeMesh(this.numberMesh);
      this.anchor.remove(this.numberMesh);
      this.numberMesh = null;
    }

    const geometry = new TextGeometry(text, {
      font: this.font,
      size: this.size,
      height: this.height,
      curveSegments: 8,
      bevelEnabled: true,
      bevelThickness: this.height * 0.25,
      bevelSize: this.size * 0.045,
      bevelSegments: 2,
    });

    // center the geometry so it sits nicely in the middle
    geometry.computeBoundingBox();
    const bb = geometry.boundingBox;
    const centerX = (bb.max.x + bb.min.x) / 2;
    const centerY = (bb.max.y + bb.min.y) / 2;
    geometry.translate(-centerX, -centerY, 0);

    const material = new THREE.MeshStandardMaterial({
      color: this.color,
      metalness: 0.1,
      roughness: 0.6,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = false;

    // tiny additional offset to avoid z-fighting with the card
    mesh.position.set(0, 0, 0.0);

    this.anchor.add(mesh);
    this.numberMesh = mesh;
  }

  /** Set mesh to today's local date (1–31) */
  setToToday() {
    const today = new Date().getDate();
    this.setNumber(today);
  }

  _scheduleMidnightUpdate() {
    if (this.midnightTimeout) {
      clearTimeout(this.midnightTimeout);
    }

    const now = new Date();
    const nextMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0,
      0,
      1
    );
    const ms = nextMidnight - now;

    this.midnightTimeout = setTimeout(() => {
      this.setToToday();
      this._scheduleMidnightUpdate();
    }, ms);
  }

  _disposeMesh(mesh) {
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) {
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => m.dispose && m.dispose());
      } else {
        mesh.material.dispose && mesh.material.dispose();
      }
    }
  }

  /** Clean up when you remove the calendar */
  dispose() {
    if (this.midnightTimeout) clearTimeout(this.midnightTimeout);
    if (this.numberMesh) {
      this._disposeMesh(this.numberMesh);
      this.anchor.remove(this.numberMesh);
      this.numberMesh = null;
    }
    if (this.anchor && this.parent) {
      this.parent.remove(this.anchor);
    }
  }
}
