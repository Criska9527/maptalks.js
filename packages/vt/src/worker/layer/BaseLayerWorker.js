import { extend, getIndexArrayType, compileStyle, isString, isObject, isNumber } from '../../common/Util';
import { buildWireframe, build3DExtrusion } from '../builder/';
import { PolygonPack, NativeLinePack, LinePack, PointPack, NativePointPack, LineExtrusionPack, CirclePack } from '@maptalks/vector-packer';
// import { GlyphRequestor } from '@maptalks/vector-packer';
import Promise from '../../common/Promise';
import { createFilter } from '@maptalks/feature-filter';
import { KEY_IDX } from '../../common/Constant';
// import Browser from '../util/Browser';

// let FONT_CANVAS;

export default class BaseLayerWorker {
    constructor(id, options, upload, tileCache, tileLoading) {
        this.id = id;
        this.options = options;
        this.upload = upload;
        this._compileStyle(options.style || []);
        this.requests = {};
        this._styleCounter = 0;
        this._cache = tileCache;
        this.loadings = tileLoading;
    }

    updateStyle(style, cb) {
        this.options.style = style;
        this._compileStyle(style || []);
        this._styleCounter++;
        cb();
    }

    updateOptions(options, cb) {
        this.options = extend(this.options, options);
        cb();
    }

    /**
     * Load a tile, paint and return gl directives
     * @param {Object} tileInfo  - tileInfo, xyz, res, extent, etc
     * @param {Function} cb - callback function when finished
     */
    loadTile(context, cb) {
        const loadings = this.loadings;
        const url = context.tileInfo.url;
        if (this._cache.has(url)) {
            const { features, layers } = this._cache.get(url);
            const waitings = loadings[url];
            delete loadings[url];
            if (!features.length) {
                cb();
                return;
            }
            if (waitings) {
                for (let i = 0; i < waitings.length; i++) {
                    this._onTileLoad.call(waitings[i].ref, context, waitings[i].callback, url, layers, features);
                }
            }
            this._onTileLoad(context, cb, url, layers, features);
            return;
        }
        if (loadings[url]) {
            loadings[url].push({
                callback: cb,
                ref: this
            });
            return;
        }
        loadings[url] = [{
            callback: cb,
            ref: this
        }];
        this.requests[url] = this.getTileFeatures(context.tileInfo, (err, features, layers) => {
            const waitings = loadings[url];
            delete loadings[url];
            if (this.checkIfCanceled(url)) {
                delete this.requests[url];
                this._callWaitings(waitings, null, { canceled: true });
                return;
            }
            delete this.requests[url];
            if (this.options.debug && features) {
                for (let i = 0; i < features.length; i++) {
                    features[i]['_debug_info'] = {
                        index: i,
                        tileId: context.tileInfo.id
                    };
                }
            }
            if (err) {
                if (!err.loading) {
                    this._cache.add(url, { features: [], layers: [] });
                }
                this._callWaitings(waitings, err);
                return;
            }
            if (!features || !features.length) {
                this._cache.add(url, { features: [], layers: [] });
                this._callWaitings(waitings);
                return;
            }
            this._cache.add(url, { features, layers });
            if (waitings) {
                for (let i = 0; i < waitings.length; i++) {
                    this._onTileLoad.call(waitings[i].ref, context, waitings[i].callback, url, layers, features);
                }
            }
        });

    }

    _onTileLoad(context, cb, url, layers, features) {
        // debugger
        this._createTileData(layers, features, context).then(data => {
            if (data.canceled) {
                cb(null, { canceled: true });
                return;
            }
            data.data.style = this._styleCounter;
            cb(null, data.data, data.buffers);
        });
    }

    abortTile(url, cb) {
        delete this.requests[url];
        this._cancelLoadings(url);
        cb();
    }

    _cancelLoadings(url) {
        const waitings = this.loadings[url];
        if (waitings) {
            for (let i = 0; i < waitings.length; i++) {
                waitings[i].callback(null, { canceled: true });
            }
        }
        delete this.loadings[url];
    }

    _callWaitings(waitings, err, data) {
        if (waitings) {
            for (let i = 0; i < waitings.length; i++) {
                waitings[i].callback(err, data);
            }
        }
    }

    checkIfCanceled(url) {
        return !this.requests[url];
    }

