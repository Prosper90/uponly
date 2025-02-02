uniform vec3 uColor;
uniform sampler2D uMatCapTex;
uniform float uMetalness;    
uniform float uRoughness;    
uniform float uGlossiness;   
uniform float uReflection;   

varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vViewPosition;

void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);
    
    // Enhanced view-dependent UV calculation
    vec2 matCapUV = vec2(normal.x, normal.y) * (1.0 - uRoughness) * 0.95 * 0.5 + 0.5;
    vec3 matCapColor = texture2D(uMatCapTex, matCapUV).xyz;
    
    // Enhanced glossiness with view direction
    float NdotV = max(dot(normal, viewDir), 0.0);
    float glossFactor = pow(NdotV, uGlossiness * 50.0);
    
    // Material mixing with enhanced depth
    vec3 baseColor = mix(uColor, matCapColor, uMetalness);
    vec3 finalColor = mix(baseColor, matCapColor, uReflection);
    
    // Add glossiness highlight with depth enhancement
    finalColor = mix(finalColor, vec3(1.0), glossFactor * (1.0 - uRoughness));
    
    // Subtle depth enhancement
    float depth = (1.0 - NdotV) * 0.2;
    finalColor = mix(finalColor, finalColor * 0.8, depth);

    gl_FragColor = vec4(finalColor, 1.0);
}