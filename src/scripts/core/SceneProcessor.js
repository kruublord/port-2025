// scripts/scene/SceneProcessor.js
import * as THREE from "three";
import themeManager from "../themeManager.js";
import clockManager from "../clock.js";
import { processRotatingObject } from "../objectRotation.js";
import { setupPerryCupAnimation } from "../perryCup.js";
import appState from "../core/AppState.js";

export function processScene(sceneRoot) {
  sceneRoot.traverse((child) => {
    if (!child.isMesh) return;

    if (themeManager.processThemedMesh(child, window.loadedTextures)) {
      categorizeAnimated(child);
      processSpecial(child);
      processRotatingObject(child);
      appState.mailbox.processMailboxObject(child);
      if (child.name.includes("raycast")) appState.addRaycasterObject(child);
      if (child.name.includes("hat"))
        console.log("Found hat mesh:", child.position);
    }
    if (child.name.includes("mug")) {
      console.log("Found mug mesh:", child.position);
    }
    if (child.name.includes("duck")) {
      console.log("Found duck mesh:", child.position);
    }
    // material tweaks
    if (child.material?.map) child.material.map.minFilter = THREE.LinearFilter;

    // clock hands
    if (child.name.includes("four-hour")) clockManager.setHourHand(child);
    else if (child.name.includes("four-minute"))
      clockManager.setMinuteHand(child);
    else if (child.name.includes("four-second"))
      clockManager.setSecondsHand(child);

    // glass materials
    themeManager.processGlassMesh(child);
  });
}

/* ---------- helpers ------------------------------------------------ */

function categorizeAnimated(mesh) {
  const { name } = mesh;
  if (name.includes("keycapAnimate"))
    appState.addAnimatedObject("keycaps", mesh);
  if (name.includes("animateScale")) appState.addAnimatedObject("scale", mesh);
  if (name.includes("animateSpin")) appState.addAnimatedObject("spin", mesh);
  if (name.includes("scaleLights"))
    appState.addAnimatedObject("scaleLights", mesh);
}

function processSpecial(mesh) {
  const { name } = mesh;
  if (name.includes("pig-head")) appState.setPigObject(mesh);
}
