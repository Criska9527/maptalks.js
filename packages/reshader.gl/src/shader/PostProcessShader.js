import QuadShader from './QuadShader.js';
import vert from './glsl/quad.vert';
import frag from './glsl/postprocess.frag';

class PostProcessShader extends QuadShader {
    constructor() {
        super({
            vert, frag,
            uniforms : [
                //common uniforms
                'textureSource', 'resolution',
                //filmic grain uniforms
                'enableGrain', 'timeGrain', 'grainFactor',
                //vignette uniforms
                'enableVignette', 'lensRadius', 'frameMod',
                //color lut uniforms
                'enableLut', 'lookupTable'
            ],
            extraCommandProps: {
                viewport: {
                    x: 0,
                    y: 0,
                    width: (context, props) => {
                        return props['resolution'][0];
                    },
                    height: (context, props) => {
                        return props['resolution'][1];
                    }
                }
            }
        });
    }

    getMeshCommand(regl, mesh) {
        if (!this.commands['postprocess']) {
            this.commands['postprocess'] = this.createREGLCommand(
                regl,
                null,
                null,
                mesh.getElements()
            );
        }
        return this.commands['postprocess'];
    }
}

export default PostProcessShader;
