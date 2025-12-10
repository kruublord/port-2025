const rotatingObjects = {
  xAxis: [],
  yAxis: [],
  zAxis: [],
  globe: [],
};

let fanRotationSpeed = 0.05;
let globeRotationSpeed = 0.005;

/**
 * Process mesh to determine if it's a rotating object
 * @param {THREE.Mesh} mesh - The mesh to process
 */
function processRotatingObject(mesh) {
  if (mesh.name.includes("globe-six")) {
    rotatingObjects.globe.push(mesh);
    return;
  }

  if (!mesh.name.includes("fan")) return;

  // Sort fans by rotation axis
  if (mesh.name.includes("animateX")) {
    rotatingObjects.xAxis.push(mesh);
  } else if (mesh.name.includes("animateY")) {
    rotatingObjects.yAxis.push(mesh);
  } else if (mesh.name.includes("animateZ")) {
    rotatingObjects.zAxis.push(mesh);
  }
}

/**
 * Update all rotating objects
 */
function updateRotatingObjects() {
  rotatingObjects.xAxis.forEach((fan) => {
    fan.rotation.x -= fanRotationSpeed;
  });
  rotatingObjects.yAxis.forEach((fan) => {
    fan.rotation.y -= fanRotationSpeed;
  });
  rotatingObjects.zAxis.forEach((fan) => {
    fan.rotation.z -= fanRotationSpeed;
  });

  rotatingObjects.globe.forEach((globe) => {
    globe.rotation.y += globeRotationSpeed;
  });
}

export { processRotatingObject, updateRotatingObjects };
