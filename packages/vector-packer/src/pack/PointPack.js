import VectorPack from './VectorPack';
import StyledPoint from './StyledPoint';
import { getPointAnchors } from './util/get_point_anchors.js';
import { getGlyphQuads, getIconQuads, getEmptyIconQuads } from './util/quads';
import { allowsVerticalWritingMode } from './util/script_detection';
import { isOut, isNil, wrap, isString } from './util/util';
import mergeLines from './util/merge_lines';
import { isFunctionDefinition } from '@maptalks/function-type';
import { normalizeColor } from '../style/Util';

const DEFAULT_SPACING = 250;
const DEFAULT_UNIFORMS = {
    'textFill': [0, 0, 0, 1],
    'textOpacity': 1,
    'textPitchAlignment': 0,
    'textRotationAlignment': 0,
    'textHaloRadius': 0,
    'textHaloFill': [1, 1, 1, 1],
    'textHaloBlur': 0,
    'textHaloOpacity': 1,
    'textPerspectiveRatio': 0,
    'textSize': 14,
    'textDx': 0,
    'textDy': 0,
    'textRotation': 0
};

const IDX_PROP = '__index';

/**
 * 点类型数据，负责输入feature和symbol后，生成能直接赋给shader的arraybuffer
 * 设计上能直接在worker中执行
 * 其执行过程：
 * 1. 解析features（ vt 格式或 geojson ）
 * 2. 根据 symbol 设置，设置每个 feature 的 symbol，生成 StyledFeature
 * 3. 遍历 SymbolFeature，生成绘制数据，例如 anchor，glyph 或 icon，旋转角度等
 * 4. 将3中的数据生成 arraybuffer ，如果是动态绘制，则生成基础绘制数据 ( arraybuffer )
 *   4.1 symbol 变化时，则重新生成3中的绘制数据，并重新生成 arraybuffer
 */
export default class PointPack extends VectorPack {

    static needMerge(symbolDef, fnTypes, zoom) {
        if (!symbolDef) {
            return false;
        }
        let isLinePlacement = symbolDef['textPlacement'] === 'line' || symbolDef['markerPlacement'] === 'line';
        if (!isLinePlacement) {
            if (fnTypes['textPlacementFn']) {
                isLinePlacement = fnTypes['textPlacementFn'](zoom) === 'line';
            }
            if (fnTypes['markerPlacementFn']) {
                isLinePlacement = fnTypes['markerPlacementFn'](zoom) === 'line';
            }
        }
        return symbolDef['mergeOnProperty'] && isLinePlacement;
    }

    static mergeLineFeatures(features, symbolDef, fnTypes, zoom) {
        const keyName = (IDX_PROP + '').trim();
        let textPlacement = symbolDef['textPlacement'];
        let markerPlacement = symbolDef['markerPlacement'];
        if (fnTypes['textPlacementFn']) {
            textPlacement = fnTypes['textPlacementFn'](zoom);
        }
        if (fnTypes['markerPlacementFn']) {
            markerPlacement = fnTypes['markerPlacementFn'](zoom);
        }
        const merging = getFeauresToMerge(features, symbolDef, markerPlacement, textPlacement, zoom);
        if (merging.length) {
            const result = [];
            for (let i = 0; i < merging.length; i++) {
                if (!merging[i].property) {
                    result.push(features);
                } else {
                    result.push(mergeLines(merging[i].features, merging[i].property));
                }
            }
            if (result.length === 1) {
                return result[0];
            } else {
                let mergedFeatures = [];
                for (let i = 0; i < result.length; i++) {
                    mergedFeatures = mergedFeatures.concat(result[i]);
                }
                mergedFeatures.sort((a, b) => {
                    return a[keyName] - b[keyName];
                });
                return mergedFeatures;
            }
        }
    }

