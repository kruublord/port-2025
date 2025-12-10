import gsap from "gsap";
import * as THREE from "three";

// Debounce set to prevent rapid re-triggers
const cooldownSet = new Set();

const SPIN_DURATION = 2; // seconds
const SPIN_AMOUNT = Math.PI * 2; // one full turn
const COOLDOWN_DURATION = 2; // seconds

// Load the custom sparkle texture
const textureLoader = new THREE.TextureLoader();
const sparkleTexture = textureLoader.load("/images/sparkle.png");

/* ------------------------------------------------------------------ */
/*  Sparkle helper                                                    */
/* ------------------------------------------------------------------ */
function addSparkleEffect(object, options = {}) {
  // Default configuration
  const config = {
    particleCount: 20,
    particleSize: 0.4,
    particleSizeVariation: { min: 0.2, max: 0.5 },
    offsetY: 0,
    spread: 1.0,
    duration: 3.0,
    ...options,
  };

  // Create particle system
  const particleCount = config.particleCount;
  const particles = new THREE.BufferGeometry();

  // Particle attributes
  const positions = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);
  const colors = new Float32Array(particleCount * 3);
  const opacities = new Float32Array(particleCount);
  const velocities = [];
  const lifetimes = [];

  // Object center position with Y offset
  const centerPos = {
    x: object.position.x,
    y: object.position.y + config.offsetY,
    z: object.position.z,
  };

  // Set initial position for particles
  for (let i = 0; i < particleCount; i++) {
    // Random position around the object
    const angle = Math.random() * Math.PI * 2;
    const radius = object.scale.x * 0.5 * config.spread;

    // Position with offset
    positions[i * 3] =
      centerPos.x + Math.cos(angle) * radius * (Math.random() * 0.5);
    positions[i * 3 + 1] = centerPos.y + (Math.random() - 0.3) * radius * 0.5; // slight upward bias
    positions[i * 3 + 2] =
      centerPos.z + Math.sin(angle) * radius * (Math.random() * 0.5);

    // Random size within range
    sizes[i] =
      config.particleSizeVariation.min +
      Math.random() *
        (config.particleSizeVariation.max - config.particleSizeVariation.min);

    // Initial opacity
    opacities[i] = 0;

    // Slight color variation – mostly white/yellow to preserve texture colors
    colors[i * 3] = 1; // R
    colors[i * 3 + 1] = 0.9 + Math.random() * 0.1; // G
    colors[i * 3 + 2] = 0.8 + Math.random() * 0.2; // B

    // Velocity with upward bias
    velocities.push({
      x: Math.cos(angle) * (0.2 + Math.random() * 0.3),
      y: Math.random() * 0.5 * 0.8,
      z: Math.sin(angle) * (0.2 + Math.random() * 0.3),
    });

    // Lifetime
    lifetimes.push(1.5 + Math.random() * 1.5);
  }

  particles.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  particles.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
  particles.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  // Particle material
  const material = new THREE.PointsMaterial({
    size: config.particleSize,
    map: sparkleTexture,
    transparent: true,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 1.0,
  });

  // Create and add particle system
  const particleSystem = new THREE.Points(particles, material);
  object.parent.add(particleSystem);

  // Animation loop
  const clock = new THREE.Clock();
  let elapsed = 0;
  const duration = config.duration;

  function updateParticles() {
    const delta = clock.getDelta();
    elapsed += delta;

    if (elapsed > duration) {
      object.parent.remove(particleSystem); // clean-up
      return;
    }

    const positionAttr = particles.attributes.position;
    const sizeAttr = particles.attributes.size;

    // Update each particle
    for (let i = 0; i < particleCount; i++) {
      // Apply velocity
      positionAttr.array[i * 3] += velocities[i].x * delta;
      positionAttr.array[i * 3 + 1] += velocities[i].y * delta;
      positionAttr.array[i * 3 + 2] += velocities[i].z * delta;

      // Life progress 0–1
      const particleLife = Math.min(elapsed / lifetimes[i], 1.0);

      // Size / opacity transitions
      if (particleLife < 0.3) {
        // Fade-in
        sizeAttr.array[i] = sizes[i] * (particleLife / 0.3);
        opacities[i] = particleLife / 0.3;
      } else if (particleLife > 0.7) {
        // Fade-out
        const fade = (particleLife - 0.7) / 0.3;
        sizeAttr.array[i] = sizes[i] * (1 - fade * 0.5);
        opacities[i] = 1 - fade;
      } else {
        // Fully visible
        sizeAttr.array[i] = sizes[i];
        opacities[i] = 1.0;
      }

      // Gravity
      velocities[i].y -= 0.1 * delta;
    }

    // Material opacity = avg particle opacity
    let totalOpacity = 0;
    for (let i = 0; i < particleCount; i++) totalOpacity += opacities[i];
    material.opacity =
      totalOpacity > 0 ? Math.min(1.0, (totalOpacity / particleCount) * 2) : 0;

    positionAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;

    requestAnimationFrame(updateParticles);
  }

  updateParticles();
}

/* ------------------------------------------------------------------ */
/*  Sparkle preset selector                                           */
/* ------------------------------------------------------------------ */
function getObjectSparkleOptions(object) {
  const name = object.name.toLowerCase();

  if (name.includes("globe")) {
    return {
      particleSize: 0.4,
      particleSizeVariation: { min: 0.2, max: 0.5 },
      offsetY: 0,
      spread: 1.0,
    };
  }

  if (name.includes("chair")) {
    return {
      particleCount: 12,
      particleSize: 0.8,
      particleSizeVariation: { min: 0.4, max: 0.8 },
      offsetY: 0.4,
      spread: 2,
    };
  }

  // default
  return {};
}

/* ------------------------------------------------------------------ */
/*  Spin animation                                                    */
/* ------------------------------------------------------------------ */
export function spinAnimation(object) {
  // Prevent spam-clicks
  if (cooldownSet.has(object)) return false;
  cooldownSet.add(object);
  gsap.delayedCall(COOLDOWN_DURATION, () => cooldownSet.delete(object));

  // Target rotation
  const newRotation = object.rotation.y + SPIN_AMOUNT;

  // Emit sparkles every spin
  addSparkleEffect(object, getObjectSparkleOptions(object));

  // Tiny squash-and-stretch, then spin
  gsap.to(object.scale, {
    x: 1,
    y: 1,
    z: 1,
    duration: 0.2,
    onComplete: () => {
      gsap.to(object.rotation, {
        y: newRotation,
        duration: SPIN_DURATION,
        ease: "power2.out",
      });

      // pop scale
      gsap.to(object.scale, {
        x: 1.1,
        y: 1.1,
        z: 1.1,
        duration: 0.2,
        yoyo: true,
        repeat: 1,
      });
    },
  });

  return true;
}
