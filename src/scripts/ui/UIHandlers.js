// scripts/ui/UIHandlers.js
import appState from "../core/AppState.js";
import { SIDE_PANEL_SELECTORS, BUTTON_IDS } from "../config/constants.js";

export function initModalOverlay() {
  const closeBtns = document.querySelectorAll(".modal-close-btn");
  function closeAny() {
    Object.values(appState.modals).forEach((m) => {
      if (m.style.display === "block") {
        appState.hideModal(m);
      }
    });
  }
  appState.overlay.addEventListener("click", closeAny);
  closeBtns.forEach((btn) => btn.addEventListener("click", closeAny));
}

export function initSidePanel() {
  const burger = document.querySelector(SIDE_PANEL_SELECTORS.hamburgerBtn);
  const panel = document.querySelector(SIDE_PANEL_SELECTORS.sidePanel);
  const links = panel.querySelectorAll(SIDE_PANEL_SELECTORS.panelLinks);

  burger.addEventListener("click", () => {
    burger.classList.toggle("active");
    panel.classList.toggle("active");
  });

  links.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const label = link.textContent.trim().toLowerCase();
      burger.classList.remove("active");
      panel.classList.remove("active");
      route(label);
    });
  });

  document.addEventListener("click", (e) => {
    if (
      !panel.contains(e.target) &&
      !burger.contains(e.target) &&
      panel.classList.contains("active")
    ) {
      burger.classList.remove("active");
      panel.classList.remove("active");
    }
  });

  function route(label) {
    const { cameraManager, whiteboard, showModal, modals } = appState;
    switch (label) {
      case "reset camera":
        cameraManager.resetToDefault();
        break;
      case "work":
        showModal(modals.work);
        break;
      case "about":
        showModal(modals.about);
        break;
      case "contact":
        showModal(modals.contact);
        break;
      case "whiteboard":
        cameraManager.zoomToWhiteboard(whiteboard, 1.5);
        break;
    }
  }
}

export function initBackButton() {
  const backBtn = document.getElementById(BUTTON_IDS.backButton);
  if (!backBtn) return;

  backBtn.addEventListener("click", (e) => {
    // 🔹 Important: stop this click from reaching window → RaycasterController
    e.preventDefault();
    e.stopPropagation();

    // 🔹 Exit whiteboard mode if it's active
    if (appState.whiteboard?.whiteboardModeOn) {
      appState.whiteboard.toggleWhiteboardMode(false);
    }

    // 🔹 Exit monitor/iframe mode if it's active
    if (appState.innerWeb) {
      appState.innerWeb.disableIframe();
    }

    // 🔹 Reset camera to your default view
    appState.cameraManager?.resetToDefault?.();

    // 🔹 Clear any leftover hover outlines / state
    appState.raycasterController?.clearHover?.();

    backBtn.style.display = "none";
  });
}
