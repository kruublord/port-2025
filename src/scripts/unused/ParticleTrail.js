import * as THREE from "three";

const PARTICLE_COUNT = 1000;
const PARTICLE_LIFETIME = 1.0;
const PARTICLE_BASE_SIZE = 0.0075;

const PALETTE = [
  0x6ec5ff, // light sky blue
  0xaecbfa, // pale periwinkle
].map((hex) => new THREE.Color(hex));

export default class ParticleTrail {
  constructor(scene) {
    this.scene = scene;
    this.particleCursor = 0;
    this._tmpColor = new THREE.Color();

    // 1) GEOMETRY + attributes
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const lifetimes = new Float32Array(PARTICLE_COUNT);
    const initialSizes = new Float32Array(PARTICLE_COUNT);
    const colors = new Float32Array(PARTICLE_COUNT * 3); // NEW
    this._paletteIndex = 0; // start at first palette color
    const rotations = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      rotations[i] = Math.random() * Math.PI * 2; // random 0–360°
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const j = i * 3;
      positions[j + 0] = 0;
      positions[j + 1] = 0;
      positions[j + 2] = 0;
      lifetimes[i] = 0.0;
      initialSizes[i] = PARTICLE_BASE_SIZE * (0.5 + Math.random() * 0.5);

      // Seed with something (not super important; real color set at spawn)
      colors[j + 0] = 1.0;
      colors[j + 1] = 1.0;
      colors[j + 2] = 1.0;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aLifetime", new THREE.BufferAttribute(lifetimes, 1));
    geometry.setAttribute(
      "aInitialSize",
      new THREE.BufferAttribute(initialSizes, 1)
    );
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3)); // NEW
    geometry.setAttribute("aRotation", new THREE.BufferAttribute(rotations, 1));

    this.geometry = geometry;

    // --- load sprite ---
    const tex = new THREE.TextureLoader().load("/images/sparkle.png"); // public/sprites/star.png
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearMipMapLinearFilter;
    tex.magFilter = THREE.LinearFilter;

    // --- material with texture ---
    const material = new THREE.PointsMaterial({
      size: 12, // make it visible; tweak as you like
      map: tex, // << sprite shape here
      transparent: true, // we fade alpha in the shader
      depthWrite: false,
      vertexColors: true, // tint by per-particle color
      blending: THREE.NormalBlending,
      // alphaTest: 0.1,        // OPTIONAL: faster cutout edges, but removes soft fade
    });
    material.toneMapped = false;

    // keep your shader edits
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = `
        attribute float aLifetime;
        attribute float aInitialSize;
        attribute float aRotation;
        varying float vLifetime;
        varying float vRotation;
        ${shader.vertexShader}
    `;

      shader.fragmentShader = `
        varying float vLifetime;
        varying float vRotation;
        ${shader.fragmentShader}
    `;

      // Store lifetime & rotation, and keep your scaling logic
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <begin_vertex>",
          `
        #include <begin_vertex>
        vLifetime = aLifetime;
        vRotation = aRotation;
        `
        )
        .replace(
          "gl_PointSize = size;",
          `
        // Drive size by lifetime + perspective
        gl_PointSize = aInitialSize * (vLifetime / ${PARTICLE_LIFETIME.toFixed(2)});
        #ifdef USE_SIZEATTENUATION
            gl_PointSize *= ( scale / - mvPosition.z );
        #endif
        `
        );

      // Inject rotation into particle texture sampling
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_particle_fragment>",
        `
        // Rotate UV coords for sparkle
        vec2 centeredUV = gl_PointCoord - 0.5;
        float s = sin(vRotation);
        float c = cos(vRotation);
        mat2 rotationMatrix = mat2(c, -s, s, c);
        centeredUV = rotationMatrix * centeredUV;
        vec2 rotatedUV = centeredUV + 0.5;

        vec4 texColor = texture2D(map, rotatedUV);
        diffuseColor *= texColor;
        `
      );

      // Lifetime alpha fade
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <color_fragment>",
        `
        #include <color_fragment>
        float progress = vLifetime / ${PARTICLE_LIFETIME.toFixed(2)};
        diffuseColor.a *= smoothstep(0.0, 0.1, progress) * (1.0 - smoothstep(0.7, 1.0, progress));
        if (diffuseColor.a < 0.003) discard;
        `
      );
    };

    // 3) POINTS
    this.points = new THREE.Points(geometry, material);
    this.scene.add(this.points);
  }

  spawnParticle(position) {
    const i = this.particleCursor;

    // position + lifetime
    this.geometry.attributes.position.setXYZ(
      i,
      position.x,
      position.y,
      position.z
    );
    this.geometry.attributes.aLifetime.setX(i, PARTICLE_LIFETIME);
    this.geometry.attributes.aRotation.setX(i, Math.random() * Math.PI * 2); // new random rotation
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.aLifetime.needsUpdate = true;
    this.geometry.attributes.aRotation.needsUpdate = true;

    // color
    const c = PALETTE[this._paletteIndex];
    this._paletteIndex = (this._paletteIndex + 1) % PALETTE.length;
    this.geometry.attributes.color.setXYZ(i, c.r, c.g, c.b);
    this.geometry.attributes.color.needsUpdate = true;

    this.particleCursor = (i + 1) % PARTICLE_COUNT;
  }

  update(deltaTime) {
    const lifetimes = this.geometry.attributes.aLifetime;
    let needsUpdate = false;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const t = lifetimes.getX(i);
      if (t > 0) {
        lifetimes.setX(i, t - deltaTime);
        needsUpdate = true;
      }
    }

    if (needsUpdate) lifetimes.needsUpdate = true;
  }
}
