#define RAD 0.0174532925

attribute vec3 aPosition;
attribute vec2 aShape;
attribute vec2 aTexCoord;
//uint8
#ifdef ENABLE_COLLISION
    attribute float aOpacity;
#endif

#ifdef HAS_OPACITY
    attribute float aColorOpacity;
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
#if defined(HAS_PITCH_ALIGN)
    attribute float aPitchAlign;
#else
    uniform float pitchWithMap;
#endif

#if defined(HAS_ROTATION_ALIGN)
    attribute float aRotationAlign;
#else
    uniform float rotateWithMap;
#endif

uniform float markerRotation;

uniform float cameraToCenterDistance;
uniform mat4 projViewModelMatrix;
uniform float markerPerspectiveRatio;

uniform vec2 iconSize;
uniform vec2 texSize;
uniform vec2 canvasSize;
uniform float mapPitch;
uniform float mapRotation;

uniform float zoomScale;
uniform float tileRatio; //EXTENT / tileSize

varying vec2 vTexCoord;
varying float vOpacity;

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
    #if defined(HAS_PITCH_ALIGN)
        float pitchWithMap = aPitchAlign;
    #endif
    #if defined(HAS_ROTATION_ALIGN)
        float rotateWithMap = aRotationAlign;
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
    vec2 shape = (aShape / 10.0) / iconSize * vec2(markerWidth, markerHeight);
    shape = shapeMatrix * shape;

    if (pitchWithMap == 0.0) {
        vec2 offset = shape * 2.0 / canvasSize;
        gl_Position.xy += offset * perspectiveRatio * distance;
    } else {
        float cameraScale = distance / cameraToCenterDistance;
        vec2 offset = shape;
        //乘以cameraScale可以抵消相机近大远小的透视效果
        gl_Position = projViewModelMatrix * vec4(position + vec3(offset, 0.0) * tileRatio / zoomScale * cameraScale * perspectiveRatio, 1.0);
    }

    gl_Position.xy += vec2(markerDx, markerDy) * 2.0 / canvasSize * distance;

    vTexCoord = aTexCoord / texSize;

    #ifdef ENABLE_COLLISION
        vOpacity = aOpacity / 255.0;
    #else
        vOpacity = 1.0;
    #endif

    #ifdef HAS_OPACITY
        vOpacity *= aColorOpacity / 255.0;
    #endif
}
