uniform sampler2D tMudNormal;
uniform sampler2D tNoise;
uniform float uPosition; // -1 = fully out, 0 = fully covering, 1 = fully out (other side)
uniform float uTime;
uniform vec3 uColor;
uniform vec2 uResolution;

// Sample pre-computed noise texture (normalized to [-1, 1])
float sampleNoise(vec2 uv) {
  return texture(tNoise, uv).r * 2.0 - 1.0;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  // Early out if overlay is fully off-screen (|position| >= 1)
  if (abs(uPosition) >= 1.0) {
    outputColor = inputColor;
    return;
  }

  // Mud texture for organic variation
  vec3 mudNormal = texture(tMudNormal, uv * 2.0).rgb;
  float mudOffset = (mudNormal.r - 0.5) * mix(0.3, 0.6, 0.5 + 0.5 * sin(uTime - uv.x * 10.0)) * 0.1;

  // Noise (sampled from pre-computed texture)
  float aspect = uResolution.x / uResolution.y;
  vec2 aspectUv = vec2(uv.x * aspect, uv.y) + vec2(0.0, uTime * 0.02);
  float noiseValue = sampleNoise(aspectUv * 0.375 - uTime * 0.00625);

  // Diagonal/curved wipe pattern
  float threshold = mix(uv.y, uv.x, smoothstep(0.6, -0.4, abs(uv.x - 0.4)) * 0.5);
  threshold = threshold * 2.0 - 1.0;
  threshold = threshold / 1.2 + noiseValue * 0.2 + mudOffset;
  threshold = threshold * 0.5 + 0.5;

  // Map position from -1 to 1 range:
  // -1 = wipe coming in (progress 0), 0 = fully visible (progress 1), 1 = wipe going out (progress 0 reversed)
  float progress;
  float thresholdFinal = threshold;
  if (uPosition <= 0.0) {
    // -1 to 0: wipe in (progress goes from 0 to 1)
    progress = uPosition + 1.0;
  } else {
    // 0 to 1: wipe out (progress goes from 1 to 0, with reversed threshold)
    progress = 1.0 - uPosition;
    thresholdFinal = 1.0 - threshold;
  }

  // Sharp edge transition
  float edge = progress - thresholdFinal;
  float aa = fwidth(edge) * 10.0;
  float alpha = smoothstep(-aa, aa, edge);

  // Glow at edge
  float glowFactor = smoothstep(0.0, 0.005, abs(edge));
  vec3 color = pow(uColor, vec3(2.2));
  color = mix(color, color * mix(2.0, 4.0, 0.5 + 0.5 * sin(uTime + uv.x * 10.0)), 1.0 - glowFactor);

  outputColor = vec4(mix(inputColor.rgb, color, alpha), 1.0);
}

