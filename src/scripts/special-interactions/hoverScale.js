// hoverScale.js
import gsap from "gsap";

let lastHovered = null;

/**
 * Call this every frame with your raycast results and the list of objects you
 * want to scale on hover.
 *
 * @param {THREE.Intersection[]} intersects - result of raycaster.intersectObjects(...)
 * @param {THREE.Object3D[]} scaleObjects - array of meshes you want to be scalable
 * @param {Object} [opts]
 * @param {number} [opts.up=1.1]  target scale when hovered
 * @param {number} [opts.down=1.0] target scale when un-hovered
 * @param {number} [opts.duration=0.3] duration of each gsap tween (s)
 */
export function updateHoverScale(
  intersects,
  scaleObjects,
  { up = 1.1, down = 1.0, duration = 0.3 } = {}
) {
  // get the topmost intersected object, if any
  const hovered = intersects.length > 0 ? intersects[0].object : null;
  // only care if it's in our array
  const isScalable = hovered && scaleObjects.includes(hovered);

  // if we’ve moved onto a new object (or off entirely), tween the old one down and the new one up
  if (hovered !== lastHovered) {
    if (lastHovered) {
      gsap.to(lastHovered.scale, {
        x: down,
        y: down,
        z: down,
        duration,
        ease: "power2.out",
      });
    }
    if (isScalable) {
      gsap.to(hovered.scale, {
        x: up,
        y: up,
        z: up,
        duration,
        ease: "power2.out",
      });
      lastHovered = hovered;
    } else {
      lastHovered = null;
    }
  }
}
