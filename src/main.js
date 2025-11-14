import * as THREE from "three";
import gsap from "gsap";

// Core imports
import EventHandler from "./scripts/core/EventHandler.js";
import { initializeAll } from "./scripts/core/Initializer.js";
import { initializeUI } from "./scripts/ui/UIInitializer.js";
import "./style.scss";
import RaycasterController from "./scripts/core/RaycasterController.js";
import createRenderLoop from "./scripts/core/RenderLoop.js";
import { setupLoadingScreen } from "./scripts/ui/LoadingManager.js";
import {
  initModalOverlay,
  initSidePanel,
  initBackButton,
} from "./scripts/ui/UIHandlers.js";
// Application State
import appState from "./scripts/core/AppState.js";
import { processScene } from "./scripts/core/SceneProcessor.js";
// Singleton Managers
import themeManager from "./scripts/themeManager.js";
import audioManager from "./scripts/audio.js";

// Features
import { setupMailbox } from "./scripts/mailbox.js"; // adjust path if needed

import { initImageOverlay } from "./scripts/fadeOverlayImage.js";
import { createSteamEffect } from "./scripts/shaders/steamEffect.js";
import CursorOverlay from "./scripts/effects/CursorOverlay.js";

// Configuration
import {
  imageData,
  socialLinks,
  CANVAS_CONFIG,
  CAMERA_CONFIG,
  WHITEBOARD_CONFIG,
  INNER_WEB_CONFIG,
  STEAM_CONFIG,
  MODAL_SELECTORS,
  IMAGE_OVERLAY_SELECTORS,
  LOADING_SELECTORS,
  SIDE_PANEL_SELECTORS,
  ANIMATION_DURATIONS,
  MODEL_PATHS,
  BUTTON_IDS,
} from "./scripts/config/constants.js";

import { IntroTutorial } from "./scripts/ui/IntroTutorial.js";
import ParticleTrail from "./scripts/effects/ParticleTrail.js"; // <-- Import the new class

// Add to your main initialization (around line where you setup other components)
let introTutorial = null;
/**
 * ===================================================================
 * LOADING MANAGER SETUP
 * ===================================================================
 */

/**
 * ===================================================================
 * SCENE LOADING
 * ===================================================================
 */

function loadScene() {
  appState.gltfLoader.load("/models/RoomV2-Export-v2.glb", (glb) => {
    const clips = glb.animations || [];

    // ─────────────────────────────────────────
    //  MUG ANIMATION: mixer + action + toggle
    // ─────────────────────────────────────────
    const mixer = new THREE.AnimationMixer(glb.scene);

    // hook mixer into your existing RenderLoop (it already loops appState.mixers)
    if (!appState.mixers) appState.mixers = [];
    appState.mixers.push(mixer);
    const idleClip = THREE.AnimationClip.findByName(clips, "Idle");

    const mugOpenClip = THREE.AnimationClip.findByName(clips, "mugOpen");
    let mugOpenAction = null;
    let idleAction = null;

    if (mugOpenClip) {
      mugOpenAction = mixer.clipAction(mugOpenClip);
      mugOpenAction.setLoop(THREE.LoopOnce);
      mugOpenAction.clampWhenFinished = true; // stay at last frame
    }
    if (idleClip) {
      idleAction = mixer.clipAction(idleClip);
      idleAction.setLoop(THREE.LoopRepeat);
      idleAction.clampWhenFinished = false;
      idleAction.timeScale = 1;
      idleAction.play(); // 🔴 this actually starts the idle
    }
    console.log("Idle clip:", idleClip);
    console.log("Idle action:", idleAction);
    appState.peashooterIdleAction = idleAction;
    if (idleClip) {
      idleAction = mixer.clipAction(idleClip);
      idleAction.setLoop(THREE.LoopRepeat);
      idleAction.clampWhenFinished = false;
      idleAction.timeScale = 1;
      idleAction.play();

      console.log(
        "Idle action running?",
        idleAction.isRunning(),
        "weight:",
        idleAction.getEffectiveWeight()
      );
    }

    // store state + helper on appState so other systems can trigger it
    appState.mugAnimation = {
      action: mugOpenAction,
      duration: mugOpenClip ? mugOpenClip.duration : 0,
      isOpen: false,
    };

    appState.toggleMugLid = () => {
      const data = appState.mugAnimation;
      if (!data || !data.action) return;

      const { action, duration } = data;

      // Always reset before playing
      action.reset();

      if (data.isOpen) {
        // 🔁 CLOSE: play backwards from the end
        action.time = duration;
        action.timeScale = -1;
        data.isOpen = false;
      } else {
        // ▶ OPEN: play forwards from the start
        action.time = 0;
        action.timeScale = 1;
        data.isOpen = true;
      }

      action.play();
    };
    processScene(glb.scene);
    appState.scene.add(glb.scene);

    // ─────────────────────────────────────────────
    // Mailbox setup – now that GLB meshes exist
    // ─────────────────────────────────────────────
    const mailbox = setupMailbox(glb.scene, {
      showModal: appState.showModal,
    });

    // attach mailbox to existing raycaster controller
    if (appState.raycasterController) {
      appState.raycasterController.mailbox = mailbox;
    }

    initializeTutorial();
    playIntroAnimation();
  });
}