    static splitPointSymbol(symbol, idx = 0) {
        const results = [];
        if (Array.isArray(symbol)) {
            const symbols = symbol;
            for (let i = 0; i < symbols.length; i++) {
                if (!symbols[i]) {
                    continue;
                }
                results.push(...PointPack.splitPointSymbol(symbols[i], i));
            }
            return results;
        }
        let iconSymbol = null;
        let textSymbol = null;
        for (const name in symbol) {
            if (name.indexOf('marker') === 0) {
                iconSymbol = iconSymbol || {};
                iconSymbol[name] = symbol[name];
            } else if (name.indexOf('text') === 0) {
                textSymbol = textSymbol || {};
                textSymbol[name] = symbol[name];
            }
        }
        if (iconSymbol) {
            iconSymbol['isIconText'] = true;
            if (symbol['mergeOnProperty']) {
                iconSymbol['mergeOnProperty'] = symbol['mergeOnProperty'];
            }
            results.push(iconSymbol);
        }
        if (textSymbol) {
            if (iconSymbol) {
                //用marker的placement和spacing 覆盖文字的
                textSymbol['textPlacement'] = iconSymbol['markerPlacement'];
                textSymbol['textSpacing'] = iconSymbol['markerSpacing'];
                textSymbol['isIconText'] = true;
            }
            if (symbol['mergeOnProperty']) {
                textSymbol['mergeOnProperty'] = symbol['mergeOnProperty'];
            }

            results.push(textSymbol);
        }
        if (symbol['visible'] !== undefined) {
            if (iconSymbol) {
                iconSymbol['visible'] = symbol['visible'];
            }
            if (textSymbol) {
                textSymbol['visible'] = symbol['visible'];
            }
        }
        if (iconSymbol) {
            if (iconSymbol.markerTextFit && textSymbol) {
                // 存在markerTextFit时，需要根据textSize和text长度实时计算marker高宽，所以需要保存下面的信息
                iconSymbol.text = {};
                iconSymbol.text.textName = textSymbol.textName;
                iconSymbol.text.textSize = textSymbol.textSize;
            }
            iconSymbol.index = {
                index: idx,
                type: 0
            };
        }
        if (textSymbol) {
            textSymbol.index = {
                index: idx,
                type: 1
            };
        }
        return results;
    }

    static isAtlasLoaded(iconGlyph, atlas) {
        const { icon, glyph } = iconGlyph;
        const { iconAtlas, glyphAtlas } = atlas;
        if (icon) {
            if (!iconAtlas || !iconAtlas.positions[icon.url]) {
                return false;
            }
        }
        if (glyph) {
            if (!glyphAtlas || !glyphAtlas.positions[glyph.font]) {
                return false;
            }
            const fontGlphy = glyphAtlas.positions[glyph.font];
            const { text } = glyph;
            for (let i = 0; i < text.length; i++) {
                if (!fontGlphy[text.charCodeAt(i)]) {
                    return false;
                }
            }
        }
        return true;
    }

    constructor(features, symbol, options) {
        super(features, symbol, options);
        this._textPlacement = symbol['textPlacement'];
        if (this._fnTypes['textPlacementFn']) {
            this._textPlacement = this._fnTypes['textPlacementFn'](this.options.zoom);
        }
    }

    createStyledVector(feature, symbol, fnTypes, options, iconReqs, glyphReqs) {
        //每个point的icon和text
        const point = new StyledPoint(feature, this.symbolDef, symbol, fnTypes, options);
        const iconGlyph = point.getIconAndGlyph();
        if (iconGlyph.icon && !this.options['atlas']) {
            const { url, size } = iconGlyph.icon;
            // 有时请求同一个图片时，尺寸不同 (例如有 markerTextFit 时)，只保存最大的尺寸
            if (!iconReqs[url]) {
                iconReqs[url] = iconGlyph.icon.size;
            }
            if (iconReqs[url][0] < size[0]) {
                iconReqs[url][0] = size[0];
            }
            if (iconReqs[url][1] < size[1]) {
                iconReqs[url][1] = size[1];
            }
        }
        if (iconGlyph.glyph && !this.options['atlas']) {
            const { font, text } = iconGlyph.glyph;
            const fontGlphy = glyphReqs[font] = glyphReqs[font] || {};
            for (let i = 0; i < text.length; i++) {
                fontGlphy[text.charCodeAt(i)] = 1;
                //TODO mapbox-gl 这里对 vertical 字符做了特殊处理
            }
            if (this._textPlacement === 'line') {
                //isCharsCompact是指英文等字符需要适当缩小间隔，让文字更紧凑
                //但placement为line时，为解决intel gpu的崩溃问题需开启stencil，所以不能缩小间隔，否则会出现文字的削边问题
                glyphReqs.options = { isCharsCompact: false };
            }
        }
        if (!this.options['allowEmptyPack'] && !iconGlyph.icon && !iconGlyph.glyph) {
            return null;
        }
        return point;
    }

