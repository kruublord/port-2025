// scripts/core/RaycasterController.js
import * as THREE from "three";
import { updateOutlineHover } from "../hoverOutline.js";
import { updateHoverScale } from "../hoverScale.js";
import appState from "../core/AppState.js";
import audioManager from "../audio.js";
import { spinAnimation } from "../spinnyObjects.js";
import { randomOink } from "../pig.js";
import { imageData, socialLinks, BUTTON_IDS } from "../config/constants.js";

/**
 * Wrapper around THREE.Raycaster with a few built-in “hover helpers”.
 */
export default class RaycasterController {
  /**
   * @param {THREE.Camera}        camera
   * @param {THREE.Object3D[]}    sceneObjects
   * @param {Object}              [opts]
   * @param {THREE.OutlinePass}   [opts.outlinePass]  - post-proc outline pass to update
   * @param {THREE.Object3D[]}    [opts.scaleTargets] - meshes that pulse when hovered
   * @param {Object}              [opts.mailbox]      - custom mailbox w/ updateMailboxHover()
   */
  constructor(camera, sceneObjects = [], opts = {}) {
    // basic raycaster plumbing ------------------------
    this.camera = camera;
    this.objects = sceneObjects;
    this.enabled = true;

    this.pointer = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();
    /** @type {THREE.Intersection[]} */
    this.intersects = [];
    this._suppressEmptyClearUntil = 0;
    // inside constructor
    this._outlineFrozen = false;
    this._frozenSelection = null;

    // optional helpers --------------------------------
    const {
      outlinePass = null,
      scaleTargets = [],
      mailbox = null,
      erhuInteraction = null, // ADD THIS LINE
    } = opts;

    this.outlinePass = outlinePass;
    this.scaleTargets = scaleTargets;
    this.mailbox = mailbox;
    this.erhuInteraction = erhuInteraction; // ADD THIS LINE

    /** hover-groupId -> THREE.Object3D[] */
    this.hoverGroups = {};

    window.addEventListener("click", () => this._handleClick());
  }

  freezeOutline(selection = []) {
    this._outlineFrozen = true;
    // store a shallow copy so later mutations don’t affect the frozen set
    this._frozenSelection = Array.isArray(selection) ? selection.slice() : [];
    if (this.outlinePass) {
      this.outlinePass.selectedObjects = this._frozenSelection;
    }
  }

  thawOutline() {
    this._outlineFrozen = false;
    this._frozenSelection = null;
    // don’t clear here; let normal hover logic take back control on next update()
  }

  /**
   * Call every frame or on pointer-move.
   * @param {number} mouseX – NDC-space X (-1 → 1)
   * @param {number} mouseY – NDC-space Y (-1 → 1)
   * @returns {THREE.Intersection[]}
   */
  update(mouseX, mouseY) {
    if (!this.enabled) return [];

    // raycast plumbing -------------------------------------------------
    this.pointer.set(mouseX, mouseY);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    this.intersects = this.raycaster.intersectObjects(this.objects, true);

    const primaryHit = this.intersects[0]?.object || null;
    // === ADD THIS BLOCK ===
    if (this.erhuInteraction) {
      const isErhuHovered = this.erhuInteraction.isErhuObject(primaryHit);
      if (isErhuHovered) {
        this.erhuInteraction.onHoverStart();
      } else {
        this.erhuInteraction.onHoverEnd();
      }
    }
    // outlines + hover groups ------------------------------------------
    let hoverGroup = null;

    if (this.outlinePass) {
      // baseline outline behavior (whatever your hoverOutline.js does)
      updateOutlineHover(
        this.raycaster,
        this.pointer,
        this.camera,
        this.objects,
        this.outlinePass
      );

      if (this._outlineFrozen) {
        // 🔒 keep the tutorial’s selection while frozen
        this.outlinePass.selectedObjects = this._frozenSelection || [];
      } else {
        // augment with hover groups (mug, mailbox, etc.)
        hoverGroup = this._getHoverGroupForObject(primaryHit);

        // if the hit object belongs to a hover group,
        // force the outline to use the whole group (e.g. mug + lid, mailbox body + cover)
        if (hoverGroup && hoverGroup.length) {
          this.outlinePass.selectedObjects = hoverGroup;
        }
      }
    } else {
      // still resolve hoverGroup even if we don't have an outlinePass
      hoverGroup = this._getHoverGroupForObject(primaryHit);
    }

    // mailbox cover open/close driven by hoverGroup --------------------
    if (this.mailbox?.setMailboxHoverState) {
      const isMailboxHovered =
        !!hoverGroup &&
        hoverGroup.some(
          (obj) => obj.userData && obj.userData.hoverGroup === "mailboxSet"
        );

      // this will log "Mailbox hover state:" and then call toggleMailboxCover(...)
      this.mailbox.setMailboxHoverState(isMailboxHovered);
    }

    // scale pulse targets ----------------------------------------------
    if (this.scaleTargets?.length) {
      updateHoverScale(this.intersects, this.scaleTargets);
    }

    return this.intersects;
  }

