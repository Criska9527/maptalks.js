import Point from '@mapbox/point-geometry';
import convert from './util/convert';
import IconAtlas from './atlas/IconAtlas';
import GlyphAtlas from './atlas/GlyphAtlas';
import { getIndexArrayType, fillTypedArray, getPosArrayType, getUnsignedArrayType } from './util/array';
import { RGBAImage, AlphaImage } from '../Image';
import convertGeometry from './util/convert_geometry';
import { extend } from '../style/Util';
import { loadFunctionTypes, interpolated, piecewiseConstant } from '@maptalks/function-type';
import { isFnTypeSymbol, isNumber, hasOwn } from '../style/Util';
import { getHeightValue } from './util/util';
import StyledVector from './StyledVector';
import { packPosition/*, unpackPosition*/ } from './util/pack_position';
import { compileFilter } from '../style/Filter';

const interpolatedSymbols = {
    'lineWidth': 1,
    'lineStrokeWidth': 1,
    'lineDx': 1,
    'lineDy': 1,
    'lineOpacity': 1,
    'linePatternAnimSpeed': 1,
    'markerWidth': 1,
    'markerHeight': 1,
    'markerDx': 1,
    'markerDy': 1,
    'markerSpacing': 1,
    'markerOpacity': 1,
    'markerRotation': 1,
    'textWrapWidth': 1,
    'textSpacing': 1,
    'textSize': 1,
    'textHaloRadius': 1,
    'textHaloOpacity': 1,
    'textDx': 1,
    'textDy': 1,
    'textOpacity': 1,
    'textRotation': 1,
    'polygonOpacity': 1
};

//feature index defined in BaseLayerWorker
export const KEY_IDX = '__fea_idx';

const TEMP_PACK_POS = [];

/**
 * abstract class for all vector packs
 */
export default class VectorPack {

    static isAtlasLoaded(res, atlas = {}) {
        const { iconAtlas } = atlas;
        if (res) {
            if (!iconAtlas || !iconAtlas.positions[res]) {
                return false;
            }
        }
        return true;
    }

    static genFnTypes(symbolDef) {
        const fnTypes = {};
        for (const p in symbolDef) {
            if (isFnTypeSymbol(symbolDef[p])) {
                const fn0KeyName = (p + '_Fn_0').trim();
                const fnKeyName = (p + 'Fn').trim();
                if (interpolatedSymbols[p]) {
                    fnTypes[fn0KeyName] = interpolated(symbolDef[p]);
                    fnTypes[fnKeyName] = (zoom, properties) => {
                        const v = fnTypes[fn0KeyName](zoom, properties);
                        if (isFnTypeSymbol(v)) {
                            return interpolated(v)(zoom, properties);
                        } else {
                            return v;
                        }
                    }
                } else {
                    fnTypes[fn0KeyName] = piecewiseConstant(symbolDef[p]);
                    fnTypes[fnKeyName] = (zoom, properties) => {
                        const v = fnTypes[fn0KeyName](zoom, properties);
                        if (isFnTypeSymbol(v)) {
                            return piecewiseConstant(v)(zoom, properties);
                        } else {
                            return v;
                        }
                    }
                }
            }
        }
        return fnTypes;
    }

    constructor(features, symbol, options) {
        //TODO 预先把altitude传到pack里来？
        this.options = options;
        // if (!this.options['center']) {
        //     this.options['center'] = [0, 0];
        // }
        this.symbolDef = symbol;
        this.symbol = loadFunctionTypes(symbol, () => {
            return [options.zoom];
        });
        this.styledVectors = [];
        this.properties = {};
        this._fnTypes = VectorPack.genFnTypes(this.symbolDef);
        if (isFnTypeSymbol(this.symbolDef['visible'])) {
            this._visibleFn = interpolated(this.symbolDef['visible']);
        }
        if (options.atlas) {
            this.iconAtlas = options.atlas.iconAtlas;
            this.glyphAtlas = options.atlas.glyphAtlas;
        }
        this.features = this._check(features);
    }

