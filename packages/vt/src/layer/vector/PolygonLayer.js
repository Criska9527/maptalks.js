import * as maptalks from 'maptalks';
import { PolygonPack } from '@maptalks/vector-packer';
import { extend } from '../../common/Util';
import Vector3DLayer from './Vector3DLayer';
import Vector3DLayerRenderer from './Vector3DLayerRenderer';
import { fromJSON } from './util/from_json';
import { ID_PROP } from './util/convert_to_feature';

class PolygonLayer extends Vector3DLayer {
    /**
     * Reproduce a PolygonLayer from layer's JSON.
     * @param  {Object} layerJSON - layer's JSON
     * @return {PolygonLayer}
     * @static
     * @private
     * @function
     */
    static fromJSON(json) {
        return fromJSON(json, 'PolygonLayer', PolygonLayer);
    }
}

PolygonLayer.registerJSONType('PolygonLayer');

const SYMBOL = {
    polygonFill: {
        type: 'identity',
        default: undefined,
        property: '_symbol_polygonFill'
    },
    polygonPatternFile: {
        type: 'identity',
        default: undefined,
        property: '_symbol_polygonPatternFile'
    },
    polygonOpacity: {
        type: 'identity',
        default: 1,
        property: '_symbol_polygonOpacity'
    },
    uvScale: {
        type: 'identity',
        default: [1, 1],
        property: '_symbol_uvScale'
    },
    uvOffset: {
        type: 'identity',
        default: [0, 0],
        property: '_symbol_uvOffset'
    }
};

class PolygonLayerRenderer extends Vector3DLayerRenderer {
    constructor(...args) {
        super(...args);
        this.PackClass = PolygonPack;
        this.GeometryTypes = [maptalks.Polygon, maptalks.MultiPolygon];
    }

    buildMesh(atlas) {
        const { features, center } = this._getFeaturesToRender();
        if (!features.length) {
            return;
        }
        const showHideUpdated = this._showHideUpdated;
        this._meshCenter = center;

        //因为有透明度和没有透明度的多边形绘制逻辑不同，需要分开
        const featureGroups = this._groupPolygonFeatures(features);

        const symbol = extend({}, SYMBOL);
        const promises = featureGroups.map((feas, i) =>
            this.createMesh(this.painter, PolygonPack, symbol, feas, atlas && atlas[i], center)
        );

        this._isCreatingMesh = true;
        Promise.all(promises).then(mm => {
            if (this.meshes) {
                this.painter.deleteMesh(this.meshes);
            }
            const meshes = [];
            const atlas = [];
            for (let i = 0; i < mm.length; i++) {
                const childMeshes = mm[i] && mm[i].meshes;
                if (childMeshes) {
                    meshes.push(...childMeshes);
                    for (let j = 0; j < childMeshes.length; j++) {
                        childMeshes[j].feaGroupIndex = i;
                        childMeshes[j].geometry.properties.originElements = childMeshes[j].geometry.properties.elements.slice();
                        if (i === 1) {
                            childMeshes[j].transparent = true;
                        }
                    }
                    atlas[i] = mm[i].atlas;
                }
            }
            this.meshes = meshes;
            this.atlas = atlas;
            if (showHideUpdated) {
                this._showHideUpdated = showHideUpdated;
            }
            this._isCreatingMesh = false;
            this.setToRedraw();
        });
    }

    getAnalysisMeshes() {
        return this.painter.getAnalysisMeshes();
    }

    getRayCastData(mesh, indiceIndex) {
        const feature = this.painter.getRayCastData(mesh, indiceIndex);
        if (!feature || !feature.feature) {
            return null;
        }
        const uid = feature.feature[ID_PROP];
        return this._geometries[uid];
    }

    _groupPolygonFeatures(features) {
        const feas = [];
        const alphaFeas = [];
        for (let i = 0; i < features.length; i++) {
            const f = features[i];
            if (f.properties && f.properties['_symbol_polygonOpacity'] < 1) {
                alphaFeas.push(f);
            } else {
                feas.push(f);
            }
        }
        return [feas, alphaFeas];
    }

    createPainter() {
        const FillPainter = Vector3DLayer.get3DPainterClass('fill');
        this.painterSymbol = extend({}, SYMBOL);
        this._defineSymbolBloom(this.painterSymbol, 'polygonBloom');
        const painter = new FillPainter(this.regl, this.layer, this.painterSymbol, this.layer.options.sceneConfig, 0);
        return painter;
    }

    updateMesh(polygon) {
        return this._updateMesh(polygon, this.meshes, this.atlas, this._meshCenter, this.painter, PolygonPack, SYMBOL, this._groupPolygonFeatures);
    }


}

PolygonLayer.registerRenderer('gl', PolygonLayerRenderer);
PolygonLayer.registerRenderer('canvas', null);

export default PolygonLayer;