    getFormat(symbol) {
        const isText = symbol['textName'] !== undefined;
        const format = isText ? this.getPackSDFFormat(symbol) : this.getPackMarkerFormat();
        if (isText) {
            format.push(...this._getTextFnTypeFormats());
        } else {
            format.push(...this._getMarkerFnTypeFormats());
        }
        const { markerOpacityFn, textOpacityFn, markerPitchAlignmentFn, textPitchAlignmentFn,
            markerRotationAlignmentFn, textRotationAlignmentFn, markerRotationFn, textRotationFn,
            markerAllowOverlapFn, textAllowOverlapFn, markerIgnorePlacementFn, textIgnorePlacementFn } = this._fnTypes;
        if (markerOpacityFn || textOpacityFn) {
            format.push({
                type: Uint8Array,
                width: 1,
                name: 'aColorOpacity'
            });
        }
        if (markerPitchAlignmentFn || textPitchAlignmentFn) {
            format.push({
                type: Uint8Array,
                width: 1,
                name: 'aPitchAlign'
            });
        }
        if (markerRotationAlignmentFn || textRotationAlignmentFn) {
            format.push({
                type: Uint8Array,
                width: 1,
                name: 'aRotationAlign'
            });
        }
        if (markerRotationFn || textRotationFn) {
            format.push({
                type: Uint16Array,
                width: 1,
                name: 'aRotation'
            });
        }
        if (markerAllowOverlapFn || textAllowOverlapFn || markerIgnorePlacementFn || textIgnorePlacementFn) {
            format.push({
                type: Uint8Array,
                width: 1,
                name: 'aOverlap'
            });
        }
        return format;
    }

    _is3DPitchText() {
        return this.hasMapPitchAlign;
    }

    _getTextFnTypeFormats() {
        const { textFillFn, textSizeFn, textHaloFillFn, textHaloRadiusFn, textHaloOpacityFn, textDxFn, textDyFn } = this._fnTypes;
        const formats = [];
        if (textFillFn) {
            formats.push({
                type: Uint8Array,
                width: 4,
                name: 'aTextFill'
            });
        }
        if (textSizeFn) {
            formats.push({
                type: Uint8Array,
                width: 1,
                name: 'aTextSize'
            });
        }
        if (textHaloFillFn) {
            formats.push({
                type: Uint8Array,
                width: 4,
                name: 'aTextHaloFill'
            });
        }
        if (textHaloRadiusFn) {
            formats.push({
                type: Uint8Array,
                width: 1,
                name: 'aTextHaloRadius'
            });
        }
        if (textHaloOpacityFn) {
            formats.push({
                type: Uint8Array,
                width: 1,
                name: 'aTextHaloOpacity'
            });
        }
        if (textDxFn) {
            formats.push({
                type: Int8Array,
                width: 1,
                name: 'aTextDx'
            });
        }
        if (textDyFn) {
            formats.push({
                type: Int8Array,
                width: 1,
                name: 'aTextDy'
            });
        }
        return formats;
    }

    _getMarkerFnTypeFormats() {
        const { markerWidthFn, markerHeightFn, markerDxFn, markerDyFn } = this._fnTypes;
        const formats = [];
        if (markerWidthFn) {
            formats.push({
                type: Uint8Array,
                width: 1,
                name: 'aMarkerWidth'
            });
        }
        if (markerHeightFn) {
            formats.push({
                type: Uint8Array,
                width: 1,
                name: 'aMarkerHeight'
            });
        }
        if (markerDxFn) {
            formats.push({
                type: Int8Array,
                width: 1,
                name: 'aMarkerDx'
            });
        }
        if (markerDyFn) {
            formats.push({
                type: Int8Array,
                width: 1,
                name: 'aMarkerDy'
            });
        }

        return formats;
    }

    createDataPack() {
        if (!this.iconAtlas && !this.glyphAtlas) {
            if (!this.options['allowEmptyPack']) {
                return null;
            } else {
                this.empty = true;
            }
        }
        this.lineVertex = [];
        const pack = super.createDataPack.apply(this, arguments);
        if (!pack) {
            return null;
        }
        pack.lineVertex = new Int16Array(this.lineVertex);
        pack.buffers.push(pack.lineVertex.buffer);
        return pack;
    }

