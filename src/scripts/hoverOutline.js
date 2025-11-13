// scripts/hoverOutline.js

import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { OutlinePass } from "three/addons/postprocessing/OutlinePass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";

export function setupHoverOutline(renderer, scene, camera, sizes) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = sizes.width;
  const height = sizes.height;

  let composer,
    outlinePass,
    usingSMAA = false;

  // ---------- WebGL2 MSAA path ----------
  if (renderer.capabilities.isWebGL2) {
    const rt = new THREE.WebGLRenderTarget(width * dpr, height * dpr, {
      // depth/stencil are handled internally; samples enables MSAA
      samples: 4,
    });
    composer = new EffectComposer(renderer, rt);
    composer.setPixelRatio(dpr);
    composer.setSize(width, height);

    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    outlinePass = new OutlinePass(
      new THREE.Vector2(width, height),
      scene,
      camera
    );
    outlinePass.edgeStrength = 3.0;
    outlinePass.edgeThickness = 1.0;
    outlinePass.edgeGlow = 0.0;
    outlinePass.pulsePeriod = 0;
    outlinePass.usePatternTexture = false;
    outlinePass.visibleEdgeColor.set("#ffffff");
    outlinePass.hiddenEdgeColor.set("#ffffff");
    composer.addPass(outlinePass);

    // Keep OutputPass when using MSAA target
    composer.addPass(new OutputPass());
  } else {
    // ---------- Fallback: SMAA (works everywhere) ----------
    composer = new EffectComposer(renderer);
    composer.setPixelRatio(dpr);
    composer.setSize(width, height);

    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    outlinePass = new OutlinePass(
      new THREE.Vector2(width, height),
      scene,
      camera
    );
    outlinePass.edgeStrength = 3.0;
    outlinePass.edgeThickness = 1.0;
    outlinePass.edgeGlow = 0.0;
    outlinePass.pulsePeriod = 0;
    outlinePass.usePatternTexture = false;
    outlinePass.visibleEdgeColor.set("#ffffff");
    outlinePass.hiddenEdgeColor.set("#ffffff");
    composer.addPass(outlinePass);

    // SMAA should be the LAST pass (no OutputPass needed)
    const smaaPass = new SMAAPass(width * dpr, height * dpr);
    composer.addPass(smaaPass);
    usingSMAA = true;
  }

  return { composer, outlinePass, usingSMAA };
}

// Keep your existing hover update function
export function updateOutlineHover(
  raycaster,
  pointer,
  camera,
  targets,
  outlinePass
) {
  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObjects(targets);

  if (intersects.length > 0) {
    const selectedObject = intersects[0].object;
    const selectedObjects = [selectedObject, ...selectedObject.children];
    outlinePass.selectedObjects = selectedObjects;
    document.body.style.cursor = "pointer";
    return intersects;
  } else {
    outlinePass.selectedObjects = [];
    document.body.style.cursor = "default";
    return [];
  }
}

// Call this from your resize handler, AFTER resizing the renderer
export function resizeHoverOutline(composer, outlinePass, sizes) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  composer.setPixelRatio(dpr);
  composer.setSize(sizes.width, sizes.height);
  outlinePass.resolution.set(sizes.width, sizes.height);
}
