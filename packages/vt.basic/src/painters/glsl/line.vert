// the distance over which the line edge fades out.
// Retina devices need a smaller distance to avoid aliasing.
#define DEVICE_PIXEL_RATIO 1.0
#define ANTIALIASING 1.0 / DEVICE_PIXEL_RATIO / 2.0

// floor(127 / 2) == 63.0
// the maximum allowed miter limit is 2.0 at the moment. the extrude normal is
// stored in a byte (-128..127). we scale regular normals up to length 63, but
// there are also "special" normals that have a bigger length (of up to 126 in
// this case).
// #define scale 63.0
// EXTRUDE_SCALE = 1 / 127.0
//0.0078740157
#define EXTRUDE_SCALE 63.0;
#define MAX_LINE_DISTANCE 65535.0

#ifdef IS_2D_POSITION
    attribute vec2 aPosition;
#else
    attribute vec3 aPosition;
#endif
attribute vec2 aExtrude;
#if defined(HAS_PATTERN) || defined(HAS_DASHARRAY) || defined(HAS_GRADIENT) || defined(HAS_TRAIL)
    attribute float aLinesofar;
    varying highp float vLinesofar;
#endif

uniform float cameraToCenterDistance;
uniform float lineGapWidth;
uniform mat4 projViewModelMatrix;
uniform float tileResolution;
uniform float resolution;
uniform float tileRatio; //EXTENT / tileSize
uniform float lineDx;
uniform float lineDy;
uniform float lineOffset;
uniform vec2 canvasSize;

varying vec2 vNormal;
varying vec2 vWidth;
varying float vGammaScale;
#ifndef ENABLE_TILE_STENCIL
    varying vec2 vPosition;
#endif

#ifdef USE_LINE_OFFSET
    attribute vec2 aExtrudeOffset;
#endif

#ifdef HAS_LINE_WIDTH
    attribute float aLineWidth;
#else
    uniform float lineWidth;
#endif

#ifdef HAS_COLOR
    attribute vec4 aColor;
    varying vec4 vColor;
#endif

#ifdef HAS_GRADIENT
    attribute float aGradIndex;
    varying float vGradIndex;
#endif

#ifdef HAS_SHADOWING
    #include <vsm_shadow_vert>
#endif


void main() {
    #ifdef IS_2D_POSITION
        vec3 position = vec3(aPosition, 0.0);
    #else
        vec3 position = vec3(aPosition);
    #endif
    position.xy = floor(position.xy * 0.5);

    vNormal = aPosition.xy - 2.0 * position.xy;
    vNormal.y = vNormal.y * 2.0 - 1.0;

    float gapwidth = lineGapWidth / 2.0;
    #ifdef HAS_LINE_WIDTH
        //除以2.0是为了解决 #190
        float lineWidth = aLineWidth / 2.0;
    #endif
    float halfwidth = lineWidth / 2.0;
    // offset = -1.0 * offset;

    float inset = gapwidth + sign(gapwidth) * ANTIALIASING;
    float outset = gapwidth + halfwidth + sign(halfwidth) * ANTIALIASING;

    // Scale the extrusion vector down to a normal and then up by the line width
    // of this vertex.
    #ifdef USE_LINE_OFFSET
        vec2 offset = lineOffset * (vNormal.y * (aExtrude - aExtrudeOffset) + aExtrudeOffset);
        vec2 dist = (outset * aExtrude + offset) / EXTRUDE_SCALE;
    #else
        vec2 dist = outset * aExtrude / EXTRUDE_SCALE;
    #endif

    float scale = tileResolution / resolution;
    vec4 localVertex = vec4(position + vec3(dist, 0.0) * tileRatio / scale, 1.0);
    gl_Position = projViewModelMatrix * localVertex;

    float distance = gl_Position.w;
    gl_Position.xy += vec2(lineDx, lineDy) * 2.0 / canvasSize * distance;


    vWidth = vec2(outset, inset);
    vGammaScale = distance / cameraToCenterDistance;
    #ifndef ENABLE_TILE_STENCIL
        vPosition = position.xy;
        #ifdef USE_LINE_OFFSET
            vPosition += tileRatio * offset / EXTRUDE_SCALE;
        #endif
    #endif

    #if defined(HAS_PATTERN) || defined(HAS_DASHARRAY) || defined(HAS_GRADIENT)
        #ifdef HAS_GRADIENT
            vLinesofar = aLinesofar / MAX_LINE_DISTANCE;
            vGradIndex = aGradIndex;
        #else
            vLinesofar = aLinesofar / tileRatio * scale;
        #endif
    #endif


    #ifdef HAS_COLOR
        vColor = aColor;
    #endif

    #if defined(HAS_SHADOWING)
        shadow_computeShadowPars(localVertex);
    #endif
}