    placeVector(point, scale) {
        const shape = point.getShape(this.iconAtlas, this.glyphAtlas);
        if (!this.options['allowEmptyPack'] && !shape) {
            return;
        }
        const anchors = this._getAnchors(point, shape, scale);
        const count = anchors.length;
        if (count === 0) {
            return;
        }
        const data = this.data;
        const positionSize = this.needAltitudeAttribute() ? 2 : 3;
        let currentIdx = this.data.aPosition.length / positionSize;
        // const minZoom = this.options.minZoom,
        //     maxZoom = this.options.maxZoom;
        const symbol = point.symbol;
        const properties = point.feature.properties;
        // const size = point.size;
        const alongLine = this._textPlacement === 'line' && !symbol['isIconText'];
        const isText = symbol['textName'] !== undefined;
        const isVertical = isText && alongLine && allowsVerticalWritingMode(point.getIconAndGlyph().glyph.text) ? 1 : 0;
        const { textFillFn, textSizeFn, textHaloFillFn, textHaloRadiusFn, textHaloOpacityFn, textDxFn, textDyFn,
            textPitchAlignmentFn, textRotationAlignmentFn, textRotationFn,
            textAllowOverlapFn, textIgnorePlacementFn,
            textOpacityFn,
            markerWidthFn, markerHeightFn, markerDxFn, markerDyFn,
            markerPitchAlignmentFn, markerRotationAlignmentFn, markerRotationFn,
            markerAllowOverlapFn, markerIgnorePlacementFn,
            markerOpacityFn
        } = this._fnTypes;

        let quads;
        let textFill, textSize, textHaloFill, textHaloRadius, textHaloOpacity, textDx, textDy;
        let markerWidth, markerHeight, markerDx, markerDy;
        let pitchAlign, rotateAlign, rotation;
        let allowOverlap, ignorePlacement;
        if (isText) {
            const font = point.getIconAndGlyph().glyph.font;
            quads = getGlyphQuads(shape.horizontal, alongLine, this.glyphAtlas.positions[font]);
            //function type data
            if (textFillFn) {
                textFill = textFillFn(null, properties);
                if (isFunctionDefinition(textFill)) {
                    // 说明是identity返回的仍然是个fn-type，fn-type-util.js中会计算刷新，这里不用计算
                    textFill = [0, 0, 0, 0];
                } else {
                    textFill = normalizeColor(textFill);
                }
            }
            if (textSizeFn) {
                textSize = textSizeFn(this.options['zoom'], properties);
                if (isNil(textSize)) {
                    textSize = DEFAULT_UNIFORMS['textSize'];
                }
            }
            if (textHaloFillFn) {
                textHaloFill = textHaloFillFn(null, properties);
                textHaloFill = normalizeColor(textHaloFill);
            }
            if (textHaloRadiusFn) {
                textHaloRadius = textHaloRadiusFn(null, properties);
            }
            if (textHaloOpacityFn) {
                textHaloOpacity = textHaloOpacityFn(null, properties) * 255;
            }
            if (textDxFn) {
                textDx = textDxFn(null, properties) || 0;
            }
            if (textDyFn) {
                textDy = textDyFn(null, properties) || 0;
            }
            if (textPitchAlignmentFn) {
                pitchAlign = +(textPitchAlignmentFn(null, properties) === 'map');
            }
            if (textRotationAlignmentFn) {
                rotateAlign = +(textRotationAlignmentFn(null, properties) === 'map');
            }
            if (textRotationFn) {
                rotation = wrap(textRotationFn(null, properties), 0, 360) * Math.PI / 180;
            }
        } else {
            quads = shape ? getIconQuads(shape) : getEmptyIconQuads();

            if (markerWidthFn) {
                markerWidth = markerWidthFn(null, properties);
            }
            if (markerHeightFn) {
                markerHeight = markerHeightFn(null, properties);
            }
            if (markerDxFn) {
                markerDx = markerDxFn(null, properties);
            }
            if (markerDyFn) {
                markerDy = markerDyFn(null, properties);
            }
            if (markerPitchAlignmentFn) {
                pitchAlign = +(markerPitchAlignmentFn(null, properties) === 'map');
            }
            if (markerRotationAlignmentFn) {
                rotateAlign = +(markerRotationAlignmentFn(null, properties) === 'map');
            }
            if (markerRotationFn) {
                rotation = wrap(markerRotationFn(null, properties), 0, 360) * Math.PI / 180;
            }
        }
        const allowOverlapFn = markerAllowOverlapFn || textAllowOverlapFn;
        if (allowOverlapFn) {
            allowOverlap = allowOverlapFn(null, properties) || 0;
        }
        const ignorePlacementFn = markerIgnorePlacementFn || textIgnorePlacementFn;
        if (ignorePlacementFn) {
            ignorePlacement = ignorePlacementFn(null, properties) || 0;
        }
        let opacity;
        const opacityFn = textOpacityFn || markerOpacityFn;
        if (opacityFn) {
            opacity = opacityFn(this.options['zoom'], properties) * 255;
        }
        const extent = this.options.EXTENT;
        const textCount = quads.length;
        for (let i = 0; i < anchors.length; i++) {
            const anchor = anchors[i];
            const altitude = anchor.z || 0;
            if (extent !== Infinity && isOut(anchor, extent)) {
                continue;
            }
            const x = anchor.x;
            const y = anchor.y;
            const l = quads.length;
            for (let ii = 0; ii < l; ii++) {
                const quad = quads[ii];
                // const y = quad.glyphOffset[1];
                //把line的端点存到line vertex array里
                const { tl, tr, bl, br, tex } = quad;
                //char's quad if flipped
                this._fillPos(data, x, y, altitude, tl.x * 10, tl.y * 10,
                    tex.x, tex.y + tex.h);
                if (isText) {
                    this._fillData(data, alongLine, textCount, quad.glyphOffset, anchor, isVertical, anchor.axis, anchor.angleR);
                }
                this._fillFnTypeData(data, textFill, textSize, textHaloFill, textHaloRadius, textHaloOpacity, textDx, textDy,
                    markerWidth, markerHeight, markerDx, markerDy, opacity, pitchAlign, rotateAlign, rotation,
                    allowOverlap, ignorePlacement);

                this._fillPos(data, x, y, altitude, tr.x * 10, tr.y * 10,
                    tex.x + tex.w, tex.y + tex.h);
                if (isText) {
                    this._fillData(data, alongLine, textCount, quad.glyphOffset, anchor, isVertical, anchor.axis, anchor.angleR);
                }
                this._fillFnTypeData(data, textFill, textSize, textHaloFill, textHaloRadius, textHaloOpacity, textDx, textDy,
                    markerWidth, markerHeight, markerDx, markerDy, opacity, pitchAlign, rotateAlign, rotation,
                    allowOverlap, ignorePlacement);

                this._fillPos(data, x, y, altitude, bl.x * 10, bl.y * 10,
                    tex.x, tex.y);
                if (isText) {
                    this._fillData(data, alongLine, textCount, quad.glyphOffset, anchor, isVertical, anchor.axis, anchor.angleR);
                }
                this._fillFnTypeData(data, textFill, textSize, textHaloFill, textHaloRadius, textHaloOpacity, textDx, textDy,
                    markerWidth, markerHeight, markerDx, markerDy, opacity, pitchAlign, rotateAlign, rotation,
                    allowOverlap, ignorePlacement);

                this._fillPos(data, x, y, altitude, br.x * 10, br.y * 10,
                    tex.x + tex.w, tex.y);
                if (isText) {
                    this._fillData(data, alongLine, textCount, quad.glyphOffset, anchor, isVertical, anchor.axis, anchor.angleR);
                }
                this._fillFnTypeData(data, textFill, textSize, textHaloFill, textHaloRadius, textHaloOpacity, textDx, textDy,
                    markerWidth, markerHeight, markerDx, markerDy, opacity, pitchAlign, rotateAlign, rotation,
                    allowOverlap, ignorePlacement);


                this.addElements(currentIdx, currentIdx + 1, currentIdx + 2);
                this.addElements(currentIdx + 1, currentIdx + 2, currentIdx + 3);
                currentIdx += 4;

                const max = Math.max(Math.abs(x), Math.abs(y), Math.abs(altitude));
                if (max > this.maxPos) {
                    this.maxPos = max;
                }
            }
        }
    }

