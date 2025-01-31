uniform vec3 uColor;
uniform float time;
uniform float uSection[6];

varying vec2 vUv;

#pragma glslify: hsv2rgb = require('./hsv2rgb.glsl' )
#pragma glslify: random = require('./random.glsl' )
#define linearstep(edge0, edge1, x) min(max(((x) - (edge0)) / ((edge1) - (edge0)), 0.0), 1.0)

void main( void ) {
    // Keep only sec1 in the green and yellow range
    float hue = mix(0.15, 0.4, fract(vUv.y * 0.3 + time * 0.05)); // Yellow-green range
    vec3 sec1 = hsv2rgb( vec3(hue, 0.9, 1.0) ); // High saturation, bright
    
    // Other sections remain grayscale or neutral
    vec3 sec2 = vec3( 0.5 );  // Neutral gray
    vec3 sec3 = vec3( 0.3 );  // Darker gray
    vec3 sec4 = vec3( 0.7 );  // Lighter gray
    vec3 sec5 = vec3( smoothstep( 0.0, 1.0, vUv.y ) ); // Simple gradient

    // Subtle fading effect
    vec3 sec6 = vec3(
        exp( - linearstep( 1.0, 0.5, vUv.y + 0.00) * 10.0 ) * 0.5,
        exp( - linearstep( 1.0, 0.5, vUv.y + 0.015) * 10.0 ) * 0.5,
        exp( - linearstep( 1.0, 0.5, vUv.y + 0.03) * 10.0 ) * 0.5
    );

    vec3 color = vec3( 0.0 );
    color = mix( color, sec1, uSection[ 0 ] ); // Only sec1 keeps green and yellow
    color = mix( color, sec2, uSection[ 1 ] );
    color = mix( color, sec3, uSection[ 2 ] );
    color = mix( color, sec4, uSection[ 3 ] );
    color = mix( color, sec5, uSection[ 4 ] );
    color = mix( color, sec6, uSection[ 5 ] );

    gl_FragColor = vec4( color, 1.0 );
}
