/*！
 * based on https://github.com/mattdesl/webgl-wireframes
 * @License MIT
*/
precision mediump float;
varying vec3 vBarycentric;
uniform float time;
uniform float thickness;
uniform float secondThickness;

uniform float dashRepeats;
uniform float dashLength;
uniform bool dashOverlap;
uniform bool dashEnabled;
uniform bool dashAnimate;

uniform bool seeThrough;
uniform bool insideAltColor;
uniform bool dualStroke;

uniform bool squeeze;
uniform float squeezeMin;
uniform float squeezeMax;

uniform vec4 stroke;
uniform vec4 fill;
uniform float opacity;

#ifdef HAS_INSTANCE
  varying vec4 vInstanceColor;
#endif
#extension GL_OES_standard_derivatives : enable

#include <viewshed_frag>
#include <flood_frag>
#include <fog_render_frag>
const float PI = 3.14159265;

// This is like
float aastep (float threshold, float dist) {
  float afwidth = fwidth(dist) * 0.5;
  return smoothstep(threshold - afwidth, threshold + afwidth, dist);
}

// This function returns the fragment color for our styled wireframe effect
// based on the barycentric coordinates for this fragment
vec4 getStyledWireframe (vec3 barycentric) {
  // this will be our signed distance for the wireframe edge
  float d = min(min(barycentric.x, barycentric.y), barycentric.z);
  // for dashed rendering, we can use this to get the 0 .. 1 value of the line length
  float positionAlong = max(barycentric.x, barycentric.y);
  if (barycentric.y < barycentric.x && barycentric.y < barycentric.z) {
    positionAlong = 1.0 - positionAlong;
  }

  // the thickness of the stroke
  float computedThickness = thickness;

  // if we want to shrink the thickness toward the center of the line segment
  if (squeeze) {
    computedThickness *= mix(squeezeMin, squeezeMax, (1.0 - sin(positionAlong * PI)));
  }

  // if we should create a dash pattern
  if (dashEnabled) {
    // here we offset the stroke position depending on whether it
    // should overlap or not
    float offset = 1.0 / dashRepeats * dashLength / 2.0;
    if (!dashOverlap) {
      offset += 1.0 / dashRepeats / 2.0;
    }

    // if we should animate the dash or not
    if (dashAnimate) {
      offset += time * 0.22;
    }

    // create the repeating dash pattern
    float pattern = fract((positionAlong + offset) * dashRepeats);
    computedThickness *= 1.0 - aastep(dashLength, pattern);
  }

  // compute the anti-aliased stroke edge  
  float edge = 1.0 - aastep(computedThickness, d);

  // now compute the final color of the mesh
  #ifdef HAS_INSTANCE
    vec4 strokeColor = vInstanceColor;
  #else
    vec4 strokeColor = stroke;
  #endif
  vec4 outColor = vec4(0.0);
  if (seeThrough) {
    outColor = vec4(strokeColor.xyz, edge);
    if (insideAltColor && !gl_FrontFacing) {
       outColor.rgb = fill.xyz;
    }
  } else {
    vec3 mainStroke = mix(fill.xyz, strokeColor.xyz, edge);
    outColor.a = fill.a;
    if (dualStroke) {
      float inner = 1.0 - aastep(secondThickness, d);
      vec3 wireColor = mix(fill.xyz, stroke.xyz, abs(inner - edge));
      outColor.rgb = wireColor;
    } else {
      outColor.rgb = mainStroke;
    }
  }

  return outColor;
}

void main () {
  gl_FragColor = getStyledWireframe(vBarycentric) * opacity;
  #ifdef HAS_VIEWSHED
      viewshed_draw();
  #endif

  #ifdef HAS_FLOODANALYSE
      draw_floodAnalyse();
  #endif

  #ifdef HAS_FOG
      draw_fog();
  #endif
}