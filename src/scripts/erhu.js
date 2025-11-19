import * as THREE from "three";
import audioManager from "./audio.js";

/**
 * Music Note Particle System for Erhu
 */
class MusicNoteParticles {
  constructor(scene, erhuPosition, showDebug = false) {
    this.scene = scene;
    this.erhuPosition = erhuPosition.clone();
    this.particles = [];
    this.isActive = false;
    this.spawnTimer = 0;
    this.spawnInterval = 0.35; // was 0.5 – emit more often
    this.showDebug = showDebug;
    this.debugHelper = null;

    this.spawnRadius = 0.18; // ~radius around the base (tweak to taste)

    if (this.showDebug) {
      this.createDebugHelper();
    }
  }

  createDebugHelper() {
    // Create a sphere at spawn location
    const geometry = new THREE.SphereGeometry(0.1, 16, 16);
    const material = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      wireframe: true,
      transparent: true,
      opacity: 0.5,
    });
    this.debugHelper = new THREE.Mesh(geometry, material);
    this.debugHelper.position.copy(this.erhuPosition);
    this.scene.add(this.debugHelper);

    console.log("Particle spawn location:", this.debugHelper.position);
  }

  start() {
    this.isActive = true;
  }

  stop() {
    this.isActive = false;
  }

  update(deltaTime) {
    // Spawn new particles
    if (this.isActive) {
      this.spawnTimer += deltaTime;
      if (this.spawnTimer >= this.spawnInterval) {
        this.spawnParticle();
        this.spawnTimer = 0;
      }
    }

    // Update existing particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];

      // Move upward with drift
      particle.sprite.position.y += particle.velocity.y * deltaTime;
      particle.sprite.position.x += particle.velocity.x * deltaTime;
      particle.sprite.position.z += particle.velocity.z * deltaTime;

      // Fade out
      particle.life += deltaTime;
      const t = particle.life / particle.maxLife; // 0 → 1 over lifetime

      // Fade in first 25%, stay solid, then fade out last 30%
      let opacity;
      const fadeInEnd = 0.25;
      const fadeOutStart = 0.7;

      if (t < fadeInEnd) {
        // 0 → 1
        opacity = t / fadeInEnd;
      } else if (t < fadeOutStart) {
        // solid
        opacity = 1.0;
      } else {
        // 1 → 0
        opacity = 1.0 - (t - fadeOutStart) / (1.0 - fadeOutStart);
      }

      particle.sprite.material.opacity = THREE.MathUtils.clamp(opacity, 0, 1);

      // Gentle oscillating rotation (doesn't flip all the way)
      const oscillation = Math.sin(particle.life * 3) * 0.1; // smaller wiggle
      particle.sprite.material.rotation =
        particle.initialRotation + oscillation;

      // Remove dead particles
      if (particle.life >= particle.maxLife) {
        this.scene.remove(particle.sprite);
        particle.sprite.material.map.dispose();
        particle.sprite.material.dispose();
        this.particles.splice(i, 1);
      }
    }
  }

  spawnParticle() {
    // Create note texture
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");

    // Beautiful gradient color (teal/cyan to purple)
    const gradient = ctx.createLinearGradient(0, 0, 64, 64);
    gradient.addColorStop(0, "#4FD1C5"); // Teal
    gradient.addColorStop(0.5, "#667EEA"); // Purple
    gradient.addColorStop(1, "#F687B3"); // Pink

    ctx.fillStyle = gradient;
    ctx.font = "bold 48px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const notes = ["♪", "♫", "♬"];
    const note = notes[Math.floor(Math.random() * notes.length)];
    ctx.fillText(note, 32, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0.0, // start invisible
      depthWrite: false,
      depthTest: false,
      renderOrder: 999,
    });

    const sprite = new THREE.Sprite(material);

    // Position near erhu with slight random offset
    // Start ABOVE the erhu to avoid spawning inside shelf
    sprite.position.copy(this.erhuPosition);
    sprite.position.x += (Math.random() - 0.5) * 0.2;
    sprite.position.y += Math.random() * 0.2; // tiny vertical jitter only
    sprite.position.z += (Math.random() - 0.5) * 0.2;

    // Random scale
    const scale = 0.3 + Math.random() * 0.15;
    sprite.scale.set(scale, scale, scale);

    this.scene.add(sprite);

    // Particle data
    const particle = {
      sprite: sprite,
      velocity: {
        x: (Math.random() - 0.5) * 0.2,
        y: 0.8 + Math.random() * 0.4,
        z: (Math.random() - 0.5) * 0.2,
      },
      life: 0,
      maxLife: 3.5 + Math.random() * 1.0, // 3.5–4.5 s instead of 2.5–3 s
      rotationSpeed: (Math.random() - 0.5) * 0.8, // Gentler rotation
      initialRotation: (Math.random() - 0.5) * 0.3, // about -0.15 to +0.15 rad (~±9°)
    };

    // Set initial rotation
    particle.sprite.material.rotation = particle.initialRotation;

    this.particles.push(particle);
  }

  cleanup() {
    // Remove all particles
    for (const particle of this.particles) {
      this.scene.remove(particle.sprite);
      particle.sprite.material.map.dispose();
      particle.sprite.material.dispose();
    }
    this.particles = [];

    // Remove debug helper
    if (this.debugHelper) {
      this.scene.remove(this.debugHelper);
      this.debugHelper.geometry.dispose();
      this.debugHelper.material.dispose();
      this.debugHelper = null;
    }
  }
}

