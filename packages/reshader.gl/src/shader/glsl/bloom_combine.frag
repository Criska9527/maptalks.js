//DEPRECATED
#version 100
precision highp float;
uniform float bloomFactor;
uniform float bloomRadius;
uniform float rgbmRange;
uniform sampler2D TextureBloomBlur1;
uniform sampler2D TextureBloomBlur2;
uniform sampler2D TextureBloomBlur3;
uniform sampler2D TextureBloomBlur4;
uniform sampler2D TextureBloomBlur5;
uniform sampler2D TextureInput;
uniform sampler2D TextureSource;
uniform vec2 outputSize;
#define SHADER_NAME bloomCombine

vec2 gTexCoord;
vec3 linearTosRGB(const in vec3 color) {
    return vec3( color.r < 0.0031308 ? color.r * 12.92 : 1.055 * pow(color.r, 1.0/2.4) - 0.055, color.g < 0.0031308 ? color.g * 12.92 : 1.055 * pow(color.g, 1.0/2.4) - 0.055, color.b < 0.0031308 ? color.b * 12.92 : 1.055 * pow(color.b, 1.0/2.4) - 0.055);
}
vec3 decodeRGBM(const in vec4 color, const in float range) {
    if(range <= 0.0) return color.rgb;
    return range * color.rgb * color.a;
}
float getRadiusFactored(const float value, const float middle) {
    return mix(value, middle * 2.0 - value, bloomRadius);
}
vec4 bloomCombine() {
    vec3 bloom = vec3(0.0);
    const float midVal = 0.6;
    const float factor1 = 1.1;
    const float factor2 = 0.9;
    const float factor3 = 0.6;
    const float factor4 = 0.3;
    const float factor5 = 0.1;
    bloom += (vec4(decodeRGBM(texture2D(TextureBloomBlur1, gTexCoord), rgbmRange), 1.0)).rgb * getRadiusFactored(factor1, midVal);
    bloom += (vec4(decodeRGBM(texture2D(TextureBloomBlur2, gTexCoord), rgbmRange), 1.0)).rgb * getRadiusFactored(factor2, midVal);
    bloom += (vec4(decodeRGBM(texture2D(TextureBloomBlur3, gTexCoord), rgbmRange), 1.0)).rgb * getRadiusFactored(factor3, midVal);
    bloom += (vec4(decodeRGBM(texture2D(TextureBloomBlur4, gTexCoord), rgbmRange), 1.0)).rgb * getRadiusFactored(factor4, midVal);
    bloom += (vec4(decodeRGBM(texture2D(TextureBloomBlur5, gTexCoord), rgbmRange), 1.0)).rgb * getRadiusFactored(factor5, midVal);
    vec4 color = texture2D(TextureInput, gTexCoord);
    color.rgb = mix(vec3(0.0), color.rgb, sign(color.a));

    float srcAlpha = mix(sqrt((bloom.r + bloom.g + bloom.b) / 3.0), 1.0, sign(color.a));

    float dstAlpha = 1.0 - srcAlpha;

    vec4 srcColor = texture2D(TextureSource, gTexCoord);

    return vec4(srcColor.rgb * dstAlpha + color.rgb + linearTosRGB(bloom.rgb * bloomFactor), srcAlpha + srcColor.a * dstAlpha);
}
void main(void) {
    gTexCoord = gl_FragCoord.xy / outputSize.xy;
    vec4 color = bloomCombine();
    // color.rgb = linearTosRGB(color.rgb);
    gl_FragColor = color;
}
