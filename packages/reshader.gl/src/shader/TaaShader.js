import QuadShader from './QuadShader.js';
import vert from './glsl/quad.vert';
import frag from './glsl/taa.frag';
import { vec4 } from 'gl-matrix';

class TaaShader extends QuadShader {
    constructor() {
        const corners = [
            [], []
        ];
        super({
            vert, frag,
            uniforms : [
                'uTaaCurrentFramePVLeft',
                'uTaaInvViewMatrixLeft',
                'uTaaLastFramePVLeft',
                'TextureDepth',
                'TextureInput',
                'TexturePrevious',
                'uTextureDepthRatio',
                'uTextureDepthSize',
                'uTextureInputRatio',
                'uTextureInputSize',
                'uTextureOutputRatio',
                'uTextureOutputSize',
                'uTexturePreviousRatio',
                'uTexturePreviousSize',
                'uHalton',
                'uNearFar',
                'uSSAARestart',
                'uTaaEnabled',
                'uClipAABBEnabled',
                {
                    name: 'uTaaCornersCSLeft',
                    type: 'array',
                    length: 2,
                    fn: function (context, props) {
                        const cornerY = Math.tan(0.5 * props['fov']);
                        const width = props['uTextureOutputSize'][0];
                        const height = props['uTextureOutputSize'][1];
                        const aspect = width / height;
                        const cornerX = aspect * cornerY;
                        vec4.set(corners[0], cornerX, cornerY, cornerX, -cornerY);
                        vec4.set(corners[1], -cornerX, cornerY, -cornerX, -cornerY);
                        return corners;
                    }
                }
            ],
            extraCommandProps: {
                viewport: {
                    x: 0,
                    y: 0,
                    width: (context, props) => {
                        return props['uTextureOutputSize'][0];
                    },
                    height: (context, props) => {
                        return props['uTextureOutputSize'][1];
                    }
                },
                blend: {
                    enable: false
                },
                dither: true
            }
        });
    }

    getMeshCommand(regl, mesh) {
        if (!this.commands['taa']) {
            this.commands['taa'] = this.createREGLCommand(
                regl,
                null,
                ['aPosition', 'aTexCoord'],
                null,
                mesh.getElements()
            );
        }
        return this.commands['taa'];
    }
}

export default TaaShader;

