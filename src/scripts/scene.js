import * as THREE from "three";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export function initThreeJS(canvas, sizes) {
  // 1) Loading managers + loaders
  const loadingManager = new THREE.LoadingManager();
  const textureLoader = new THREE.TextureLoader(loadingManager);

  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath("/draco/");

  const gltfLoader = new GLTFLoader(loadingManager);
  gltfLoader.setDRACOLoader(dracoLoader);

  // 2) Scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe8e8e8);
  const pointer = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();

  // 3) Camera
  const camera = new THREE.PerspectiveCamera(
    35,
    sizes.width / sizes.height,
    0.1,
    1000
  );

  // 4) Renderer
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(sizes.width, sizes.height);

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.domElement.style.position = "absolute";
  renderer.domElement.style.top = 0;
  renderer.domElement.style.left = 0;
  renderer.domElement.style.zIndex = 1; // WebGL ABOVE
  return {
    scene,
    camera,
    renderer,
    pointer,
    raycaster,
    loadingManager,
    textureLoader,
    gltfLoader,
  };
}
