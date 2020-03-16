import * as maptalks from 'maptalks';
import VectorTileLayerRenderer from '../renderer/VectorTileLayerRenderer';
import { extend, compileStyle, isNil, isString, isObject } from '../../common/Util';
import { compress, uncompress } from './Compress';
import Ajax from '../../worker/util/Ajax';
import { isFunctionDefinition } from '@maptalks/function-type';

const URL_PATTERN = /(\{\$root\}|\{\$iconset\})/g;

const defaultOptions = {
    renderer: 'gl',
    fadeAnimation: false,
    altitudeProperty: 'altitude',
    forceRenderOnZooming: true,
    forceRenderOnMoving: true,
    forceRenderOnRotating: true,
    clipByPitch: false,
    zoomBackground: true,
    tileSize: [512, 512],
    tileSystem: [1, -1, -6378137 * Math.PI, 6378137 * Math.PI],
    stencil: false,
    features: true,
    schema: false,
    cascadeTiles: true,
    collision: true,
    picking: true,
    pickingPoint: false,
    pickingGeometry: false,
    //每帧每个瓦片最多能绘制的sdf数量
    glyphSdfLimitPerFrame: 15,
    //zooming或zoom fading时，每个瓦片最多能绘制的box(icon或text)数量
    boxLimitOnZoomout: 7,
    background: [0, 0, 0, 0],
    maxCacheSize: 72,
    antialias: false,
    iconErrorUrl: null,
    collisionFrameLimit: 1,
    //是否开启无style时的默认绘制功能
    defaultRendering: true,
    //是否限制每帧的 tile mesh creation
    tileMeshCreationLimitPerFrame: 0,
    workarounds: {
        //#94, text rendering crashes on windows with intel gpu
        'win-intel-gpu-crash': true
    }
};

/**
 * Style:
 * [
 *  {
 *     renderPlugin : { ... },
 *     filter : [],
 *     symbol : { ... }
 *  }
 * ]
 */
class VectorTileLayer extends maptalks.TileLayer {

    constructor(id, options) {
        super(id, options);
        this.VERSION = VectorTileLayer.VERSION;
        const style = options && options.style || [];
        this.setStyle(style);
    }

    onConfig(conf) {
        const renderer = this.getRenderer();
        if (renderer) {
            renderer.updateOptions(conf);
        }
    }

    getWorkerOptions() {
        const map = this.getMap();
        return {
            debug: this.options['debug'],
            altitudeProperty: this.options['altitudeProperty'],
            tileSize: this.options['tileSize'],
            baseRes: map.getResolution(map.getGLZoom()),
            //default render时，this._vtStyle有可能被default render设值
            style: this.isDefaultRender() ? [] : !Array.isArray(this._vtStyle) ? [] : this._vtStyle,
            features: this.options.features,
            schema: this.options.schema,
            pickingGeometry: this.options['pickingGeometry']
        };
    }

    setStyle(style) {
        if (isString(style)) {
            const url = style;
            const endIndex = url.lastIndexOf('/');
            const prefix = endIndex < 0 ? '.' : url.substring(0, endIndex);
            const root = prefix;
            this.ready = false;
            Ajax.getJSON(url, (err, json) => {
                if (err) {
                    this.setStyle([]);
                    throw err;
                }
                this.setStyle({
                    $root: root,
                    style: json
                });
            });
            return this;
        }
        this.options['style'] = style;
        if (style['$root'] || style['$iconset']) {
            let root;
            let iconset;
            root = this._styleRootPath = style['$root'];
            iconset = this._styleRootPath = style['$iconset'];
            if (root && root[root.length - 1] === '/') {
                root = root.substring(0, root.length - 1);
            }
            if (iconset && iconset[iconset.length - 1] === '/') {
                iconset = iconset.substring(0, iconset.length - 1);
            }
            this._replacer = function replacer(match) {
                if (match === '{$root}') {
                    return root;
                } else if (match === '{$iconset}') {
                    return iconset;
                }
                return null;
            };
        }
        this.ready = true;
        if (!Array.isArray(style) && !style.plugins) {
            //有plugins说明是个compressed style
            style = style.style || [];
        }
        style = JSON.parse(JSON.stringify(style));
        style = uncompress(style);
        this._vtStyle = style;
        this.validateStyle();
        if (this._replacer) {
            this._parseStylePath();
        }
        this._compileStyle();
        const renderer = this.getRenderer();
        if (renderer) {
            renderer.setStyle();
        }
        /**
         * setstyle event.
         *
         * @event VectorTileLayer#setstyle
         * @type {Object}
         * @property {String} type - setstyle
         * @property {VectorTileLayer} target - layer
         * @property {Object|Object[]} style - style to set
         */
        this.fire('setstyle', {
            'style': this.getStyle(),
            'computedStyle': this.getComputedStyle()
        });
        return this;
    }