    needAltitudeAttribute() {
        return this.options['forceAltitudeAttribute'] || this.maxPosZ >= Math.pow(2, 17);
    }

    getPositionFormat() {
        if (this.needAltitudeAttribute()) {
            return [
                {
                    type: Int16Array,
                    width: 2,
                    name: 'aPosition'
                },
                {
                    type: Float32Array,
                    width: 1,
                    name: 'aAltitude'
                }
            ];
        } else {
            return [
                {
                    type: Int16Array,
                    width: 3,
                    name: 'aPosition'
                }
            ];
        }
    }

    fillPosition(data, x, y, altitude) {
        if (this.needAltitudeAttribute()) {
            data.aPosition.push(x, y);
            data.aAltitude.push(altitude);
        } else {
            packPosition(TEMP_PACK_POS, x, y, altitude);
            data.aPosition.push(...TEMP_PACK_POS);
        }
    }

    _check(features) {
        if (!features.length) {
            return features;
        }
        const keyName = (KEY_IDX + '').trim();
        let i = 0;
        let first = features[i];
        while (!first.geometry) {
            i++;
            first = features[i];
        }
        let checked;
        if (Array.isArray(first.geometry) && first.properties) {
            let g = first.geometry[0];
            while (Array.isArray(g)) {
                g = g[0];
            }
            if (g instanceof Point) {
                //a converted one
                checked = features;
            }
        }
        if (!checked) {
            checked = [];
            if (Array.isArray(first.geometry)) {
                for (let i = 0; i < features.length; i++) {
                    const feature = features[i];
                    const fea = extend({}, feature);
                    checked.push(convertGeometry(fea));
                }
            } else {
                for (let i = 0; i < features.length; i++) {
                    const feature = features[i];
                    const feas = convert(feature);
                    for (let ii = 0; ii < feas.length; ii++) {
                        const fea = feas[ii];
                        fea[keyName] = feature[keyName];
                        checked.push(fea);
                    }
                }
            }
        }

        this.maxPosZ = 0;
        if (!this.options['forceAltitudeAttribute']) {
            const isLinePlacement = this.symbolDef['textPlacement'] === 'line';
            let maxZ = 0;
            let hasMapPitchAlign = false;
            const { textPitchAlignmentFn } = this._fnTypes;
            if (!textPitchAlignmentFn && isLinePlacement && this.symbolDef['textPitchAlignment'] === 'map') {
                hasMapPitchAlign = true;
            }
            for (let i = 0; i < checked.length; i++) {
                const altitude = getMaxAltitude(checked[i] && checked[i].geometry);
                if (altitude > maxZ) {
                    maxZ = altitude;
                }
                if (isLinePlacement && !hasMapPitchAlign && textPitchAlignmentFn && checked[i].properties) {
                    const pitchAlign = textPitchAlignmentFn(null, checked[i].properties);
                    if (pitchAlign === 'map') {
                        hasMapPitchAlign = pitchAlign;
                    }
                }
            }
            this.hasMapPitchAlign = hasMapPitchAlign;
            this.maxPosZ = maxZ;
        }


        const orders = this.options.order;
        if (orders) {
            const orderFilters = [];
            //顺序与
            for (let i = 0; i < orders.length; i++) {
                if (!orders[i]) {
                    continue;
                }
                orderFilters.push(compileFilter(orders[i]));
            }
            checked = checked.sort((a, b) => {
                const l = orderFilters.length;
                let ia = l;
                let ib = l;
                for (let i = 0; i < l; i++) {
                    if (orderFilters[i](a)) {
                        ia = i;
                    }
                    if (orderFilters[i](b)) {
                        ib = i;
                    }
                    if (ia < l && ib < l) {
                        break;
                    }
                }
                return ia - ib;
            });
        }
        return checked;
    }