    fetchIconGlyphs(icons, glyphs, cb) {
        //2019-03-20 win10 chrome 74 64位，OffscreenCanvas fillText性能只有主线程的10%，还不可用
        // if (glyphs && Browser.offscreenCanvas) {
        //     this._glyphRequestor = new GlyphRequestor();
        //     this._glyphRequestor.getGlyphs(glyphs, cb);
        // } else {
        //command, params, buffers and callback
        this.upload('fetchIconGlyphs', { icons, glyphs }, null, cb);
        // }
    }

    _createTileData(layers, features, { glScale, zScale, tileInfo }) {
        if (!features.length) {
            return Promise.resolve({
                data: null,
                buffers: []
            });
        }
        const useDefault = !this.options.style.length;
        let pluginConfigs = this.pluginConfig;
        if (useDefault) {
            //图层没有定义任何style，通过数据动态生成pluginConfig
            pluginConfigs = this._updateLayerPluginConfig(layers);
        }
        const EXTENT = features[0].extent;
        const zoom = tileInfo.z,
            tilePoint = { x: tileInfo.point.x * glScale, y: tileInfo.point.y * glScale },
            data = [],
            pluginIndexes = [],
            options = this.options,
            buffers = [];
        const feaTags = {};
        const promises = [
            Promise.resolve(this._styleCounter)
        ];
        for (let i = 0; i < pluginConfigs.length; i++) {
            const pluginConfig = pluginConfigs[i];
            if (pluginConfig.symbol && pluginConfig.symbol.visible === false) {
                continue;
            }
            const { tileFeatures, tileFeaIndexes } = this._filterFeatures(pluginConfig.filter, features, feaTags, i);

            if (!tileFeatures.length) {
                continue;
            }
            const maxIndex = tileFeaIndexes[tileFeaIndexes.length - 1];
            const arrCtor = getIndexArrayType(maxIndex);
            data[i] = {
                //[feature_index, style_index, ...]
                styledFeatures: new arrCtor(tileFeaIndexes)
            };
            //index of plugin with data
            pluginIndexes.push(i);
            buffers.push(data[i].styledFeatures.buffer);
            let promise = this._createTileGeometry(tileFeatures, pluginConfig, { extent: EXTENT, tilePoint, glScale, zScale, zoom });
            if (useDefault) {
                promise = promise.then(tileData => {
                    if (!tileData) {
                        return null;
                    }
                    if (tileData.data) {
                        tileData.data.layer = tileFeatures[0].layer;
                    } else if (Array.isArray(tileData)) {
                        for (let i = 0; i < tileData.length; i++) {
                            if (tileData[i].data) tileData[i].data.layer = tileFeatures[0].layer;
                        }
                    }

                    return tileData;
                });
            }
            promises.push(promise);
        }

        return Promise.all(promises).then(([styleCount, ...tileDatas]) => {
            function handleTileData(tileData, i) {
                tileData.data.type = pluginConfigs[pluginIndexes[i]].renderPlugin.dataConfig.type;
                tileData.data.filter = pluginConfigs[pluginIndexes[i]].filter.def;

                if (tileData.buffers && tileData.buffers.length) {
                    for (let i = 0; i < tileData.buffers.length; i++) {
                        buffers.push(tileData.buffers[i]);
                    }
                }
            }
            if (styleCount !== this._styleCounter) {
                return { canceled: true };
            }

            for (let i = 0; i < tileDatas.length; i++) {
                if (!tileDatas[i]) {
                    continue;
                }
                const tileData = tileDatas[i];
                if (Array.isArray(tileData)) {
                    const datas = [];
                    for (let ii = 0; ii < tileData.length; ii++) {
                        if (!tileData[ii]) {
                            continue;
                        }
                        handleTileData(tileData[ii], i);
                        datas.push(tileData[ii].data);
                    }
                    if (datas.length) {
                        data[pluginIndexes[i]].data = datas;
                    }
                } else {
                    handleTileData(tileData, i);
                    data[pluginIndexes[i]].data = tileData.data;
                }

            }
            const allFeas = [];
            const schema = layers;
            if (options.features || options.schema) {
                let feature;
                for (let i = 0, l = features.length; i < l; i++) {
                    feature = features[i];
                    if (!schema[feature.layer].properties) {
                        schema[feature.layer].properties = getPropTypes(feature.properties);
                    }

                    if (options.features) {
                        //reset feature's marks
                        if (feature && feaTags[i]) {
                            if (options.features === 'id') {
                                allFeas.push(feature.id);
                            } else {
                                const o = extend({}, feature);
                                if (!options.pickingGeometry) {
                                    delete o.geometry;
                                }
                                delete o.extent;
                                allFeas.push(o);
                            }
                        } else {
                            //use '' instead of null, to reduce feature string size
                            allFeas.push('');
                        }
                    }
                }
            }
            return {
                data: {
                    schema,
                    data,
                    extent: EXTENT,
                    features: allFeas
                },
                buffers
            };
        });

    }