    getPolygonOffsetCount() {
        const renderer = this.getRenderer();
        if (!renderer) {
            return 0;
        }
        return renderer.plugins && renderer.plugins.length || 0;
    }

    getPolygonOffset() {
        return this._polygonOffset || 0;
    }

    setPolygonOffset(offset, total) {
        this._polygonOffset = offset;
        this._totalPolygonOffset = total;
        return this;
    }

    getTotalPolygonOffset() {
        return this._totalPolygonOffset;
    }

    highlight(picked, color) {
        const renderer = this.getRenderer();
        if (!renderer) {
            return this;
        }
        renderer.highlight(picked, color);
        return this;
    }

    highlightBatch(idx, color) {
        const renderer = this.getRenderer();
        if (!renderer) {
            return this;
        }
        renderer.highlightBatch(idx, color);
        return this;
    }

    cancelHighlight() {
        const renderer = this.getRenderer();
        if (!renderer) {
            return this;
        }
        renderer.cancelHighlight();
        return this;
    }

    _parseStylePath() {
        const styles = this._vtStyle;
        for (let i = 0; i < styles.length; i++) {
            const { symbol } = styles[i];
            if (symbol) {
                this._parseSymbolPath(symbol);
            }
        }
    }

    _parseSymbolPath(symbol) {
        for (const p in symbol) {
            if (symbol.hasOwnProperty(p) && p !== 'textName') {
                if (isString(symbol[p]) && symbol[p].length > 2) {
                    symbol[p] = symbol[p].replace(URL_PATTERN, this._replacer);
                } else if (isFunctionDefinition(symbol[p])) {
                    symbol[p] = this._parseStops(symbol[p]);
                } else if (isObject(symbol[p])) {
                    this._parseSymbolPath(symbol[p]);
                }
            }
        }
    }

    _parseStops(value) {
        const defaultValue = value['default'];
        if (isString(defaultValue)) {
            value['default'] = defaultValue.replace(URL_PATTERN, this._replacer);
        }
        const stops = value.stops;
        for (let i = 0; i < stops.length; i++) {
            if (!Array.isArray(stops[i])) {
                continue;
            }
            if (isString(stops[i][1])) {
                stops[i][1] = stops[i][1].replace(URL_PATTERN, this._replacer);
            } else if (isFunctionDefinition(stops[i][1])) {
                stops[i][1] = this._parseStops(stops[i][1]);
            }
        }
        return value;
    }

    updateSceneConfig(idx, sceneConfig) {
        extend(this._vtStyle[idx].renderPlugin.sceneConfig, sceneConfig);
        if (Array.isArray(this.options.style)) {
            extend(this.options.style[idx].renderPlugin.sceneConfig, sceneConfig);
        } else if (this.options.style && Array.isArray(this.options.style.style)) {
            extend(this.options.style.style[idx].renderPlugin.sceneConfig, sceneConfig);
        }

        const renderer = this.getRenderer();
        if (renderer) {
            renderer.updateSceneConfig(idx, sceneConfig);
        }
        return this;
    }

    updateSymbol(idx, symbol) {
        const style = this._vtStyle[idx];
        if (!style) {
            throw new Error(`No style defined at ${idx}`);
        }
        if (this._replacer) {
            symbol = JSON.parse(JSON.stringify(symbol));
            this._parseSymbolPath(symbol);
        }
        const self = this;
        const target = style.symbol;
        function update() {
            for (const p in symbol) {
                if (symbol.hasOwnProperty(p)) {
                    if (maptalks.Util.isObject(symbol[p]) && !symbol[p].stops) {
                        //对象类型的属性则extend
                        if (!target[p]) {
                            target[p] = {};
                        }
                        extend(target[p], symbol[p]);
                    } else {
                        target[p] = symbol[p];
                    }
                }
            }
            let styles = self.options.style;
            if (!Array.isArray(styles)) {
                styles = styles.style;
            }
            styles[idx].symbol = JSON.parse(JSON.stringify(target));
        }

        const renderer = this.getRenderer();
        if (!renderer) {
            //layer还没有渲染，直接更新style并返回
            update();
            this._compileStyle();
            return this;
        }
        const props = Object.keys(symbol);
        let needRefresh = false;
        for (let i = 0; i < props.length; i++) {
            const key = props[i];
            if (isPropFunction(target[key]) || isPropFunction(symbol[key])) {
                needRefresh = true;
                break;
            }
        }

        update();

        if (needRefresh) {
            this.setStyle(this._vtStyle);
        } else {
            this._compileStyle();
            renderer.updateSymbol(idx, symbol);
        }
        this.fire('updatesymbol', { index: idx, symbol });
        return this;
    }