// New function to initialize the tutorial system
function initializeTutorial() {
  // Make sure raycaster controller is available
  if (!appState.raycasterController) {
    console.warn(
      "RaycasterController not available yet, tutorial may not work properly"
    );
  }

  introTutorial = new IntroTutorial({
    scene: appState.scene,
    camera: appState.camera,
    renderer: appState.renderer,
    raycasterController: appState.raycasterController,
  });
  appState.introTutorial = introTutorial;
}

function restartTutorial() {
  if (introTutorial) {
    introTutorial.start();
  }
}

// Optional: Add keyboard shortcut to restart tutorial
document.addEventListener("keydown", (event) => {
  if (event.key === "T" && event.ctrlKey) {
    // Ctrl+T to restart tutorial
    event.preventDefault();
    restartTutorial();
  }
});
/**
 * ===================================================================
 * STEAM EFFECT
 * ===================================================================
 */

function setupSteamEffect() {
  appState.textureLoader.load(STEAM_CONFIG.texture.src, (tex) => {
    tex.wrapS = STEAM_CONFIG.texture.wrapS;
    tex.wrapT = STEAM_CONFIG.texture.wrapT;
    const steamMesh = createSteamEffect(tex, STEAM_CONFIG.geometry);
    steamMesh.position.copy(STEAM_CONFIG.position);
    appState.setSteamMesh(steamMesh);
    appState.scene.add(steamMesh);
  });
}

/**
 * Toggle steam effect visibility
 */
function toggleSteam(steamMesh, duration = 0.5) {
  if (!steamMesh) return;

  const mat = steamMesh.material;
  if (!mat.uniforms?.uGlobalAlpha) return;

  const fadeIn = !steamMesh.visible;
  const target = fadeIn ? 1 : 0;

  gsap.killTweensOf(mat.uniforms.uGlobalAlpha);

  if (fadeIn) mat.uniforms.uGlobalAlpha.value = 0;

  gsap.to(mat.uniforms.uGlobalAlpha, {
    value: target,
    duration: duration,
    ease: "none",
    onStart: () => {
      if (fadeIn) steamMesh.visible = true;
    },
    onComplete: () => {
      if (!fadeIn) steamMesh.visible = false;
    },
  });
}

/**
 * ===================================================================
 * ANIMATIONS
 * ===================================================================
 */

