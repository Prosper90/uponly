precision mediump float;

uniform float num; // Existing uniform
uniform float uVisibility; // Visibility control

void main() {
    float t = num; // Assuming 'num' is used for gradient interpolation

    // Interpolate between green (0,1,0) and yellow (1,1,0)
    vec3 color = mix(vec3(0.0, 1.0, 0.0), vec3(1.0, 1.0, 0.0), t);

    gl_FragColor = vec4(color, uVisibility);
}