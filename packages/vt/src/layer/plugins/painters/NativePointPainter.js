import { reshader, mat4 } from '@maptalks/gl';
import BasicPainter from './BasicPainter';
import vert from './glsl/native-point.vert';
import frag from './glsl/native-point.frag';
import pickingVert from './glsl/native-point.vert';
import { setUniformFromSymbol, createColorSetter } from '../Util';

const DEFAULT_UNIFORMS = {
    markerFill: [0, 0, 0],
    markerOpacity: 1,
    markerSize: 10
};

class NativePointPainter extends BasicPainter {

    getPrimitive() {
        return 'points';
    }

    isTerrainSkin() {
        return false;
    }

    isTerrainVector() {
        return this.layer.options.awareOfTerrain;
    }

    createMesh(geo, transform) {
        const { geometry, symbolIndex, ref } = geo;
        const symbol = this.getSymbol(symbolIndex);
        if (ref === undefined) {
            geometry.generateBuffers(this.regl);
        }

        const uniforms = {};
        setUniformFromSymbol(uniforms, 'markerOpacity', symbol, 'markerOpacity', 1);
        setUniformFromSymbol(uniforms, 'markerSize', symbol, 'markerSize', 10);
        setUniformFromSymbol(uniforms, 'markerFill', symbol, 'markerFill', '#000', createColorSetter(this.colorCache, 3));
        const material = new reshader.Material(uniforms, DEFAULT_UNIFORMS);
        material.createDefines = () => {
            if (symbol.markerType !== 'square') {
                return {
                    'USE_CIRCLE': 1
                };
            }
            return null;
        };

        material.appendDefines = (defines/*, geometry*/) => {
            if (symbol.markerType !== 'square') {
                defines['USE_CIRCLE'] = 1;
            }
            return defines;
        };
        const mesh = new reshader.Mesh(geometry, material, {
            castShadow: false,
            picking: true
        });
        const defines = {};
        if (mesh.geometry.data.aAltitude) {
            defines['HAS_ALTITUDE'] = 1;
        }
        mesh.setDefines(defines);
        mesh.positionMatrix = this.getAltitudeOffsetMatrix();
        mesh.setLocalTransform(transform);
        mesh.properties.symbolIndex = symbolIndex;
        return mesh;
    }

    init() {
        const regl = this.regl;

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
        const projViewModelMatrix = [];
        // const stencil = this.layer.getRenderer().isEnableTileStencil && this.layer.getRenderer().isEnableTileStencil();
        const config = {
            vert,
            frag,
            uniforms: [
                {
                    name: 'projViewModelMatrix',
                    type: 'function',
                    fn: function (context, props) {
                        mat4.multiply(projViewModelMatrix, props['projViewMatrix'], props['modelMatrix']);
                        return projViewModelMatrix;
                    }
                }
            ],
            defines: null,
            extraCommandProps: {
                viewport,
                // stencil: {
                //     enable: false,
                //     func: {
                //         cmp: () => {
                //             return stencil ? '=' : '<=';
                //         },
                //         ref: (context, props) => {
                //             return stencil ? props.stencilRef : props.level;
                //         },
                //         mask: 0xFF
                //     },
                //     op: {
                //         fail: 'keep',
                //         zfail: 'keep',
                //         zpass: () => {
                //             return stencil ? 'zero' : 'replace';
                //         }
                //     }
                // },
                depth: {
                    enable: true,
                    mask: false,
                    range: this.sceneConfig.depthRange || [0, 1],
                    func: this.sceneConfig.depthFunc || 'always'
                },
                blend: {
                    enable: true,
                    func: this.getBlendFunc(),
                    equation: 'add'
                }
            }
        };

        this.shader = new reshader.MeshShader(config);
        this.shader.version = 300;

        if (this.pickingFBO) {
            const projViewModelMatrix = [];
            this.picking = [new reshader.FBORayPicking(
                this.renderer,
                {
                    vert: '#define PICKING_MODE 1\n' + pickingVert,
                    uniforms: [
                        {
                            name: 'projViewModelMatrix',
                            type: 'function',
                            fn: function (context, props) {
                                mat4.multiply(projViewModelMatrix, props['projViewMatrix'], props['modelMatrix']);
                                return projViewModelMatrix;
                            }
                        }
                    ],
                    extraCommandProps: {
                        viewport: this.pickingViewport
                    }
                },
                this.pickingFBO,
                this.getMap()
            )];
        }
    }

    getUniformValues(map) {
        const projViewMatrix = map.projViewMatrix;
        return {
            projViewMatrix
        };
    }
}

export default NativePointPainter;