  /* ---------- tiny convenience helpers ------------- */
  /**
   * Given an intersected object, return all objects that belong to the same
   * hoverGroup (based on userData.hoverGroup). Uses a small cache so we
   * only scan once per groupId.
   */
  _getHoverGroupForObject(object) {
    if (!object) return null;

    // 1) walk up parents to find a hoverGroup id
    let current = object;
    let groupId = null;

    while (current) {
      if (current.userData && current.userData.hoverGroup) {
        groupId = current.userData.hoverGroup;
        break;
      }
      current = current.parent;
    }

    if (!groupId) return null;

    // 2) if we already built this group once, reuse it
    if (this.hoverGroups[groupId]) {
      return this.hoverGroups[groupId];
    }

    // 3) otherwise, scan through raycastable objects to build the group
    const groupMembers = [];
    const search = (obj) => {
      if (!obj) return;
      if (obj.userData && obj.userData.hoverGroup === groupId) {
        groupMembers.push(obj);
      }
      if (obj.children && obj.children.length) {
        obj.children.forEach(search);
      }
    };

    this.objects.forEach(search);

    this.hoverGroups[groupId] = groupMembers;
    return groupMembers;
  }

  /** Replace the set of objects the raycaster tests */
  setObjects(objects = []) {
    this.objects = objects;
  }

  clearHover() {
    if (this.outlinePass) this.outlinePass.selectedObjects = [];
    if (this.scaleTargets?.length) updateHoverScale([], this.scaleTargets);
    if (this.mailbox?.setMailboxHoverState) {
      this.mailbox.setMailboxHoverState(false);
    }
    // ADD THIS:
    if (this.erhuInteraction) {
      this.erhuInteraction.onHoverEnd();
    }
  }
  /** Toggle the entire controller on/off */
  setEnabled(flag) {
    this.enabled = !!flag;
  }
  // --- compatibility shims for older call-sites --------------------
  enable() {
    this.setEnabled(true);
  }
  disable() {
    this.setEnabled(false);
  }

  // Some utilities might still grab the raw THREE.Raycaster
  getRaycaster() {
    return this.raycaster;
  }

  /** Clear references (helps GC in SPA/Hot-reload flows) */
  // In dispose(), add erhu cleanup:
  dispose() {
    this.objects = [];
    this.scaleTargets = [];
    this.outlinePass = null;
    this.mailbox = null;
    if (this.erhuInteraction) {
      this.erhuInteraction.dispose();
      this.erhuInteraction = null;
    }
  }
  /* ===================================================================
   *  CLICK DISPATCH  (formerly handleRaycasterInteraction in main.js)
   * =================================================================== */

  _handleClick() {
    if (!appState.isRaycastEnabled || this.intersects.length === 0) return;

    const object = this.intersects[0].object;
    // 0) mug lid open/close toggle -----------------------------------
    // Use hoverGroup so either the mug body or hat lid will trigger it
    const mugHoverGroup = this._getHoverGroupForObject(object);
    const isMugGroup =
      mugHoverGroup &&
      mugHoverGroup.some(
        (obj) => obj.userData && obj.userData.hoverGroup === "mugSet"
      );

    if (isMugGroup && typeof appState.toggleMugLid === "function") {
      audioManager.playClick();
      appState.toggleMugLid();
      return;
    }

    // 1) modals --------------------------------------------------------
    if (object.name.includes("about-raycast")) return openModal("about");
    else if (object.name.includes("work-raycast")) return openModal("projects");
    else if (object.name.includes("erhu-raycast")) return openModal("erhu");
    else if (object.name.includes("TV-raycast")) return openModal("projects");

    // 2) image overlay -------------------------------------------------
    if (imageData[object.name]) {
      audioManager.playClick();
      const { src, caption } = imageData[object.name];
      return appState.showImageOverlay(src, caption);
    }

    // 3) social links --------------------------------------------------
    for (const [key, url] of Object.entries(socialLinks)) {
      if (object.name.toLowerCase().includes(key.toLowerCase())) {
        openExternalLink(url);
        return;
      }
    }

    // 4) special objects ----------------------------------------------
    if (object.name.includes("whiteboard-raycast")) {
      audioManager.playClick();
      appState.cameraManager.zoomToWhiteboard(appState.whiteboard, 1.5);
      appState.whiteboard.toggleWhiteboardMode(true);
      return;
    }

    if (object.name.includes("monitor")) {
      audioManager.playClick();
      appState.cameraManager.zoomToMonitor();
      appState.innerWeb.enableIframe();
      document.getElementById(BUTTON_IDS.backButton).style.display = "block";
      return;
    }

    if (object.name.includes("perry-hat")) {
      audioManager.playClick();
      return; // steam toggle handled elsewhere
    }

    // 5) mailbox & spin objects ---------------------------------------
    if (
      this.mailbox?.handleRaycastIntersection(object, appState.modals.contact)
    ) {
      audioManager.playClick();
      return;
    }

    if (appState.animatedObjects.spin.includes(object)) {
      if (spinAnimation(object)) audioManager.playClick();
    }

    /* ----- local helpers -------------------------------------------- */
    function openModal(which) {
      audioManager.playClick();
      appState.showModal(appState.modals[which]);
    }

    function openExternalLink(url) {
      audioManager.playClick();
      appState.raycasterController.clearHover();
      appState.disableRaycast();

      setTimeout(() => window.open(url, "_blank", "noopener,noreferrer"), 50);

      window.addEventListener("focus", () => {
        setTimeout(() => appState.enableRaycast(), 500);
      });
    }
  }
}
