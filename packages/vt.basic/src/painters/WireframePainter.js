import { reshader } from '@maptalks/gl';
import { mat4 } from '@maptalks/gl';
import Painter from './Painter';
import { piecewiseConstant, isFunctionDefinition } from '@maptalks/function-type';

const vert = `
    attribute vec3 aPosition;
    attribute vec4 aColor;

    uniform mat4 projMatrix;
    uniform mat4 viewModelMatrix;
    uniform vec2 halton;
    uniform vec2 globalTexSize;

    varying vec4 vColor;

    void main()
    {
        mat4 jitteredProjection = projMatrix;
        jitteredProjection[2].xy += halton.xy / globalTexSize.xy;
        gl_Position = jitteredProjection * viewModelMatrix * vec4(aPosition, 1.0);
        vColor = aColor / 255.0;
    }
`;

const frag = `
    #ifdef GL_ES
        precision lowp float;
    #endif

    uniform float opacity;

    varying vec4 vColor;

    void main()
    {
        gl_FragColor = vColor * opacity;
    }
`;

const SCALE = [1, 1, 1];

class WireframePainter extends Painter {
    constructor(regl, layer, symbol, sceneConfig, pluginIndex) {
        super(regl, layer, symbol, sceneConfig, pluginIndex);
        if (isFunctionDefinition(this.symbolDef['lineColor'])) {
            const map = layer.getMap();
            const fn = piecewiseConstant(this.symbolDef['lineColor']);
            this.colorSymbol = properties => fn(map.getZoom(), properties);
        } else {
            this.colorSymbol = this.getSymbol()['lineColor'] || '#bbb';
        }
    }

    createGeometry(glData) {
        const { data, indices } = glData;
        const geometry = new reshader.Geometry(data, indices, 0, { 'primitive': 'lines' });
        geometry.generateBuffers(this.regl);

        return geometry;
    }

    createMesh(geometry, transform) {
        const mesh = new reshader.Mesh(geometry);
        if (this.sceneConfig.animation) {
            SCALE[2] = 0.01;
            const mat = [];
            mat4.fromScaling(mat, SCALE);
            mat4.multiply(mat, transform, mat);
            transform = mat;
        }
        mesh.setLocalTransform(transform);
        return mesh;
    }

    addMesh(mesh, progress) {
        if (progress !== null) {
            const mat = mesh.localTransform;
            if (progress === 0) {
                progress = 0.01;
            }
            SCALE[2] = progress;
            mat4.fromScaling(mat, SCALE);
            mat4.multiply(mat, mesh.properties.tileTransform, mat);
            mesh.setLocalTransform(mat);
        } else {
            mesh.setLocalTransform(mesh.properties.tileTransform);
        }
        this.scene.addMesh(mesh);
        return this;
    }

    init() {
        const regl = this.regl;

        this.scene = new reshader.Scene();

        this.renderer = new reshader.Renderer(regl);

        const viewport = {
            x: 0,
            y: 0,
            width: () => {
                return this.canvas ? this.canvas.width : 1;
            },
            height: () => {
                return this.canvas ? this.canvas.height : 1;
            }
        };

        const config = {
            vert,
            frag,
            uniforms: [
                // {
                //     name: 'projViewModelMatrix',
                //     type: 'function',
                //     fn: function (context, props) {
                //         const projViewModelMatrix = [];
                //         mat4.multiply(projViewModelMatrix, props['projViewMatrix'], props['modelMatrix']);
                //         return projViewModelMatrix;
                //     }
                // },
                'projMatrix',
                {
                    name: 'viewModelMatrix',
                    type: 'function',
                    fn: function (context, props) {
                        const viewModelMatrix = [];
                        mat4.multiply(viewModelMatrix, props['viewMatrix'], props['modelMatrix']);
                        return viewModelMatrix;
                    }
                },
                'globalTexSize',
                'halton',
                'opacity'
            ],
            extraCommandProps: {
                stencil: {
                    enable: true,
                    func: {
                        cmp: '<=',
                        ref: (context, props) => {
                            return props.level;
                        },
                        // mask: 0xff
                    },
                    op: {
                        fail: 'keep',
                        zfail: 'keep',
                        zpass: 'replace'
                    }
                },
                blend: {
                    enable: true,
                    func: this.getBlendFunc(),
                    equation: 'add'
                },
                viewport
            }
        };

        this.shader = new reshader.MeshShader(config);
    }

    getUniformValues(map, context) {
        // const projViewMatrix = map.projViewMatrix;
        const opacity = this.sceneConfig.opacity || 0.3;
        const canvas = this.layer.getRenderer().canvas;
        return {
            // projViewMatrix,
            projMatrix: map.projMatrix,
            viewMatrix: map.viewMatrix,
            globalTexSize: [canvas.width, canvas.height],
            halton: context && context.jitter || [0, 0],
            opacity
        };
    }
}

export default WireframePainter;
