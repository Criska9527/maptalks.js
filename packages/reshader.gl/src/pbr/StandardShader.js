import { mat3, mat4 } from 'gl-matrix';
import vertSource from './glsl/standard.vert';
import frag from './glsl/standard.frag';
import MeshShader from '../shader/MeshShader.js';
import { extend } from '../common/Util';


//http://codeflow.org/entries/2012/aug/02/easy-wireframe-display-with-barycentric-coordinates/
class StandardShader extends MeshShader {
    constructor(config = {}) {
        let extraCommandProps = config.extraCommandProps || {};
        const extraUniforms = config.uniforms;
        extraCommandProps = extend({}, extraCommandProps, {
            blend : {
                enable: true,
                func: {
                    src: 'one',
                    dst: 'one minus src alpha'
                    // srcRGB: 'src alpha',
                    // srcAlpha: 1,
                    // dstRGB: 'one minus src alpha',
                    // dstAlpha: 'one minus src alpha'
                },
                equation: 'add'
            },
            sample: {
                alpha: true
            }
        });

        // const modelMatrix = [1, -0.0000, -0.0000, 0, 0, 0.0000, 1, 0, 0.0000, -1, 0.0000, 0, -155.4500, 0, 287.6630, 1];
        // const modelViewMatrix = [-0.2274, -0.5468, 0.8058, 0, 0, 0.8275, 0.5615, 0, -0.9738, 0.1277, -0.1882, 0, 71.0551, 174.0461, -2710.2300, 1];
        // const viewMatrix = mat4.multiply([], modelViewMatrix, mat4.invert([], modelMatrix));
        // const modelView = mat4.multiply([], viewMatrix, modelMatrix);
        // const inverted = mat4.invert(modelView, modelView);
        // const transposed = mat4.transpose(inverted, inverted);
        // console.log(mat3.fromMat4([], transposed));

        const uniforms = [
            'uCameraPosition',
            //vert中的uniforms
            {
                name: 'uModelMatrix',
                type: 'function',
                fn: (context, props) => {
                    return props['modelMatrix'];
                }
            },
            {
                name: 'uModelNormalMatrix',
                type: 'function',
                fn: (context, props) => {
                    // const model3 = mat3.fromMat4([], props['modelMatrix']);
                    // const transposed = mat3.transpose(model3, model3);
                    // const inverted = mat3.invert(transposed, transposed);
                    // return inverted;
                    return mat3.fromMat4([], props['modelMatrix']);
                }
            },
            {
                name: 'uModelViewNormalMatrix',
                type: 'function',
                fn: (context, props) => {
                    const modelView = mat4.multiply([], props['viewMatrix'], props['modelMatrix']);
                    const inverted = mat4.invert(modelView, modelView);
                    const transposed = mat4.transpose(inverted, inverted);
                    return mat3.fromMat4([], transposed);
                    // const modelView = mat4.multiply([], props['viewMatrix'], props['modelMatrix']);
                    // return mat3.fromMat4([], modelView);
                }
            },
            {
                name : 'uProjectionMatrix',
                type : 'function',
                fn : (context, props) => {
                    return props['projMatrix'];
                }
            },
            // {
            //     name : 'uProjViewModelMatrix',
            //     type : 'function',
            //     fn : (context, props) => {
            //         return mat4.multiply([], props['projViewMatrix'], props['modelMatrix']);
            //     }
            // },
            {
                name : 'uModelViewMatrix',
                type : 'function',
                fn : (context, props) => {
                    return mat4.multiply([], props['viewMatrix'], props['modelMatrix']);
                }
            },
            'uGlobalTexSize',
            'uvScale', 'uvOffset',
            'uEmitColor',
            'uBaseColorFactor',

            'uAlbedoPBRFactor', //1
            'uAnisotropyDirection', //0
            'uAnisotropyFactor', //1
            'uClearCoatF0', //0.04
            'uClearCoatFactor', //1
            'uClearCoatIor', //1.4
            'uClearCoatRoughnessFactor', //0.04
            'uClearCoatThickness', //5
            'uEmitColorFactor', //1
            'uEnvironmentExposure', //2
            'uFrameMod', //
            'uRoughnessFactor', //0.4
            'uMetallicFactor', //0
            'uNormalMapFactor', //1
            'uRGBMRange', //7
            'uScatteringFactorPacker', //unused
            // 'uShadowReceive3_bias',
            'uSpecularF0Factor', //0.5862
            'uStaticFrameNumShadow3', //14
            'uSubsurfaceScatteringFactor', //1
            'uSubsurfaceScatteringProfile', //unused
            'uSubsurfaceTranslucencyFactor', //1
            'uSubsurfaceTranslucencyThicknessFactor', //37.4193
            'uAnisotropyFlipXY', //unused
            'uDrawOpaque', //unused
            'uEmitMultiplicative', //0
            'uNormalMapFlipY', //1
            'uOutputLinear', //1
            'uEnvironmentTransform', //0.5063, -0.0000, 0.8624, 0.6889, 0.6016, -0.4044, -0.5188, 0.7988, 0.3046
            'uBaseColorTexture',
            'uNormalTexture',
            'uOcclusionTexture',
            'uMetallicRoughnessTexture',
            'uEmissiveTexture',
            'sIntegrateBRDF',
            'sSpecularPBR',
            'uNearFar', //unused
            // 'uShadow_Texture3_depthRange',
            // 'uShadow_Texture3_renderSize',
            'uTextureEnvironmentSpecularPBRLodRange', //8, 5
            'uTextureEnvironmentSpecularPBRTextureSize', //256,256
            'uClearCoatTint', //0.0060, 0.0060, 0.0060
            'uDiffuseSPH[9]',
            // 'uShadow_Texture3_projection',
            'uSketchfabLight0_viewDirection',
            // 'uSketchfabLight1_viewDirection',
            // 'uSketchfabLight2_viewDirection',
            // 'uSketchfabLight3_viewDirection',
            'uSubsurfaceTranslucencyColor', //1, 0.3700, 0.3000
            'uHalton', //0.0450, -0.0082, 1, 5
            // 'uShadow_Texture3_viewLook',
            // 'uShadow_Texture3_viewRight',
            // 'uShadow_Texture3_viewUp',
            'uSketchfabLight0_diffuse',
            // 'uSketchfabLight1_diffuse',
            // 'uSketchfabLight2_diffuse',
            // 'uSketchfabLight3_diffuse',
            'uAmbientColor',

            //KHR_materials_pbrSpecularGlossiness
            'uDiffuseFactor',
            'uSpecularFactor',
            'uGlossinessFactor',
            'uDiffuseTexture',
            'uSpecularGlossinessTexture',

            'lineColor',
            'lineOpacity',
            'polygonFill',
            'polygonOpacity',

            //viewshed
            'viewshed_depthMapFromViewpoint',
            'viewshed_projViewMatrixFromViewpoint',
            //fog
            'fog_Dist',
            'fog_Color'
        ];
        if (extraUniforms) {
            uniforms.push(...extraUniforms);
        }
        super({
            vert: vertSource,
            frag,
            uniforms,
            extraCommandProps,
            defines: config.defines
        });
    }

    getGeometryDefines(geometry) {
        const defines = {};
        if (geometry.data[geometry.desc.tangentAttribute]) {
            defines['HAS_TANGENT'] = 1;
        }
        return defines;
    }
}


export default StandardShader;