// Modify your playIntroAnimation function to include tutorial
function playIntroAnimation() {
  const t1 = gsap.timeline({
    duration: 0.8,
    ease: "back.out(1.8)",
    onComplete: () => {
      const onIntroComplete = () => {
        console.log("Intro animation complete. Starting tutorial.");
        // Start tutorial after the camera has settled
        if (introTutorial) {
          introTutorial.start();
        }
      };
      // If debug mode is on, skip the animation and snap to the final position.
      if (appState.isInDebugMode()) {
        console.log("Skipping intro animation due to debug mode.");
        appState.cameraManager.resetToDefault(0); // Instantly snap to default
        onIntroComplete();
        return;
      }

      //sweep', 'reveal', or 'orbit'

      const animationStyle = "reveal";
      const animationDuration = 5.0;

      appState.cameraManager.playIntroAnimation(
        animationStyle,
        animationDuration,
        onIntroComplete
      );
    },
  });
}
// ─────────────────────────────────────────────────────────────
// Load Peashooter model (DEBUG: glued to camera, always visible)
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// Load Peashooter model – DEBUG: force into view + snap camera
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// Load Peashooter model – centered & placed in the room
// ─────────────────────────────────────────────────────────────
function loadPeashooter() {
  // If the GLB is in /public/models/peashooter.glb
  let url = "/models/peashooter.glb";
  // If it's in src instead, use this form:
  // let url = new URL("./models/peashooter.glb", import.meta.url).href;

  appState.gltfLoader.load(
    url,
    (gltf) => {
      const model = gltf.scene;

      // Wrap in a container so we can move/scale without fighting internal offsets
      const root = new THREE.Group();
      root.name = "Peashooter";
      root.add(model);

      // Ensure visible & not culled
      root.visible = true;
      root.traverse((o) => {
        if (o.isSkinnedMesh || o.isMesh) {
          const oldMap = o.material?.map || null;
          o.material = new THREE.MeshBasicMaterial({
            color: 0x00ff00, // bright green for now
            map: oldMap,
            skinning: !!o.isSkinnedMesh,
          });
          o.frustumCulled = false;
        }
      });

      // 1) Compute bounding box of the whole container
      const box = new THREE.Box3().setFromObject(root);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);

      // 2) Scale so the largest dimension is about 1.5 m
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const target = 1.5;
      const scale = target / maxDim;
      root.scale.setScalar(scale);

      // Recompute box & center after scaling
      box.setFromObject(root);
      box.getCenter(center);

      // 3) Decide where you want it in the room
      //    (right now: x=0, y=1.5, z=0 – tweak these to put it on the floor, table, etc.)
      const spawnPos = new THREE.Vector3(0, 1.5, 0);

      // Translate the whole container so its bounding-box center is at spawnPos
      const offset = spawnPos.clone().sub(center);
      root.position.add(offset);

      // Add to scene and keep a reference
      appState.scene.add(root);
      appState.peashooter = root;

      // Debug helpers
      const helperBox = new THREE.Box3Helper(
        new THREE.Box3().setFromObject(root)
      );
      appState.scene.add(helperBox);

      const axes = new THREE.AxesHelper(0.5);
      axes.position.copy(spawnPos);
      appState.scene.add(axes);

      console.log(
        "Peashooter world center:",
        new THREE.Box3().setFromObject(root).getCenter(new THREE.Vector3())
      );
      console.log("Peashooter animations:", gltf.animations);

      // 4) Animation – use the inner model as the mixer root so bones animate
      const mixer = new THREE.AnimationMixer(model);
      let clip = null;

      if (gltf.animations && gltf.animations.length > 0) {
        clip =
          THREE.AnimationClip.findByName(gltf.animations, "Idle") ||
          gltf.animations[0];

        const action = mixer.clipAction(clip);
        action.setLoop(THREE.LoopRepeat);
        action.clampWhenFinished = false;
        action.enabled = true;
        action.play();
      } else {
        console.warn("Peashooter GLB has no animations");
      }

      appState.addMixer(mixer);
    },
    undefined,
    (err) => {
      console.error("Failed to load peashooter.glb", err);
    }
  );
}

/**
 * ===================================================================
 * EVENT LISTENERS SETUP
 * ===================================================================
 */

function setupEventListeners() {
  // Event handlers
  const handlers = new EventHandler({
    themeButton: document.getElementById(BUTTON_IDS.themeToggle),
    soundButton: document.getElementById(BUTTON_IDS.soundToggle),
    backButton: document.getElementById(BUTTON_IDS.backButton),
    themeManager,
    audioManager,
    body: document.body,
    camera: appState.camera,
    renderer: appState.renderer,
    innerWeb: appState.innerWeb,
    composer: appState.composer,
    sizes: appState.sizes,
    cameraManager: appState.cameraManager,
    whiteboard: appState.whiteboard,
    loadingButton: document.querySelector(LOADING_SELECTORS.button),
    pointer: appState.pointer,
  });

  handlers.registerThemeToggle();
  handlers.registerSoundToggle();
  handlers.registerResize();
  handlers.registerKeyboard();
  handlers.registerLoadingButton();
  handlers.registerPointerMove();

  initModalOverlay();
  initSidePanel();
  initBackButton();
  console.log("Event listeners set up");
}