    _fillPos(data, x, y, altitude, shapeX, shapeY, texX, texY) {
        this.fillPosition(data, x, y, altitude);
        data.aShape.push(shapeX, shapeY);
        data.aTexCoord.push(texX, texY);
    }

    /**
     *
     * @param {Number[]} data
     * @param {Boolean} isText
     * @param {Object} symbol
     * @param {Number} tx - flip quad's x offset
     * @param {Number} ty - flip quad's y offset
     * @param {Number} texx - flip quad's tex coord x
     * @param {Number} texy - flip quad's tex coord y
     */
    _fillData(data, alongLine, textCount, glyphOffset, anchor, vertical, axis, angleR) {
        data.aCount.push(textCount);
        if (alongLine) {
            data.aGlyphOffset.push(glyphOffset[0], glyphOffset[1]);
            if (this._is3DPitchText()) {
                data.aPitchRotation.push(axis[0], axis[1], angleR);
            }
            const startIndex = anchor.startIndex;
            data.aSegment.push(anchor.segment + startIndex, startIndex, anchor.line.length);
            data.aVertical.push(vertical);
        }
    }

    _fillFnTypeData(data,
        textFill, textSize, textHaloFill, textHaloRadius, textHaloOpacity, textDx, textDy,
        markerWidth, markerHeight, markerDx, markerDy, opacity,
        pitchAlign, rotateAlign, rotation,
        allowOverlap, ignorePlacement) {
        const { textFillFn, textSizeFn, textHaloFillFn, textHaloRadiusFn, textHaloOpacityFn, textDxFn, textDyFn,
            textPitchAlignmentFn, textRotationAlignmentFn, textRotationFn,
            textAllowOverlapFn, textIgnorePlacementFn,
            textOpacityFn,
            markerWidthFn, markerHeightFn, markerDxFn, markerDyFn,
            markerPitchAlignmentFn, markerRotationAlignmentFn, markerRotationFn,
            markerAllowOverlapFn, markerIgnorePlacementFn,
            markerOpacityFn } = this._fnTypes;
        if (textFillFn) {
            data.aTextFill.push(...textFill);
        }
        if (textSizeFn) {
            data.aTextSize.push(textSize);
        }
        if (textHaloFillFn) {
            data.aTextHaloFill.push(...textHaloFill);
        }
        if (textHaloRadiusFn) {
            data.aTextHaloRadius.push(textHaloRadius);
        }
        if (textHaloOpacityFn) {
            data.aTextHaloOpacity.push(textHaloOpacity);
        }
        if (textDxFn) {
            data.aTextDx.push(textDx);
        }
        if (textDyFn) {
            data.aTextDy.push(textDy);
        }
        if (markerWidthFn) {
            data.aMarkerWidth.push(markerWidth);
        }
        if (markerHeightFn) {
            data.aMarkerHeight.push(markerHeight);
        }
        if (markerDxFn) {
            data.aMarkerDx.push(markerDx);
        }
        if (markerDyFn) {
            data.aMarkerDy.push(markerDy);
        }
        const opacityFn = markerOpacityFn || textOpacityFn;
        if (opacityFn) {
            data.aColorOpacity.push(opacity);
        }
        if (textPitchAlignmentFn || markerPitchAlignmentFn) {
            data.aPitchAlign.push(pitchAlign);
        }
        if (markerRotationAlignmentFn ||  textRotationAlignmentFn) {
             data.aRotationAlign.push(rotateAlign);
        }
        if (markerRotationFn || textRotationFn) {
            data.aRotation.push(rotation * 9362)
        }
        const allowOverlapFn = markerAllowOverlapFn || textAllowOverlapFn;
        const ignorePlacementFn = markerIgnorePlacementFn || textIgnorePlacementFn;
        if (allowOverlapFn || ignorePlacementFn) {
            const overlap = (allowOverlapFn ? 1 << 3 : 0) + allowOverlap * (1 << 2);
            const placement = (ignorePlacementFn ? 1 << 1 : 0) + ignorePlacement;
            data.aOverlap.push(overlap + placement);
        }
        //update pack properties
        if (textHaloRadius > 0) {
            this.properties['hasHalo'] = 1;
        }
    }

