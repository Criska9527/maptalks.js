#define RAD 0.0174532925
attribute vec3 aPosition;

attribute vec2 aShape;
attribute vec2 aOffset;
#ifdef ENABLE_COLLISION
attribute float aOpacity;
#endif

#ifdef HAS_TEXT_DX
    attribute float aTextDx;
#else
    uniform float textDx;
#endif
#ifdef HAS_TEXT_DY
    attribute float aTextDy;
#else
    uniform float textDy;
#endif
#if defined(HAS_PITCH_ALIGN)
    attribute float aPitchAlign;
#else
    uniform float pitchWithMap;
#endif

uniform float textRotation;

uniform float zoomScale;
uniform float cameraToCenterDistance;
uniform mat4 projViewModelMatrix;
uniform float textPerspectiveRatio;
uniform float mapPitch;

uniform vec2 texSize;
uniform vec2 canvasSize;
uniform float glyphSize;
uniform float tileRatio; //EXTENT / tileSize

#include <fbo_picking_vert>

void main() {
    #ifdef HAS_TEXT_DX
        float textDx = aTextDx;
    #endif
    #ifdef HAS_TEXT_DY
        float textDy = aTextDy;
    #endif
    #if defined(HAS_PITCH_ALIGN)
        float pitchWithMap = aPitchAlign;
    #endif
    vec3 position = aPosition;

    gl_Position = projViewModelMatrix * vec4(position, 1.0);
    float distance = gl_Position.w;

    float cameraScale = distance / cameraToCenterDistance;

    float distanceRatio = (1.0 - cameraToCenterDistance / distance) * textPerspectiveRatio;
    //通过distance动态调整大小
    float perspectiveRatio = clamp(
        0.5 + 0.5 * (1.0 - distanceRatio),
        0.0, // Prevents oversized near-field symbols in pitched/overzoomed tiles
        4.0);

    vec2 offset = aOffset / 10.0; //精度修正：js中用int16存的offset,会丢失小数点，乘以十后就能保留小数点后1位

    if (pitchWithMap == 1.0) {
        //乘以cameraScale可以抵消相机近大远小的透视效果
        gl_Position = projViewModelMatrix * vec4(position + vec3(offset, 0.0) * tileRatio / zoomScale * cameraScale * perspectiveRatio, 1.0);
    } else {
        gl_Position.xy += offset * 2.0 / canvasSize * perspectiveRatio * distance;
    }

    gl_Position.xy += vec2(textDx, textDy) * 2.0 / canvasSize * distance;

    #ifdef ENABLE_COLLISION
        bool visible = aOpacity == 255.0;
    #else
        bool visible = true;
    #endif
    fbo_picking_setData(gl_Position.w, visible);
}
