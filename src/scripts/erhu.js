import * as THREE from "three";
import audioManager from "./audio.js";

/**
 * Music Note Particle System for Erhu
 */
class MusicNoteParticles {
  constructor(scene, erhuPosition) {
    this.scene = scene;
    this.erhuPosition = erhuPosition.clone();
    this.particles = [];
    this.isActive = false;
    this.spawnTimer = 0;
    this.spawnInterval = 0.15; // Spawn a note every 0.15 seconds
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
      const fadeProgress = particle.life / particle.maxLife;
      particle.sprite.material.opacity = 1.0 - fadeProgress;

      // Slight rotation
      particle.sprite.material.rotation += deltaTime * 2;

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

    ctx.fillStyle = "#FFD700"; // Gold color
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
      opacity: 1.0,
      depthWrite: false,
    });

    const sprite = new THREE.Sprite(material);

    // Position near erhu with slight random offset
    sprite.position.copy(this.erhuPosition);
    sprite.position.x += (Math.random() - 0.5) * 0.3;
    sprite.position.y += (Math.random() - 0.5) * 0.2;
    sprite.position.z += (Math.random() - 0.5) * 0.3;

    // Random scale
    const scale = 0.2 + Math.random() * 0.15;
    sprite.scale.set(scale, scale, scale);

    this.scene.add(sprite);

    // Particle data
    const particle = {
      sprite: sprite,
      velocity: {
        x: (Math.random() - 0.5) * 0.3,
        y: 0.5 + Math.random() * 0.3, // Upward
        z: (Math.random() - 0.5) * 0.3,
      },
      life: 0,
      maxLife: 2.0 + Math.random() * 1.0, // 2-3 seconds
    };

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
  }
}

/**
 * Erhu Interaction Manager
 * Handles hover audio/particles and integrates with RaycasterController
 */
export class ErhuInteraction {
  constructor(scene, erhuMesh) {
    this.scene = scene;
    this.erhuMesh = erhuMesh;
    this.isHovering = false;

    // Get erhu world position for particles
    const erhuWorldPos = new THREE.Vector3();
    this.erhuMesh.getWorldPosition(erhuWorldPos);

    // Create particle system
    this.particles = new MusicNoteParticles(scene, erhuWorldPos);

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
