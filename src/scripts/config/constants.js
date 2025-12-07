// Centralised app constants and config.

import * as THREE from "three";

/**
 * Image assets triggered by raycast hits.
 * Keys must match your scene object's .name (e.g. 'ded-casper-twelve-raycast').
 * Each entry feeds the fade-image overlay (src + caption).
 */
export const imageData = {
  "ac-card-ten-raycast": {
    src: "images/ac-2.webp", // same as ac-card-twelve-raycast
    caption: "my acnh villagers",
  },
  "baby-casper-ten-raycast": {
    src: "images/caspuh.webp", // same as baby-casper-twelve-raycast
    caption: "casper as a puppy",
  },
  "baby-cyrus-ten-raycast": {
    src: "images/bb-cyrus.webp", // same as baby-cyrus-twelve-raycast
    caption: "my pet bunny",
  },
  "casp-cyrus-ten-raycast": {
    src: "images/cc.webp", // same as casp-cyrus-twelve-raycast
    caption: "my two best friends",
  },
  "casper-lobster-ten-raycast": {
    src: "images/lobster-casper.webp", // new image → fill in later
    caption: "posture pal on my dog's head",
  },
  "casper-pawty-ten-raycast": {
    src: "images/caspuh_party.webp", // same as casper-pawty-twelve-raycast
    caption: "my dog's 4th birthday 🎉",
  },
  "casper-sideeye-ten-raycast": {
    src: "images/sussy-casper.webp", // new image → fill in later
    caption: "Casper side eyeing me",
  },
  "casper-sleep-ten-raycast": {
    src: "images/sleeper.webp", // new image → fill in later
    caption: "i finally let my dog on the bed",
  },
  "caspuh-frame-ten-raycast": {
    src: "images/caspuh2.webp", // same as caspuh-frame-twelve-raycast
    caption: "he looks so goofy",
  },
  "cyrus-frame-ten-raycast": {
    src: "images/cyrus.webp", // same as cyrus-frame-twelve-raycast
    caption: "hello there",
  },
  "ded-casper-ten-raycast": {
    src: "images/casper-buh.webp", // same as ded-casper-twelve-raycast
    caption: "buh",
  },
  "goofy-casper-ten-raycast": {
    src: "images/lmao.webp", // same as goofy-casper-twelve-raycast
    caption: "he looks so goofy",
  },
};

/**
 * Social links to direct to when clicking on icons.
 */
export const socialLinks = {
  Github: "https://github.com/curtislow777",
  LinkedIn: "https://www.linkedin.com/in/curtis-low/",
};

/**
 * Canvas / renderer setup.
 * selector: DOM target for WebGLRenderer
 * clearColor/Alpha: renderer background (scene may still render a skybox behind this)
 */
export const CANVAS_CONFIG = {
  selector: "#experience-canvas",
  clearColor: 0x000000,
  clearAlpha: 1,
};

/**
 * Default camera placement and look target.
 * Used by CameraManager for reset/intro positions.
 * Coordinates are in world space (same units as in blender).
 */
export const CAMERA_CONFIG = {
  fov: 75,
  near: 0.1,
  far: 100,
  defaultPosition: new THREE.Vector3(15.53, 11.14, 20.73),
  defaultTarget: new THREE.Vector3(-0.35, 3.0, 0.64),
};

/**
 * Whiteboard placement. Drawing plane should be positioned/rotated to this.
 */
export const WHITEBOARD_CONFIG = {
  position: new THREE.Vector3(-5.95, 4.337178707122803, 0.575),
  rotation: new THREE.Euler(0, Math.PI / 2, 0),
};

/**
 * "Inner Web" (monitor) – a CSS3D/HTML overlay iFrame anchored to a 3D screen.
 * html: embedded app
 * transform: world placement; scale is chosen to map HTML pixels to world units.
 */
export const INNER_WEB_CONFIG = {
  html: `<iframe
         src="https://port-inner.vercel.app/"
         style="width:1200px;height:675px; border:0;border-radius:8px;"
       ></iframe>`,
  position: new THREE.Vector3(-5.05, 3.2133445739746094, 0.057),
  rotation: new THREE.Euler(0, Math.PI / 2, 0),
  scale: new THREE.Vector3(0.0014, 0.0014, 0.0014),
};

/**
 * Steam shader quad parameters.
 * position: world-space anchor (mug)
 * geometry: plane size  (more segments = smoother distortion)
 * texture: noise texture used in fragment shader
 */
export const STEAM_CONFIG = {
  position: new THREE.Vector3(-4.177665710449219, 2.85, 1.0796866416931152),
  geometry: {
    width: 0.15,
    height: 0.6,
    segments: 16,
  },
  texture: {
    src: "/images/perlin.png",
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping,
  },
};

/**
 * Query selectors for modal system (GSAP/show-hide).
 */
export const MODAL_SELECTORS = {
  overlay: ".overlay",
  modals: {
    projects: ".projects-modal",
    about: ".about-modal",
    contact: ".contact-modal",
    erhu: ".erhu-modal",
  },
  closeButton: ".modal-close-btn",
};

// Image overlay selectors
export const IMAGE_OVERLAY_SELECTORS = {
  overlay: ".fade-overlay",
  content: ".fade-overlay-content",
  closeBtn: ".fade-overlay-close-btn",
  img: ".fade-overlay-img",
  text: ".fade-overlay-text",
};

/**
 * Fade image overlay (for raycast image popups).
 */
export const LOADING_SELECTORS = {
  screen: ".loading-screen",
  button: ".loading-screen-btn",
  bar: ".loading-bar",
  barFill: ".loading-bar-fill",
};

/**
 * Side panel (hamburger) UI.
 */
export const SIDE_PANEL_SELECTORS = {
  hamburgerBtn: ".hamburger-btn",
  sidePanel: ".side-panel",
  panelLinks: ".panel-link",
};

/**
 * Centralised animation timings (seconds).
 * Tweak here to keep motion consistent across features.
 */
export const ANIMATION_DURATIONS = {
  steamToggle: 1.0,
  introAnimation: 0.8,
  modalTransition: 0.3,
  loadingFade: 1.0,
  hoverScale: 0.2,
};

/**
 * Asset paths. Loaders pick up automatically.
 */
export const MODEL_PATHS = {
  room: "/models/room-port-v1.glb",
  draco: "/draco/",
};

/**
 * Button element IDs used by misc UI handlers.
 */
export const BUTTON_IDS = {
  themeToggle: "theme-toggle",
  soundToggle: "sound-toggle",
  backButton: "back-button",
};
