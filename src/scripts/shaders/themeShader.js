export const themeVertexShader = `
  varying vec2 vUv;

  #include <skinning_pars_vertex>

  void main() {
    vUv = uv;

    vec3 transformed = position;

    #include <skinbase_vertex>
    #include <skinning_vertex>

    gl_Position = projectionMatrix * modelViewMatrix * vec4( transformed, 1.0 );
  }
`;

export const themeFragmentShader = `
  uniform sampler2D uDayTexture;
  uniform sampler2D uNightTexture;
  uniform float uMixRatio;

  varying vec2 vUv;

  void main() {
    vec4 dayColor = texture2D(uDayTexture, vUv);
    vec4 nightColor = texture2D(uNightTexture, vUv);

    // Simple blend in texture space
    gl_FragColor = mix(dayColor, nightColor, uMixRatio);
  }
`;
