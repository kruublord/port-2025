import { initModalSystem } from "../modal.js";
import { initImageOverlay } from "../fadeOverlayImage.js";
import { setupMailbox } from "../special-interactions/mailbox.js";
import appState from "../core/AppState.js";
import audioManager from "../core/audio.js";
import {
  MODAL_SELECTORS,
  IMAGE_OVERLAY_SELECTORS,
} from "../config/constants.js";
import { initProjectsDetail } from "./projectDetails.js";

function handleModalOpen() {
  appState.disableRaycast();
  clearHoverEffects();
  appState.cameraManager.handleModalState(true);
}

function handleModalClose() {
  appState.enableRaycast();
  appState.cameraManager.handleModalState(false);
}

function initializeUI() {
  const modalSystem = initModalSystem({
    overlaySelector: MODAL_SELECTORS.overlay,
    modalSelectors: MODAL_SELECTORS.modals,
    closeButtonSelector: MODAL_SELECTORS.closeButton,
    onModalOpen: handleModalOpen,
    onModalClose: handleModalClose,
  });

  appState.setModalSystem(
    modalSystem.overlay,
    modalSystem.modals,
    modalSystem.showModal,
    modalSystem.hideModal
  );

  // ⬇️ INIT projects list→detail inside the same modal
  const projectsModalEl = modalSystem.modals.projects;
  const projectsDetail = initProjectsDetail(projectsModalEl);

  const imageOverlaySystem = initImageOverlay({
    overlaySelector: IMAGE_OVERLAY_SELECTORS.overlay,
    contentSelector: IMAGE_OVERLAY_SELECTORS.content,
    closeBtnSelector: IMAGE_OVERLAY_SELECTORS.closeBtn,
    imgSelector: IMAGE_OVERLAY_SELECTORS.img,
    textSelector: IMAGE_OVERLAY_SELECTORS.text,
    onClose: () => {
      appState.enableRaycast();
    },
  });

  appState.setImageOverlay(
    imageOverlaySystem.showImageOverlay,
    imageOverlaySystem.hideImageOverlay
  );

  const modalSystemForMailbox = {
    showModal: appState.showModal,
    hideModal: appState.hideModal,
  };
}

function clearHoverEffects() {
  appState.clearHoverEffects();
}

export { initializeUI, handleModalOpen, handleModalClose };