    load(scale = 1) {
        // fix terser's bug
        const keyName = (KEY_IDX + '').trim();
        const keyNameDebug = ('_debug_info').trim();
        const fnTypes = this._fnTypes;
        const vectors = this.styledVectors;
        this.count = 0;
        const features = this.features;
        if (!features || !features.length) return Promise.resolve(null);
        const iconReqs = {}, glyphReqs = {};
        const options = { zoom: this.options.zoom };
        const symbol = loadFunctionTypes(this.symbolDef, () => {
            return [options.zoom];
        });
        let i = 0, l = features.length;
        const debugIndex = this.options.debugIndex;
        try {
            for (; i < l; i++) {
                const feature = features[i];
                // let vector;
                // PointLayer中，Marker的symbol有多个时，properties就会是数组了，但这个设计并不是很好，需要调整
                // if (Array.isArray(feature.properties)) {
                //     vector = [];
                //     for (let j = 0; j < feature.properties.length; j++) {
                //         const fea = extend({}, feature);
                //         fea.properties = feature.properties[j];
                //         const v = this.createStyledVector(fea, symbol, options, iconReqs, glyphReqs);
                //         if (v) {

                //             vector.push(v);
                //         }
                //     }
                //     vector.featureIdx = feature[KEY_IDX] === undefined ? i : feature[KEY_IDX];
                //     if (!vector.length) {
                //         continue;
                //     }
                // } else {
                if (!feature || !feature.geometry) {
                    continue;
                }
                if (debugIndex !== undefined && feature[keyNameDebug].index !== debugIndex) {
                    continue;
                }
                if (!feature.properties) {
                    feature.properties = {};
                }
                feature.properties['$layer'] = feature.layer;
                feature.properties['$type'] = feature.type;
                const vector = this.createStyledVector(feature, symbol, fnTypes, options, iconReqs, glyphReqs);
                if (!vector || !vector.feature.geometry) {
                    continue;
                }
                vector.featureIdx = feature[keyName] === undefined ? i : feature[keyName];

                // }
                this.count++;
                vectors.push(vector);
            }
        } catch (err) {
            return Promise.reject(err);
        }

        if (this.options['atlas']) {
            return Promise.resolve(this.pack(scale));
        }

        return this.loadAtlas(iconReqs, glyphReqs).then(() => {
            return this.pack(scale);
        });
    }

    loadAtlas(iconReqs, glyphReqs) {
        return new Promise((resolve, reject) => {
            this.fetchAtlas(iconReqs, glyphReqs, (err, data) => {
                if (err) {
                    reject(err);
                    return;
                }
                if (data) {
                    const { icons, glyphs } = data;
                    if (icons && Object.keys(icons).length) {
                        for (const url in icons) {
                            const icon = icons[url];
                            const { width, height, data } = icon.data;
                            icon.data = new RGBAImage({ width, height }, data);
                        }
                        this.iconAtlas = new IconAtlas(icons);
                    }
                    if (glyphs && Object.keys(glyphs).length) {
                        for (const font in glyphs) {
                            const glyph = glyphs[font];
                            for (const code in glyph) {
                                const sdf = glyph[code];
                                const { width, height, data } = sdf.bitmap;
                                sdf.bitmap = new AlphaImage({ width, height }, data);
                            }

                        }

                        this.glyphAtlas = new GlyphAtlas(glyphs);
                    }
                }

                resolve({ glyphAtlas: this.glyphAtlas, iconAtlas: this.iconAtlas });
                // resolve(this.iconAtlas, this.glyphAtlas);
            });
        });
    }

    fetchAtlas(iconReqs, glyphReqs, cb) {
        const needFetch = Object.keys(iconReqs).length > 0 || Object.keys(glyphReqs).length > 0;
        if (!needFetch) {
            cb();
            return;
        }
        this.options.requestor(iconReqs, glyphReqs, cb);
    }

