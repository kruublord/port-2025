import gsap from "gsap";

/**
 * Mailbox module to handle mailbox-related functionality
 */
export function setupMailbox(scene, modalSystem) {
  let mailboxCover = null;
  let mailboxHovered = false;
  let isMailboxOpen = false;

  // Find the mailbox cover once from the loaded scene (GLB root)
  scene.traverse((child) => {
    if (child.isMesh && child.name === "mailbox-cover-four") {
      mailboxCover = child;
    }
  });

  // Animate cover open/close
  function toggleMailboxCover(open) {
    if (!mailboxCover || open === isMailboxOpen) return;
    isMailboxOpen = open;
    gsap.to(mailboxCover.rotation, {
      x: open ? Math.PI / 2 : 0, // rotate 90° when opening
      duration: 0.8,
      ease: "power2.out",
    });
  }

  // Show contact modal when clicking any mailbox piece
  function handleRaycastIntersection(intersectedObject, contactModal) {
    const name = intersectedObject.name || "";

    if (name === "mailbox-four-raycast" || name === "mailbox-cover-four") {
      modalSystem.showModal(contactModal);
      return true;
    }

    return false;
  }

  // Called by RaycasterController when the mailbox group is hovered / unhovered
  function setMailboxHoverState(isHovered) {
    if (mailboxHovered === isHovered) return;
    mailboxHovered = isHovered;
    toggleMailboxCover(isHovered);
  }

  return {
    handleRaycastIntersection,
    toggleMailboxCover,
    setMailboxHoverState,
  };
}