    _createTileGeometry(features, pluginConfig, context) {
        const dataConfig = pluginConfig.renderPlugin.dataConfig;
        const symbol = pluginConfig.symbol;

        const tileSize = this.options.tileSize[0];
        const { extent, glScale, zScale, zoom, tilePoint } = context;
        const tileRatio = extent / tileSize;
        const type = dataConfig.type;
        if (type === '3d-extrusion') {
            const t = hasTexture(symbol);
            if (t) {
                dataConfig.uv = 1;
                if (t === 2) {
                    dataConfig.tangent = 1;
                }
            }
            return Promise.resolve(build3DExtrusion(features, dataConfig, extent, tilePoint, glScale, zScale, this.options['tileSize'][1] / extent, symbol, zoom));
        } else if (type === '3d-wireframe') {
            return Promise.resolve(buildWireframe(features, dataConfig, extent));
        } else if (type === 'point') {
            const options = extend({}, dataConfig, {
                EXTENT: extent,
                requestor: this.fetchIconGlyphs.bind(this),
                zoom
            });
            const symbols = PointPack.splitPointSymbol(symbol);

            return Promise.all(symbols.map(symbol => new PointPack(features, symbol, options).load(tileRatio)));
            // const pack = new PointPack(features, symbol, options);
            // return pack.load(extent / tileSize);
        } else if (type === 'native-point') {
            const options = extend({}, dataConfig, {
                EXTENT: extent,
                zoom
            });
            const pack = new NativePointPack(features, symbol, options);
            return pack.load(extent / tileSize);
        } else if (type === 'line') {
            const options = extend({}, dataConfig, {
                EXTENT: extent,
                requestor: this.fetchIconGlyphs.bind(this),
                tileRatio,
                zoom
            });
            const pack = new LinePack(features, symbol, options);
            return pack.load();
        } else if (type === 'native-line') {
            const options = extend({}, dataConfig, {
                EXTENT: extent,
                zoom
            });
            const pack = new NativeLinePack(features, symbol, options);
            return pack.load();
        } else if (type === 'fill') {
            const options = extend({}, dataConfig, {
                EXTENT: extent,
                requestor: this.fetchIconGlyphs.bind(this),
                zoom
            });
            const pack = new PolygonPack(features, symbol, options);
            return pack.load();
        } else if (type === 'line-extrusion') {
            //line-extrusion 不需要 lineGradientProperty 属性，以免错误的把linesofar转化到了 0-2^15
            delete symbol['lineGradientProperty'];
            symbol['lineJoin'] = 'miter';
            symbol['lineCap'] = 'butt';
            const t = hasTexture(symbol);
            if (t) {
                dataConfig.uv = 1;
                if (t === 2) {
                    dataConfig.tangent = 1;
                }
            }
            const options = extend({}, dataConfig, {
                EXTENT: extent,
                tileSize,
                zScale,
                glScale,
                zoom
            });
            const pack = new LineExtrusionPack(features, symbol, options);
            return pack.load();
        } else if (type === 'circle') {
            const options = extend({}, dataConfig, {
                EXTENT: extent,
                zoom
            });
            const pack = new CirclePack(features, symbol, options);
            return pack.load();
        }
        return Promise.resolve({
            data: {},
            buffers: null
        });
    }

    /**
     * Filter
     * @param {*} filter
     * @param {*} features
     */
    _filterFeatures(filter, features, tags) {
        const indexes = [];
        const filtered = [];
        const l = features.length;
        for (let i = 0; i < l; i++) {
            //filter.def没有定义，或者为default时，说明其实默认样式，feature之前没有其他样式时的应用样式
            if ((!filter.def || filter.def === 'default') && !tags[i] ||
                (filter.def === true || Array.isArray(filter.def) && filter(features[i]))) {
                tags[i] = 1;
                const fea = extend({}, features[i]);
                fea[KEY_IDX] = i;
                filtered.push(fea);
                indexes.push(i);
            }
        }
        return {
            tileFeatures: filtered,
            tileFeaIndexes: indexes
        };
    }