    pack(scale) {
        if (!this.count) {
            return null;
        }
        if (scale === undefined || scale === null) {
            throw new Error('layout scale is undefined');
        }
        const pack = this.createDataPack(this.styledVectors, scale);
        if (!pack) {
            return null;
        }
        pack.properties = this.properties;
        if (this.empty) {
            pack.empty = true;
        }
        const buffers = pack.buffers;
        delete pack.buffers;
        const vectorPack = {
            data: pack, buffers,
        };

        if (this.iconAtlas) {
            //icon纹理
            const atlas = vectorPack.data.iconAtlas = serializeAtlas(this.iconAtlas);
            if (atlas.glyphMap) {
                for (const p in atlas.glyphMap) {
                    const map = atlas.glyphMap[p];
                    buffers.push(map.data.data.buffer);
                }
            }
            buffers.push(vectorPack.data.iconAtlas.image.data.buffer);
        }

        if (this.glyphAtlas) {
            //文字纹理
            vectorPack.data.glyphAtlas = serializeAtlas(this.glyphAtlas);
            buffers.push(vectorPack.data.glyphAtlas.image.data.buffer);
        }
        return vectorPack;
    }

    createStyledVector(feature, symbol, fnTypes, options) {
        return new StyledVector(feature, symbol, fnTypes, options);
    }

    createDataPack(vectors, scale) {
        if (!vectors || !vectors.length) {
            return null;
        }
        this.maxIndex = 0;
        this.maxPos = 0;
        this.maxAltitude = 0;
        const data = this.data = {};
        let elements = this.elements = [];
        //uniforms: opacity, u_size_t

        const format = this.getFormat(Array.isArray(vectors[0]) ? vectors[0][0].symbol : vectors[0].symbol);
        const positionSize = this.needAltitudeAttribute() ? 2 : 3;
        for (let i = 0; i < format.length; i++) {
            data[format[i].name] = [];
        }
        //每个顶点的feature index, 用于构造 pickingId
        let feaIdxValues = [];
        let maxFeaIndex = 0;
        const featIds = [];
        let maxFeaId = 0;
        let hasNegative = false;
        for (let i = 0, l = vectors.length; i < l; i++) {
            if (!vectors[i].feature.geometry) {
                continue;
            }
            const feaId = Array.isArray(vectors[i]) ? vectors[i][0].feature.id : vectors[i].feature.id;
            if (isNumber(feaId)) {
                if (Math.abs(feaId) > maxFeaId) {
                    maxFeaId = Math.abs(feaId);
                }
                if (feaId < 0) {
                    hasNegative = true;
                }
            }
            const eleCount = this.data.aPosition.length;
            if (!Array.isArray(vectors[i])) {
                this._placeVector(vectors[i], scale);
            } else {
                for (let j = 0; j < vectors[i].length; j++) {
                    this._placeVector(vectors[i][j], scale);
                }
            }
            const count = (data.aPosition.length - eleCount) / positionSize;
            //fill feature index of every data
            for (let ii = 0; ii < count; ii++) {
                feaIdxValues.push(vectors[i].featureIdx);
                if (isNumber(feaId)) {
                    featIds.push(feaId);
                }
            }
            maxFeaIndex = Math.max(maxFeaIndex, vectors[i].featureIdx);
        }
        if (this.hasElements() && !elements.length) {
            return null;
        }
        const ArrType = getUnsignedArrayType(maxFeaIndex);
        feaIdxValues = new ArrType(feaIdxValues);

        if (this.options.positionType) {
            format[0].type = this.options.positionType;
        } else {
            //update aPosition's type
            format[0].type = getPosArrayType(this.maxPos);
        }
        const center = this.options.center;
        if (center && (center[0] || center[1])) {
            const aPosition = data.aPosition;
            for (let i = 0; i < aPosition.length; i += positionSize) {
                aPosition[i] -= center[0];
                aPosition[i + 1] -= center[1];
            }
        }

        const arrays = fillTypedArray(format, data);
        // aPickingId中存放的featureIdx，即 KEY_IDX 属性里的值
        arrays.aPickingId = feaIdxValues;

        //因为 IS_2D_POSITION 会导致program切换，2位aPosition和3位aPosition的性能变化不大，所以不再执行only2D逻辑
        // if (!this.maxAltitude) {
        //     //only2D
        //     const positions = new arrays.aPosition.constructor(arrays.aPosition.length * 2 / 3);
        //     for (let i = 0; i < positions.length; i += 2) {
        //         positions[i] = arrays.aPosition[i / 2 * 3];
        //         positions[i + 1] = arrays.aPosition[i / 2 * 3 + 1];
        //     }
        //     arrays.aPosition = positions;
        // }

        const buffers = [];
        for (const p in arrays) {
            buffers.push(arrays[p].buffer);
        }

        const ElementType = getIndexArrayType(this.maxIndex);
        elements = new ElementType(elements);
        buffers.push(elements.buffer);
        const result = {
            data: arrays,
            // format,
            indices: this.hasElements() ? elements : null,
            positionSize,
            buffers,
            symbolIndex: this.symbolDef.index || { index: 0 }
        };

        if (featIds.length) {
            const feaCtor = hasNegative ? getPosArrayType(maxFeaId) : getUnsignedArrayType(maxFeaId);
            // featureIds 里存放的是 feature.id
            result.featureIds = new feaCtor(featIds);
            buffers.push(result.featureIds.buffer);
        } else {
            result.featureIds = [];
        }

        return result;
    }

