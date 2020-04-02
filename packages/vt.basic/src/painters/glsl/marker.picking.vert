#define RAD 0.0174532925

attribute vec3 aPosition;

attribute vec2 aShape;
attribute vec2 aTexCoord;
//uint8
#ifdef ENABLE_COLLISION
attribute float aOpacity;
#endif

#ifdef HAS_MARKER_WIDTH
    attribute float aMarkerWidth;
#else
    uniform float markerWidth;
#endif
#ifdef HAS_MARKER_HEIGHT
    attribute float aMarkerHeight;
#else
    uniform float markerHeight;
#endif
#ifdef HAS_MARKER_DX
    attribute float aMarkerDx;
#else
    uniform float markerDx;
#endif
#ifdef HAS_MARKER_DY
    attribute float aMarkerDy;
#else
    uniform float markerDy;
#endif
uniform float markerRotation;

uniform float cameraToCenterDistance;
uniform mat4 projViewModelMatrix;
uniform float markerPerspectiveRatio;

uniform vec2 iconSize;
uniform vec2 texSize;
uniform vec2 canvasSize;
uniform float pitchWithMap;
uniform float mapPitch;
uniform float rotateWithMap;
uniform float mapRotation;

uniform float zoomScale;
uniform float tileRatio; //EXTENT / tileSize

#include <fbo_picking_vert>

void main() {
    vec3 position = aPosition;
    #ifdef HAS_MARKER_WIDTH
        float markerWidth = aMarkerWidth;
    #endif
    #ifdef HAS_MARKER_HEIGHT
        float markerHeight = aMarkerHeight;
    #endif
    #ifdef HAS_MARKER_DX
        float markerDx = aMarkerDx;
    #endif
    #ifdef HAS_MARKER_DY
        float markerDy = aMarkerDy;
    #endif
    gl_Position = projViewModelMatrix * vec4(position, 1.0);
    float distance = gl_Position.w;

    float distanceRatio = (1.0 - cameraToCenterDistance / distance) * markerPerspectiveRatio;
    //通过distance动态调整大小
    float perspectiveRatio = clamp(
        0.5 + 0.5 * (1.0 - distanceRatio),
        0.0, // Prevents oversized near-field symbols in pitched/overzoomed tiles
        4.0);

    float rotation = markerRotation - mapRotation * rotateWithMap;
    if (pitchWithMap == 1.0) {
        rotation += mapRotation;
    }
    float angleSin = sin(rotation);
    float angleCos = cos(rotation);

    mat2 shapeMatrix = mat2(angleCos, -1.0 * angleSin, angleSin, angleCos);
    vec2 shape = shapeMatrix * (aShape / 10.0);
    shape = shape / iconSize * vec2(markerWidth, markerHeight);

    if (pitchWithMap == 0.0) {
        vec2 offset = shape * 2.0 / canvasSize;
        gl_Position.xy += offset * perspectiveRatio * distance;
    } else {
        float cameraScale = distance / cameraToCenterDistance;
        vec2 offset = shape * vec2(1.0, -1.0);
        //乘以cameraScale可以抵消相机近大远小的透视效果
        gl_Position = projViewModelMatrix * vec4(position + vec3(offset, 0.0) * tileRatio / zoomScale * cameraScale * perspectiveRatio, 1.0);
    }

    gl_Position.xy += vec2(markerDx, markerDy) * 2.0 / canvasSize * distance;

    #ifdef ENABLE_COLLISION
        bool visible = aOpacity == 255.0;
    #else
        bool visible = true;
    #endif

    fbo_picking_setData(gl_Position.w, visible);
}
