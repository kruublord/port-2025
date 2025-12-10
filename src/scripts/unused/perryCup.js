// perryCup.js
import { gsap } from "gsap";

export function setupPerryCupAnimation(perryHatObject) {
  // The positions for closed and open states
  const perryHatClosed = {
    x: -4.177665710449219,
    y: 2.7323927879333496,
    z: 1.0796866416931152,
  };

  const perryHatOpen = {
    x: -4.51853,
    y: 2.48441,
    z: 0.875922,
  };

  // Animation duration and easing
  const animationDuration = 1.2;
  const easeType = "power2.inOut";

  // Create a timeline for more control
  const hatTimeline = gsap.timeline({ paused: true });

  // Set initial position
  perryHatObject.position.set(
    perryHatClosed.x,
    perryHatClosed.y,
    perryHatClosed.z
  );

  hatTimeline
    .to(perryHatObject.position, {
      y: perryHatClosed.y + 0.1, // adjust lift height as needed
      duration: 0.3,
      ease: "power1.out",
    })
    .to(perryHatObject.position, {
      x: perryHatOpen.x,
      z: perryHatOpen.z,
      duration: 0.3,
      ease: "none",
    })
    .to(perryHatObject.position, {
      y: perryHatOpen.y,
      duration: 0.3,
      ease: "power1.in",
    });

  let isHatOn = false;

  function openLid() {
    if (!isHatOn) {
      hatTimeline.play();
      isHatOn = true;
      return true;
    }
    return false;
  }

  function closeLid() {
    if (isHatOn) {
      hatTimeline.reverse();
      isHatOn = false;
      return true;
    }
    return false;
  }

  // Function to toggle the lid state
  function toggleLid() {
    return isHatOn ? closeLid() : openLid();
  }

  // Return the control functions
  return {
    openLid,
    closeLid,
    toggleLid,
    isOpen: () => isHatOn,
  };
}