    _placeVector(vector, scale) {
        const properties = vector.feature.properties;
        if (this._visibleFn && this._visibleFn.isZoomConstant && !this._visibleFn(null, properties)) {
            return;
        }
        this.placeVector(vector, scale, this.formatWidth);
    }

    addElements(...e) {
        this.maxIndex = Math.max(this.maxIndex, ...e);
        this.elements.push(...e);
    }

    hasElements() {
        return true;
    }

    getAltitude(properties) {
        const { altitudeProperty, defaultAltitude, altitudeScale } = this.options;
        let altitude = getHeightValue(properties, altitudeProperty, defaultAltitude);
        if (altitudeScale) {
            altitude *= altitudeScale;
        }
        this.maxAltitude = Math.max(this.maxAltitude, Math.abs(altitude));
        return altitude;
    }

    getIconAtlasMaxValue() {
        const positions = this.iconAtlas.positions;
        let max = 0;
        for (const p in positions) {
            if (hasOwn(positions, p)) {
                const { tl, displaySize } = positions[p];
                //w/h - 1 是为了把256宽实际存为255，这样可以用Uint8Array来存储宽度为256的值
                const m = Math.max(tl[0], tl[1], displaySize[0] - 1, displaySize[1] - 1);
                if (m > max) {
                    max = m;
                }
            }
        }
        return max;
    }
}

function serializeAtlas(atlas) {
    let positions = atlas.positions;
    let format = atlas.image && atlas.image.format || 'alpha';
    if (atlas instanceof IconAtlas) {
        //iconAtlas中原属性用get方法实现，无法transfer，故遍历复制为普通对象
        positions = {};
        for (const p in atlas.positions) {
            const pos = atlas.positions[p];
            positions[p] = {
                paddedRect: pos.paddedRect,
                pixelRatio: pos.pixelRatio,
                tl: pos.tl,
                br: pos.br,
                displaySize: pos.displaySize
            };
        }
        format = 'rgba';
    }
    const image = atlas.image;
    return {
        image: {
            width: image.width,
            height: image.height,
            data: image.data,
            format
        },
        glyphMap: atlas.glyphMap,
        positions: positions
    };
}

function getMaxAltitude(geometry) {
    if (!geometry) {
        return 0;
    }
    let altitude = 0;
    if (Array.isArray(geometry)) {
        for (let i = 0; i < geometry.length; i++) {
            if (Array.isArray(geometry[i])) {
                const alt = getMaxAltitude(geometry[i]);
                if (alt > altitude) {
                    altitude = alt;
                }
            } else {
                const alt = Math.abs(geometry[i].z || 0);
                if (alt > altitude) {
                    altitude = alt;
                }
            }
        }
    } else {
        const alt = Math.abs(geometry.z || 0);
        if (alt > altitude) {
            altitude = alt;
        }
    }
    return altitude;
}

