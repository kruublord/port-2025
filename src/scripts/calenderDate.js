// calenderDate.js
import * as THREE from "three";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// load once, reuse for all instances
const matcapTexture = new THREE.TextureLoader().load(
  "/textures/matcap-blue2.png"
);

export default class CalendarDate {
  constructor({
    parent,
    fontUrl = "/fonts/Sniglet_Regular.json",
    size = 0.18, // a bit smaller
    height = 0.035, // thin but with enough volume
    color = 0xffffff, // let matcap drive color
    offset = new THREE.Vector3(0, 0.02, 0.01),
    letterSpacing = 0.02, // <── add this
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
    this.letterSpacing = letterSpacing;

    this.font = null;
    this.numberMesh = null;
    this.midnightTimeout = null;

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
  setNumber(value) {
    if (!this.font) return;

    const text = String(value);

    if (this.numberMesh) {
      this._disposeMesh(this.numberMesh);
      this.anchor.remove(this.numberMesh);
      this.numberMesh = null;
    }

    const charGeometries = [];
    let cursorX = 0;

    for (const ch of text) {
      const charGeom = new TextGeometry(ch, {
        font: this.font,
        size: this.size,
        height: this.height,
        curveSegments: 8,
        bevelEnabled: true,
        bevelThickness: this.height * 0.4,
        bevelSize: this.size * 0.06,
        bevelSegments: 3,
      });

      charGeom.computeBoundingBox();
      const bb = charGeom.boundingBox;
      const charWidth = bb.max.x - bb.min.x;

      // move this character to the current cursor position
      charGeom.translate(cursorX - bb.min.x, 0, 0);
      cursorX += charWidth + this.letterSpacing;

      charGeometries.push(charGeom);
    }

    // merge all chars into one geometry
    let geometry = mergeGeometries(charGeometries, false);

    // center the whole string
    geometry.computeBoundingBox();
    const bb = geometry.boundingBox;
    const centerX = (bb.max.x + bb.min.x) / 2;
    const centerY = (bb.max.y + bb.min.y) / 2;
    geometry.translate(-centerX, -centerY, 0);

    // orientation
    geometry.rotateZ(Math.PI / 2);
    geometry.rotateX(-Math.PI / 2);

    // matcap material
    const material = new THREE.MeshMatcapMaterial({
      matcap: matcapTexture,
      color: this.color,
      side: THREE.FrontSide,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.position.set(0, 0, 0);

    this.anchor.add(mesh);
    this.numberMesh = mesh;
  }

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