    _compileStyle(layerStyle) {
        this.pluginConfig = compileStyle(layerStyle);
        for (let i = 0; i < layerStyle.length; i++) {
            if (this.pluginConfig[i].filter) {
                this.pluginConfig[i].filter.def = layerStyle[i].filter ? (layerStyle[i].filter.value || layerStyle[i].filter) : undefined;
            }
        }
    }

    _updateLayerPluginConfig(layers) {
        let layerPlugins = this._layerPlugins;
        if (!this._layerPlugins) {
            layerPlugins = this._layerPlugins = {};
        }
        const TYPES = [
            '',
            'Point',
            'LineString',
            'Polygon',
            'MultiPoint',
            'MultiLineString',
            'MultiPolygon'
        ];
        const framePlugins = [];
        for (const p in layers) {
            const layer = p;
            if (!layerPlugins[p]) {
                const stylePlugins = [];
                for (let i = 0; i < layers[p].types.length; i++) {
                    const type = layers[p].types[i];
                    const def = ['all', ['==', '$layer', layer], ['==', '$type', TYPES[type]]];
                    const plugin = {
                        filter: createFilter(def),
                        renderPlugin: getDefaultRenderPlugin(type),
                        symbol: getDefaultSymbol(type)
                    };
                    plugin.filter.def = def;
                    stylePlugins.push(plugin);
                }
                layerPlugins[layer] = stylePlugins;
            }
            // const type = Math.min(...layers[p].types);
            // if (!layerPlugins[layer]) {
            //     const def = ['==', '$layer', layer];
            //     layerPlugins[layer] = {
            //         filter: createFilter(def),
            //         renderPlugin: getDefaultRenderPlugin(type),
            //         symbol: getDefaultSymbol(type)
            //     };
            //     layerPlugins[layer].filter.def = def;
            // }
            framePlugins.push(...layerPlugins[layer]);
        }
        return framePlugins;
    }
}

// LayerWorker.prototype.getProjViewMatrix = function (transform) {
//     const m = new Float64Array(16);
//     const m1 = new Float32Array(16);
//     return function (tileInfo, matrix) {
//         const tilePos = tileInfo.point;
//         const tileSize = this.tileSize;

//         const tileMatrix = mat4.identity(m);
//         mat4.translate(tileMatrix, tileMatrix, [tilePos.x, tilePos.y, 0]);
//         mat4.scale(tileMatrix, tileMatrix, [tileSize[0] / EXTENT, tileSize[1] / EXTENT, 1]);

//         //local transform in current frame
//         if (transform) {
//             mat4.multiply(tileMatrix, tileMatrix, transform);
//         }

//         mat4.multiply(tileMatrix, matrix, tileMatrix);

//         return mat4.copy(m1, tileMatrix);
//     };
// }();

function getDefaultRenderPlugin(type) {
    switch (type) {
    case 1:
        return {
            type: 'native-point',
            dataConfig: {
                type: 'native-point',
                only2D: true
            }
        };
    case 2:
        return {
            type: 'native-line',
            dataConfig: {
                type: 'native-line',
                only2D: true
            }
        };
    case 3:
        return {
            type: 'fill',
            dataConfig: {
                type: 'fill',
                only2D: true
            }
        };
    }
    return null;
}


function getDefaultSymbol(type) {
    switch (type) {
    case 1:
        return {
            markerFill: '#f00',
            markerSize: 10
        };
    case 2:
        return {
            lineColor: '#fff'
        };
    case 3:
        return {
            polygonFill: '#00f',
            polygonOpacity: 0.4
        };
    }
    return null;
}

function getPropTypes(properties) {
    if (Array.isArray(properties) || !isObject(properties)) {
        return {};
    }
    const types = {};
    for (const p in properties) {
        const v = properties[p];
        if (isString(v)) {
            types[p] = 'string';
        } else if (isNumber(v)) {
            types[p] = 'number';
        } else if (v === true || v === false) {
            types[p] = 'boolean';
        } else if (Array.isArray(v)) {
            types[p] = 'array';
        } else {
            types[p] = 'object';
        }
    }
    return types;
}

function hasTexture(symbol) {
    if (!symbol) {
        return 0;
    }
    let t = 0;
    for (const p in symbol) {
        if (p === 'normalTexture') {
            return 2;
        } else if (p.indexOf('Texture') > 0) {
            t = 1;
        } else if (isObject(symbol[p])) {
            const t0 = hasTexture(symbol[p]);
            if (t0 === 2) {
                return t0;
            } else if (t0 === 1) {
                t = 1;
            }
        }
    }
    return t;
}
