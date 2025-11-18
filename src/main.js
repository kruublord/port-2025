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
import ErhuInteraction from "./scripts/erhu.js"; // ADD THIS

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
    //  MUG + IDLE ANIMATIONS
    // ─────────────────────────────────────────
    const mixer = new THREE.AnimationMixer(glb.scene);

    if (!appState.mixers) appState.mixers = [];
    appState.mixers.push(mixer);

    const idleClip = THREE.AnimationClip.findByName(clips, "Idle");
    const mugOpenClip = THREE.AnimationClip.findByName(clips, "mugOpen");
    let mugOpenAction = null;
    let idleAction = null;

    if (mugOpenClip) {
      mugOpenAction = mixer.clipAction(mugOpenClip);
      mugOpenAction.setLoop(THREE.LoopOnce);
      mugOpenAction.clampWhenFinished = true;
    }

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
    const erhuMesh = glb.scene.getObjectByName("erhu-raycast-nine"); // Adjust name if needed
    if (erhuMesh) {
      const erhuInteraction = new ErhuInteraction(appState.scene, erhuMesh);
      appState.erhuInteraction = erhuInteraction;

      // Attach to raycaster controller if it exists
      if (appState.raycasterController) {
        appState.raycasterController.erhuInteraction = erhuInteraction;
      }

      console.log("Erhu interaction setup complete");
    } else {
      console.warn("Erhu mesh not found - check object name");
    }

    appState.peashooterIdleAction = idleAction;

    appState.mugAnimation = {
      action: mugOpenAction,
      duration: mugOpenClip ? mugOpenClip.duration : 0,
      isOpen: false,
    };

    appState.toggleMugLid = () => {
      const data = appState.mugAnimation;
      if (!data || !data.action) return;

      const { action, duration } = data;
      action.reset();

      if (data.isOpen) {
        action.time = duration;
        action.timeScale = -1;
        data.isOpen = false;
      } else {
        action.time = 0;
        action.timeScale = 1;
        data.isOpen = true;
      }

      action.play();
    };

    // ─────────────────────────────────────────
    //  PROCESS SCENE + ADD
    // ─────────────────────────────────────────
    processScene(glb.scene); // applies theme materials (including peashooter)
    appState.scene.add(glb.scene);

    // ─────────────────────────────────────────
    //  EMBEDDED PEASHOOTER SETUP (NO EXTERNAL GLB)
    // ─────────────────────────────────────────
    const embeddedPea =
      glb.scene.getObjectByName("peashooter-nine") ||
      glb.scene.getObjectByName("peashooter") ||
      glb.scene.getObjectByName("Peashooter");

    if (embeddedPea) {
      console.log("[Pea] Embedded peashooter found:", embeddedPea);

      embeddedPea.traverse((o) => {
        if (!o.isMesh && !o.isSkinnedMesh) return;

        const name = o.name || "(no-name)";
        const matType = o.material ? o.material.type : "none";

        // make sure themed ShaderMaterial still supports skinning
        if (o.isSkinnedMesh && o.material && "skinning" in o.material) {
          o.material.skinning = true;
        }

        o.frustumCulled = false;
        o.visible = true;

        console.log("[Pea] submesh:", {
          name,
          isSkinned: !!o.isSkinnedMesh,
          matType,
          skinning: o.material && o.material.skinning,
        });
      });

      // Store for later use
      appState.peashooter = embeddedPea;

      // Optional debug box to check position
      const peaBox = new THREE.Box3().setFromObject(embeddedPea);
      const peaCenter = peaBox.getCenter(new THREE.Vector3());
      console.log("[Pea] embedded peashooter center:", peaCenter);
      // const peaHelper = new THREE.Box3Helper(peaBox);
      // appState.scene.add(peaHelper);
    } else {
      console.warn(
        "[Pea] No embedded peashooter found – check object name in Blender."
      );
    }

    // ─────────────────────────────────────────
    //  MAILBOX SETUP
    // ─────────────────────────────────────────
    const mailbox = setupMailbox(glb.scene, {
      showModal: appState.showModal,
    });

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
// ─────────────────────────────────────────────────────────────
// Load Peashooter model and snap it to the pot anchor
// (keeps the original transforms inside the GLB)
// ─────────────────────────────────────────────────────────────
function loadPeashooter() {
  const url = "/models/peashooter.glb";

  appState.gltfLoader.load(
    url,
    (gltf) => {
      const model = gltf.scene;

      const root = new THREE.Group();
      root.name = "PeashooterRoot";
      root.add(model);

      // Make sure meshes render correctly + apply theme
      root.traverse((o) => {
        if (!o.isMesh && !o.isSkinnedMesh) return;

        const name = o.name || "(no-name)";

        // Apply themed material if textures are loaded and name matches
        if (window.loadedTextures) {
          const themed = themeManager.processThemedMesh(
            o,
            window.loadedTextures
          );
          console.log("[Pea] themed?", { name, themed, mat: o.material?.type });
        }

        // Safety: ensure skinned meshes keep skinning on the shader
        if (o.isSkinnedMesh && o.material && "skinning" in o.material) {
          o.material.skinning = true;
        }

        o.frustumCulled = false;
        o.visible = true;
      });

      const anchor = appState.peashooterAnchor;
      if (anchor) {
        root.position.copy(anchor.position);
        root.quaternion.copy(anchor.quaternion);
        root.scale.copy(anchor.scale);
      } else {
        console.warn(
          "[Pea] Peashooter anchor not set – using GLB's own transform."
        );
      }

      appState.scene.add(root);
      appState.peashooter = root;

      console.log("[Pea] Peashooter animations:", gltf.animations);

      const mixer = new THREE.AnimationMixer(model);
      if (gltf.animations && gltf.animations.length > 0) {
        const clip =
          THREE.AnimationClip.findByName(gltf.animations, "Idle") ||
          gltf.animations[0];

        const action = mixer.clipAction(clip);
        action.setLoop(THREE.LoopRepeat);
        action.clampWhenFinished = false;
        action.enabled = true;
        action.play();

        appState.peashooterIdleAction = action;
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
  // loadPeashooter();

  setupSteamEffect();
  // right after setupSteamEffect() or wherever you want the loop to begin
  const renderLoop = createRenderLoop({ introTutorial });
  renderLoop.start();
});
