import * as THREE from "three";
import gsap from "gsap";
import {
  themeVertexShader,
  themeFragmentShader,
} from "./shaders/themeShader.js";

class ThemeManager {
  constructor() {
    if (typeof window !== "undefined" && ThemeManager._instance) {
      return ThemeManager._instance;
    }

    ThemeManager._instance = this;
    // Initialize state
    this.isDarkMode = false;
    this.uMixRatio = { value: 0 };
    this.themeToggle = document.getElementById("theme-toggle");
    this.body = document.body;

    // Store themed meshes that need updating
    this.themedMeshes = [];

    // Initialize event listeners
    this.initEventListeners();
  }

  initEventListeners() {
    // Theme toggle functionality with GSAP animation
    this.themeToggle.addEventListener("click", () => {
      this.toggleTheme();
    });
  }

  toggleTheme() {
    this.isDarkMode = !this.isDarkMode;

    // Update UI
    this.themeToggle.innerHTML = this.isDarkMode
      ? '<i class="fas fa-moon"></i>'
      : '<i class="fas fa-sun"></i>';

    this.body.classList.toggle("dark-theme", this.isDarkMode);
    this.body.classList.toggle("light-theme", !this.isDarkMode);

    this.updateThreeJSTheme();
  }

  updateThreeJSTheme() {
    // Animate uMixRatio for shader blending
    gsap.to(this.uMixRatio, {
      value: this.isDarkMode ? 1 : 0,
      duration: 1.5,
      ease: "power2.inOut",
    });
  }

  getTextureKeyFromName(meshName) {
    if (meshName.includes("-one")) return "one";
    if (meshName.includes("-two")) return "two";
    if (meshName.includes("-three")) return "three";
    if (meshName.includes("-four")) return "four";
    if (meshName.includes("-five")) return "five";
    if (meshName.includes("-six")) return "six";
    if (meshName.includes("-seven")) return "seven";
    if (meshName.includes("-eight")) return "eight";
    if (meshName.includes("-nine")) return "nine";
    if (meshName.includes("-ten")) return "ten";
    if (meshName.includes("-eleven")) return "eleven";
    if (meshName.includes("-twelve")) return "twelve";
    if (meshName.includes("-emissive")) return "emissive";

    return null;
  }

  loadTexture(textureLoader, path) {
    const tex = textureLoader.load(path);
    tex.flipY = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }

  // Assumes files live under: public/textures/webp-compresed/{day,night}/...
  // e.g. /textures/webp-compresed/day/Day-Texture1.webp

  loadAllTextures(textureLoader) {
    const BASE = "/textures/webp-compresed";

    // Keep your existing keys ("one"..."ten") so getTextureKeyFromName() still works.
    const textureMap = {
      one: {
        day: `${BASE}/day/Day-Texture1.webp`,
        night: `${BASE}/night/Night-Texture-1.webp`,
      },
      two: {
        day: `${BASE}/day/Day-Texture2.webp`,
        night: `${BASE}/night/Night-Texture-2.webp`,
      },
      three: {
        day: `${BASE}/day/Day-Texture3.webp`,
        night: `${BASE}/night/Night-Texture-3.webp`,
      },
      four: {
        day: `${BASE}/day/Day-Texture4.webp`,
        night: `${BASE}/night/Night-Texture-4.webp`,
      },
      five: {
        day: `${BASE}/day/Day-Texture5.webp`,
        night: `${BASE}/night/Night-Texture-5.webp`,
      },
      six: {
        day: `${BASE}/day/Day-Texture6.webp`,
        night: `${BASE}/night/Night-Texture-6.webp`,
      },
      seven: {
        day: `${BASE}/day/Day-Texture7.webp`,
        night: `${BASE}/night/Night-Texture-7.webp`,
      },
      eight: {
        day: `${BASE}/day/Day-Texture8.webp`,
        night: `${BASE}/night/Night-Texture-8.webp`,
      },
      nine: {
        day: `${BASE}/day/Day-Texture9.webp`,
        night: `${BASE}/night/Night-Texture-9.webp`,
      },
      ten: {
        day: `${BASE}/day/Day-Texture10.webp`,
        night: `${BASE}/night/Night-Texture-10.webp`,
      },

      // New emissive names
      emissive: {
        day: `${BASE}/day/Day-Texture-Emissive.webp`,
        night: `${BASE}/night/Night-Texture-Emissive.webp`,
      },
    };

    const loadedTextures = { day: {}, night: {} };

    Object.entries(textureMap).forEach(([key, paths]) => {
      loadedTextures.day[key] = this.loadTexture(textureLoader, paths.day);
      loadedTextures.night[key] = this.loadTexture(textureLoader, paths.night);
    });

    return { textureMap, loadedTextures };
  }

  // Your processThemedMesh stays the same.

  processThemedMesh(child, loadedTextures) {
    const textureKey = this.getTextureKeyFromName(child.name);

    if (textureKey) {
      const material = new THREE.ShaderMaterial({
        uniforms: {
          uDayTexture: { value: loadedTextures.day[textureKey] },
          uNightTexture: { value: loadedTextures.night[textureKey] },
          uMixRatio: this.uMixRatio, // shared reference
        },
        vertexShader: themeVertexShader,
        fragmentShader: themeFragmentShader,
      });

      // Clone the material so it's independent
      child.material = material;
      this.themedMeshes.push(child);

      return true;
    }

    return false;
  }

  loadGlassEnvironmentMap(
    path = "textures/skybox/",
    files = ["px.webp", "nx.webp", "py.webp", "ny.webp", "pz.webp", "nz.webp"]
  ) {
    const loader = new THREE.CubeTextureLoader().setPath(path);
    const cubeMap = loader.load(files);

    cubeMap.colorSpace = THREE.SRGBColorSpace;
    cubeMap.magFilter = THREE.LinearFilter;
    cubeMap.minFilter = THREE.LinearMipmapLinearFilter;
    cubeMap.generateMipmaps = true;
    cubeMap.needsUpdate = true;

    return cubeMap;
  }

  createGlassMaterial() {
    const glassEnvMap = this.loadGlassEnvironmentMap();

    return new THREE.MeshPhysicalMaterial({
      transmission: 1,
      opacity: 1,
      metalness: 0,
      roughness: 0,
      ior: 1.5,
      thickness: 0.01,
      specularIntensity: 1,
      envMap: glassEnvMap,
      envMapIntensity: 1,
    });
  }

  processGlassMesh(child) {
    if (child.name.includes("glass")) {
      child.material = this.createGlassMaterial();
      return true;
    }
    return false;
  }
}

const themeManagerInstance = new ThemeManager();
export default themeManagerInstance;