/**
 * Erhu Interaction Manager
 * Handles hover audio/particles and integrates with RaycasterController
 */
export class ErhuInteraction {
  constructor(scene, erhuMesh, showDebug = false) {
    this.scene = scene;
    this.erhuMesh = erhuMesh;
    this.isHovering = false;
    this.showDebug = showDebug;

    // Get erhu world position for particles
    const erhuWorldPos = new THREE.Vector3();
    this.erhuMesh.getWorldPosition(erhuWorldPos);
    erhuWorldPos.y += 0.5;
    // Create particle system with debug option

    if (showDebug) {
      console.log("Erhu world position:", erhuWorldPos);
    }

    // Create particle system with debug option
    this.particles = new MusicNoteParticles(scene, erhuWorldPos, showDebug);

    // Store original emissive for glow effect
    this.originalEmissive = null;
    this.originalEmissiveIntensity = 1.0;

    // Try to get emissive from material
    if (this.erhuMesh.material) {
      if (this.erhuMesh.material.emissive) {
        this.originalEmissive = this.erhuMesh.material.emissive.clone();
        this.originalEmissiveIntensity =
          this.erhuMesh.material.emissiveIntensity || 1.0;
      }
    }
  }

  /**
   * Call this when hover starts (from RaycasterController)
   */
  onHoverStart() {
    if (this.isHovering) return; // Already hovering

    this.isHovering = true;

    // Start audio
    audioManager.playErhu(0.3, 300);

    // Start particles
    this.particles.start();

    // Add glow effect
    if (this.erhuMesh.material && this.erhuMesh.material.emissive) {
      this.erhuMesh.material.emissive.setHex(0x442200); // Warm glow
      this.erhuMesh.material.emissiveIntensity = 0.5;
    }
  }

  /**
   * Call this when hover ends (from RaycasterController)
   */
  onHoverEnd() {
    if (!this.isHovering) return; // Not hovering

    this.isHovering = false;

    // Stop audio
    audioManager.stopErhu(300);

    // Stop spawning particles
    this.particles.stop();

    // Remove glow
    if (
      this.erhuMesh.material &&
      this.erhuMesh.material.emissive &&
      this.originalEmissive
    ) {
      this.erhuMesh.material.emissive.copy(this.originalEmissive);
      this.erhuMesh.material.emissiveIntensity = this.originalEmissiveIntensity;
    }
  }

  /**
   * Call this in your animation loop
   */
  update(deltaTime) {
    this.particles.update(deltaTime);
  }

  /**
   * Check if an object is the erhu (for RaycasterController integration)
   */
  isErhuObject(object) {
    if (!object) return false;

    // Check if it's the erhu mesh itself
    if (object === this.erhuMesh) return true;

    // Check if it's a child of the erhu
    let current = object;
    while (current) {
      if (current === this.erhuMesh) return true;
      current = current.parent;
    }

    return false;
  }

  /**
   * Cleanup
   */
  dispose() {
    this.particles.cleanup();
    this.onHoverEnd(); // Make sure audio stops
  }
}

export default ErhuInteraction;
