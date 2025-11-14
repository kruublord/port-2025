// scripts/scene/SceneProcessor.js
import * as THREE from "three";
import themeManager from "../themeManager.js";
import clockManager from "../clock.js";
import { processRotatingObject } from "../objectRotation.js";
import appState from "../core/AppState.js";

const MUG_HOVER_GROUP_ID = "mugSet";
const MAILBOX_HOVER_GROUP_ID = "mailboxSet";

export function processScene(sceneRoot) {
  sceneRoot.traverse((child) => {
    if (!child.isMesh) return;

    if (themeManager.processThemedMesh(child, window.loadedTextures)) {
      categorizeAnimated(child);
      processSpecial(child);
      processRotatingObject(child);

      if (child.name.includes("raycast")) appState.addRaycasterObject(child);
      if (child.name.includes("hat"))
        console.log("Found hat mesh:", child.position);
    }
    // Perry mug + lid hover group
    if (
      child.name === "perry-mug-raycast-seven" ||
      child.name === "perry-hat-seven"
    ) {
      console.log("Found perry mug/hat piece:", child.name, child.position);

      // put both into the same hover group
      child.userData.hoverGroup = MUG_HOVER_GROUP_ID;

      // mug already has "raycast" in its name, so it’s probably
      // already added above; the hat doesn't, so add only non-raycast ones
      if (!child.name.includes("raycast")) {
        appState.addRaycasterObject(child);
      }
    }
    // Mailbox body + cover hover group
    if (
      child.name === "mailbox-four-raycast" ||
      child.name === "mailbox-cover-four"
    ) {
      console.log("Found mailbox piece:", child.name, child.position);

      child.userData.hoverGroup = MAILBOX_HOVER_GROUP_ID;

      // body has "raycast" already; make sure the cover is raycastable too
      if (!child.name.includes("raycast")) {
        appState.addRaycasterObject(child);
      }
    }

    if (child.name.includes("duck")) {
      console.log("Found duck mesh:", child.position);
    }
    // material tweaks
    if (child.material?.map) child.material.map.minFilter = THREE.LinearFilter;

    // clock hands
    if (child.name.includes("clock-hour")) clockManager.setHourHand(child);
    else if (child.name.includes("clock-min"))
      clockManager.setMinuteHand(child);
    else if (child.name.includes("clock-sec"))
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
