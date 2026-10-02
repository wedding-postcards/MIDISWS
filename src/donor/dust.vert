attribute vec3 velocity;
attribute float phase;
attribute float sizeScale;

uniform float uSize;
uniform float uSizeVariation;
uniform float uTime;
uniform float uSpeed;
uniform float uTurbulence;
uniform float uBlinkSpeed;
uniform float uBlinkMin;
uniform sampler2D tNoise;

varying float vAlpha;

float sampleNoise(vec2 uv) {
  return texture2D(tNoise, uv).r * 2.0 - 1.0;
}

void main() {
  vec3 animatedPos = position + velocity * uTime * uSpeed * 0.01;
  animatedPos = fract(animatedPos * 0.5 + 0.5) * 2.0 - 1.0;

  if (uTurbulence > 0.0) {
    vec3 noisePos = position * 2.0 + uTime * 0.1;
    animatedPos.x += sampleNoise(noisePos.xy * 0.125) * uTurbulence * 0.1;
    animatedPos.y += sampleNoise(noisePos.yz * 0.125) * uTurbulence * 0.1;
    animatedPos.z += sampleNoise(noisePos.zx * 0.125) * uTurbulence * 0.1;
  }

  vec4 mvPosition = modelViewMatrix * vec4(animatedPos, 1.0);
  
  float variationScale = mix(1.0, sizeScale, uSizeVariation);
  gl_PointSize = uSize * variationScale * (200.0 / -mvPosition.z);

  float blinkWave = sin(uTime * uBlinkSpeed + phase) * 0.5 + 0.5;
  float blink = uBlinkSpeed > 0.0 ? uBlinkMin + (1.0 - uBlinkMin) * blinkWave : 1.0;

  vAlpha = blink;

  gl_Position = projectionMatrix * mvPosition;
}