/**
 * ===================================================================
 * MAIN INITIALIZATION
 * ===================================================================
 */
// function createTVEyesPlane() {
//   const eyes = new TVEyesChannel({ width: 960, height: 540 });
//   appState.tvEyes = eyes;

//   const plane = new THREE.Mesh(
//     new THREE.PlaneGeometry(1, 1),
//     new THREE.MeshBasicMaterial({
//       map: eyes.texture,
//       depthTest: false, // sit “on top” of stuff
//       toneMapped: false, // CanvasTexture already in sRGB
//     })
//   );
//   plane.name = "TV_EYES_PLANE";
//   plane.material.map.flipY = false;
//   plane.material.map.colorSpace = THREE.SRGBColorSpace;

//   const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
//     appState.camera.quaternion
//   );
//   plane.position.set(2.7754769325256348, 3.801779270172119, -5.308991432189941);

//   plane.scale.set(4.8, 2.65, 1);

//   plane.renderOrder = 1;
//   appState.scene.add(plane);
//   appState.tvEyesPlane = plane;
// }

document.addEventListener("DOMContentLoaded", () => {
  // Initialize core components using the new Initializer
  initializeAll();

  // Initialize UI and other components
  initializeUI();
  // createTVEyesPlane();
  //appState.tvEyes.setPupilSize(0.4);
  const cursorFX = new CursorOverlay({
    mode: "paw",
    zIndex: 50,
    domElement: appState.renderer.domElement,

    // Return true => suppress (hide) the orbit/pan HUD for this press.
    shouldSuppress: (e) => {
      // 1) If clicking standard HTML controls
      const ui = e.target.closest?.(
        "button, a, [role='button'], input, select, textarea"
      );
      if (ui) return true;

      // 2) If your 3D raycaster says this is an interactive hit
      // (adapt to your API; using a hypothetical pick(x,y) here)
      const hit = appState.raycasterController?.pick?.(e.clientX, e.clientY);
      if (
        hit &&
        (hit.object?.userData?.interactive || hit.object?.userData?.ui)
      ) {
        return true;
      }

      // 3) If you’re holding a modifier that means “not orbiting”
      if (e.shiftKey || e.altKey || e.metaKey) return true;

      // otherwise, allow the HUD
      return false;
    },
  });

  if (appState.renderer?.domElement?.style) {
    appState.renderer.domElement.style.touchAction = "none";
    // block native drag & text selection on the WebGL canvas
    appState.renderer.domElement.style.userSelect = "none";
    appState.renderer.domElement.setAttribute("draggable", "false");
    appState.renderer.domElement.addEventListener("dragstart", (e) => {
      e.preventDefault();
    });
  }
  cursorFX.start();

  // toggle with a key (SHIFT + C)
  window.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "c" && e.shiftKey) {
      cursorFX.nextMode();
      console.log("Cursor FX mode:", cursorFX.mode);
    }
  });
  /* ──────────────────────────────────────────────
   Image overlay → toggle the ray-caster
   ────────────────────────────────────────────── */
  const { showImageOverlay, hideImageOverlay } = initImageOverlay({
    onOpen: () => appState.disableRaycast(),
    onClose: () => appState.enableRaycast(),
  });

  // Make it available to the rest of the app
  appState.showImageOverlay = showImageOverlay;
  appState.hideImageOverlay = hideImageOverlay;

  // ─────────────────────────────────────────────
  // Mailbox setup – hook into scene + modal system
  // ─────────────────────────────────────────────

  // create controller (camera & empty list for now)
  const rayCtrl = new RaycasterController(
    appState.camera,
    appState.raycasterObjects,
    {
      outlinePass: appState.outlinePass,
      scaleTargets: appState.animatedObjects.scale,
      // mailbox will be attached later, after GLB is loaded
    }
  );

  appState.setRaycasterController(rayCtrl);

  setupLoadingScreen();
  setupEventListeners();

  // Load scene and start render loop
  loadScene();
  loadPeashooter();

  setupSteamEffect();
  // right after setupSteamEffect() or wherever you want the loop to begin
  const renderLoop = createRenderLoop({ introTutorial });
  renderLoop.start();
});
