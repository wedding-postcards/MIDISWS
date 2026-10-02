uniform vec3 uColor;
uniform float uOpacity;
uniform float uBlur;

varying float vAlpha;

void main() {
  vec2 center = gl_PointCoord * 2. - 1.;
  float dist = 1. - min(1., length(center));
  float blur = 1. - pow(uBlur, 2.); // Invert blur to match previous theatrejs setup
  float alphaFalloff = smoothstep(0.0, blur, dist);
  gl_FragColor = vec4(uColor, uOpacity * alphaFalloff * vAlpha);
}
