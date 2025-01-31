uniform vec3 uColor;
uniform sampler2D uMatCapTex;
uniform float uMetalness;    // New: control metallic look
uniform float uRoughness;    // New: control surface smoothness
uniform float uGlossiness;   // New: control shininess
uniform float uReflection;   // New: control reflection strength

varying vec3 vNormal;
varying vec2 vUv;

void main(void) {
    vec3 normal = normalize(vNormal);
    
    // Adjust UV calculation with roughness
    vec2 matCapUV = vec2(normal.x, normal.y) * (1.0 - uRoughness) * 0.95 * 0.5 + 0.5;
    vec3 matCapColor = texture2D(uMatCapTex, matCapUV).xyz;
    
    // Add glossiness effect
    float glossFactor = pow(max(normal.z, 0.0), uGlossiness * 50.0);
    
    // Mix between base color and MatCap based on metalness and reflection
    vec3 baseColor = mix(uColor, matCapColor, uMetalness);
    vec3 finalColor = mix(baseColor, matCapColor, uReflection);
    
    // Add glossiness highlight
    finalColor = mix(finalColor, vec3(1.0), glossFactor);

    gl_FragColor = vec4(finalColor, 1.0);
}