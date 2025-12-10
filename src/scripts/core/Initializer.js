import * as THREE from "three";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// Core imports
import { initThreeJS } from "./scene.js";
import appState from "./AppState.js";

// Singleton Managers
import themeManager from "../themeManager.js";
import CameraManager from "../camera.js";
import Whiteboard from "../special-interactions/whiteboard.js";
import { initInnerWeb } from "../innerWeb.js";
import { setupHoverOutline } from "../hoverOutline.js";

// Configuration
import {
  CANVAS_CONFIG,
  CAMERA_CONFIG,
  WHITEBOARD_CONFIG,
  INNER_WEB_CONFIG,
  MODEL_PATHS,
} from "../config/constants.js";

function initializeThreeJS() {
  const canvas = document.querySelector(CANVAS_CONFIG.selector);
  appState.setCanvas(canvas);

  const threeJSComponents = initThreeJS(canvas, appState.sizes);
  appState.setThreeJSComponents(threeJSComponents);

  const hoverSetup = setupHoverOutline(
    appState.renderer,
    appState.scene,
    appState.camera,
    appState.sizes
  );
  appState.setPostProcessing(hoverSetup.composer, hoverSetup.outlinePass);
}

function initializeLoaders() {
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath(MODEL_PATHS.draco);
  const loader = new GLTFLoader(appState.loadingManager);
  loader.setDRACOLoader(dracoLoader);
  appState.gltfLoader = loader;
}

function initializeManagers() {
  const { textureMap, loadedTextures } = themeManager.loadAllTextures(
    appState.textureLoader
  );

  const cameraManager = new CameraManager(
    appState.camera,
    appState.renderer,
    CAMERA_CONFIG.defaultPosition,
    CAMERA_CONFIG.defaultTarget
  );
  appState.setCameraManager(cameraManager);

  const whiteboard = new Whiteboard(
    appState.scene,
    appState.camera,
    appState.renderer,
    cameraManager.controls
  );
  whiteboard.setPosition(WHITEBOARD_CONFIG.position);
  whiteboard.setRotation(
    WHITEBOARD_CONFIG.rotation.x,
    WHITEBOARD_CONFIG.rotation.y,
    WHITEBOARD_CONFIG.rotation.z
  );
  appState.setWhiteboard(whiteboard);

  const innerWeb = initInnerWeb(
    appState.scene,
    appState.camera,
    document.body,
    appState.sizes,
    {
      html: INNER_WEB_CONFIG.html,
      position: INNER_WEB_CONFIG.position,
      rotation: INNER_WEB_CONFIG.rotation,
      scale: INNER_WEB_CONFIG.scale,
    }
  );
  appState.setInnerWeb(innerWeb);

  window.loadedTextures = loadedTextures;
}

function initializeAll() {
  initializeThreeJS();
  initializeLoaders();
  initializeManagers();
}

export {
  initializeThreeJS,
  initializeLoaders,
  initializeManagers,
  initializeAll,
};