    isDefaultRender() {
        return !!this._isDefaultRender && this.options['defaultRendering'];
    }

    validateStyle() {
        this._isOnly2D = true;
        this._isDefaultRender = false;
        let styles = this._vtStyle;
        if (!styles || Array.isArray(styles) && !styles.length) {
            this._isDefaultRender = true;
            styles = this._vtStyle = [];
        }
        if (!Array.isArray(styles)) {
            styles = this._vtStyle = [styles];
        }
        for (let i = 0; i < styles.length; i++) {
            let filter = styles[i].filter;
            if (filter && filter.value) {
                filter = filter.value;
            }
            if (filter !== undefined &&
                filter !== 'default' &&
                filter !== true &&
                !Array.isArray(filter)) {
                throw new Error(`Invalid filter at ${i} : ${JSON.stringify(filter)}`);
            }
            const dataConfig = styles[i].renderPlugin.dataConfig;
            if (!dataConfig['only2D']) {
                this._isOnly2D = false;
            }
            //TODO 如果定义了renderPlugin就必须定义symbol
        }
    }

    getStyle() {
        return JSON.parse(JSON.stringify(this.options.style));
    }

    getComputedStyle() {
        return JSON.parse(JSON.stringify(this._vtStyle));
    }

    _getComputedStyle() {
        return this._vtStyle;
    }

    isOnly2D() {
        return this._isOnly2D;
    }

    getCompiledStyle() {
        return this._compiledStyles || [];
    }

    identify(coordinate, options = {}) {
        const map = this.getMap();
        const renderer = this.getRenderer();
        if (!map || !renderer) {
            return [];
        }
        const cp = map.coordToContainerPoint(new maptalks.Coordinate(coordinate));
        return renderer.pick(cp.x, cp.y, options);
    }

    /**
     * A separate collision index for background tiles
     * To avoid conflict with current zoom's tiles
     * @returns {CollisionIndex}
     */
    getBackgroundCollisionIndex() {
        if (!this._bgCollisionIndex) {
            this._bgCollisionIndex = new maptalks.CollisionIndex();
        }
        return this._bgCollisionIndex;
    }

    /**
     * Clear layer's background tiles collision index.
     */
    clearBackgroundCollisionIndex() {
        if (this._bgCollisionIndex) {
            this._bgCollisionIndex.clear();
        }
        return this;
    }

    /**
     * Return vector tile data's schema, including layers, properties, data types
     * Will return all zoom's schema if z is undefined
     * @param {Number} [z=undefined] - tile's zoom, optional
     * @returns {Object} data schema
     */
    getDataSchema(z) {
        if (!this._schema) {
            this._schema = {};
        }
        if (!isNil(z) && !this._schema[z]) {
            this._schema[z] = {};
        }
        if (isNil(z)) {
            return this._schema;
        }
        return this._schema[z];
    }

    onRemove() {
        super.onRemove();
    }

    static fromJSON(layerJSON) {
        if (!layerJSON || layerJSON['type'] !== 'VectorTileLayer') {
            return null;
        }

        return new VectorTileLayer(layerJSON['id'], layerJSON['options']);
    }

    _compileStyle() {
        const styles = this._vtStyle;
        if (!styles) {
            return;
        }
        this._compiledStyles = compileStyle(styles);
    }

    static registerPlugin(Plugin) {
        if (!VectorTileLayer.plugins) {
            VectorTileLayer.plugins = {};
        }
        VectorTileLayer.plugins[Plugin.type] = Plugin;
    }

    static getPlugins() {
        return VectorTileLayer.plugins || {};
    }

    static compressStyleJSON(json) {
        if (!Array.isArray(json) || !json.length) {
            return json;
        }

        return compress(json);
    }

}

VectorTileLayer.prototype['_getTileZoom'] = function (zoom) {
    zoom = Math.floor(zoom);
    const maxZoom = this.options['maxAvailableZoom'];
    if (!isNil(maxZoom) && zoom > maxZoom) {
        zoom = maxZoom;
    }
    return zoom;
};


VectorTileLayer.registerJSONType('VectorTileLayer');

VectorTileLayer.mergeOptions(defaultOptions);

VectorTileLayer.registerRenderer('gl', VectorTileLayerRenderer);
VectorTileLayer.registerRenderer('canvas', null);

export default VectorTileLayer;

function isPropFunction(v) {
    return !!(v && v.properties);
}