    _getAnchors(point, shape, scale) {
        const { feature, symbol } = point;
        const placement = this._getPlacement(point, symbol);
        const properties = feature.properties;
        const { markerSpacingFn, textSpacingFn } = this._fnTypes;
        const spacing = (
            (markerSpacingFn ? markerSpacingFn(null, properties) : symbol['markerSpacing']) ||
            (textSpacingFn ? textSpacingFn(null, properties) : symbol['textSpacing']) ||
            DEFAULT_SPACING
        ) * scale;
        const EXTENT = this.options.EXTENT;
        const altitudeToTileScale = this.options['altitudeToTileScale'];
        const anchors = getPointAnchors(point, this.lineVertex, shape, scale, EXTENT, placement, spacing, this._is3DPitchText(), altitudeToTileScale);
        return anchors;
    }

    _getPlacement(point, symbol) {
        if (this._fnTypes.markerPlacementFn) {
            return this._fnTypes.markerPlacementFn(this.options['zoom'], point.feature.properties);
        }
        return symbol.markerPlacement || this._textPlacement;
    }

    getPackSDFFormat(symbol) {
        if (this._textPlacement === 'line' && !symbol['isIconText']) {
            //position, shape0, textcoord0, shape1, textcoord1, size, color, opacity, offset, rotation
            const formats = [
                ...this.getPositionFormat(),
                {
                    type: Int16Array,
                    width: 2,
                    name: 'aShape'
                },
                {
                    type: Uint16Array,
                    width: 2,
                    name: 'aTexCoord'
                },
                {
                    type: Uint8Array,
                    width: 1,
                    name: 'aCount'
                },
                {
                    type: Int16Array,
                    width: 2,
                    name: 'aGlyphOffset'
                },
                //aSegment存放了anchor在line的片段序号
                {
                    type: Uint16Array,
                    width: 3,
                    name: 'aSegment'
                },
                {
                    type: Uint8Array,
                    width: 1,
                    name: 'aVertical'
                }
            ];
            if (this._is3DPitchText()) {
                formats.push({
                    type: Float32Array,
                    width: 3,
                    name: 'aPitchRotation'
                });
            }
            return formats;
        } else {
            return [
                ...this.getPositionFormat(),
                {
                    type: Int16Array,
                    width: 2,
                    name: 'aShape'
                },
                {
                    type: Uint16Array,
                    width: 2,
                    name: 'aTexCoord'
                },
                {
                    type: Uint8Array,
                    width: 1,
                    name: 'aCount'
                }
            ];
        }
    }

    getPackMarkerFormat() {
        return [
            ...this.getPositionFormat(),
            {
                type: Int16Array,
                width: 2,
                name: 'aShape'
            },
            {
                type: Uint16Array,
                width: 2,
                name: 'aTexCoord'
            }
        ];
    }

}

function getFeauresToMerge(features, symbolDef, markerPlacement, textPlacement, zoom) {
    const keyName = (IDX_PROP + '').trim();
    const fnTypes = VectorPack.genFnTypes(symbolDef);
    const { mergeOnPropertyFn } = fnTypes;
    if (!symbolDef['mergeOnProperty'] || textPlacement !== 'line' && markerPlacement !== 'line') {
        return [];
    }
    if (isString(symbolDef['mergeOnProperty']) && (textPlacement === 'line' || markerPlacement === 'line')) {
        return [{ features: features, property: symbolDef['mergeOnProperty'] }];
    }
    const result = [];
    const merging = {};
    const unMerged = [];
    for (let i = 0; i < features.length; i++) {
        features[i][keyName] = i;
        const properties = features[i].properties = features[i].properties || {};
        properties['$layer'] = features[i].layer;
        properties['$type'] = features[i].type;
        let placement = markerPlacement;
        if (placement !== 'line') {
            placement = textPlacement;
        }
        const property = mergeOnPropertyFn ? mergeOnPropertyFn(zoom, properties) : symbolDef['mergeOnProperty'];
        if (placement !== 'line' || isNil(property)) {
            unMerged.push(features[i]);
            continue;
        }
        if (merging[property] === undefined) {
            merging[property] = result.length;
            result.push({
                features: [],
                property
            });
        }
        result[merging[property]].features.push(features[i]);
    }
    if (unMerged.length) {
        result.push({ features: unMerged });
    }
    return result;
}
