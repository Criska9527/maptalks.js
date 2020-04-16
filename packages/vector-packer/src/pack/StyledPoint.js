import { isNil, isFnTypeSymbol, extend } from '../style/Util';
import { getMarkerPathBase64, evaluateIconSize, evaluateTextSize } from '../style/Marker';
import { getSDFFont, resolveText } from '../style/Text';
import { WritingMode, shapeText, shapeIcon } from './util/shaping';
import { allowsLetterSpacing } from './util/script_detection';
import { loadFunctionTypes, piecewiseConstant, interpolated } from '@maptalks/function-type';

const URL_PATTERN = /\{ *([\w_]+) *\}/g;

export default class StyledPoint {
    constructor(feature, symbol, options) {
        //anchor(世界坐标), offset(normalized offset), tex, size(世界坐标), opacity, rotation
        //u_size_scale 当前像素坐标相对世界坐标的大小, u_rotation map的旋转角度(?)
        this.feature = feature;
        this.symbolDef = symbol;
        this.symbol = loadFunctionTypes(symbol, () => {
            return [options.zoom];
        });
        this.options = options;
        this._thisReplacer = this._replacer.bind(this);
        this._initFnTypes();
    }

    _initFnTypes() {
        if (isFnTypeSymbol('textName', this.symbolDef)) {
            this._textNameFn = piecewiseConstant(this.symbolDef['textName']);
        }
        if (isFnTypeSymbol('textFaceName', this.symbolDef)) {
            this._textFaceNameFn = piecewiseConstant(this.symbolDef['textFaceName']);
        }
        if (isFnTypeSymbol('textWeight', this.symbolDef)) {
            this._textWeightFn = piecewiseConstant(this.symbolDef['textWeight']);
        }
        if (isFnTypeSymbol('textStyle', this.symbolDef)) {
            this._textStyleFn = piecewiseConstant(this.symbolDef['textStyle']);
        }
        if (isFnTypeSymbol('textWrapWidth', this.symbolDef)) {
            this._textWrapWidthFn = piecewiseConstant(this.symbolDef['textWrapWidth']);
        }
        if (isFnTypeSymbol('textHorizontalAlignment', this.symbolDef)) {
            this._textHorizontalAlignmentFn = piecewiseConstant(this.symbolDef['textHorizontalAlignment']);
        }
        if (isFnTypeSymbol('textVerticalAlignment', this.symbolDef)) {
            this._textVerticalAlignmentFn = piecewiseConstant(this.symbolDef['textVerticalAlignment']);
        }
        if (isFnTypeSymbol('markerFile', this.symbolDef)) {
            this._markerFileFn = piecewiseConstant(this.symbolDef['markerFile']);
        }
        if (isFnTypeSymbol('markerType', this.symbolDef)) {
            this._markerTypeFn = piecewiseConstant(this.symbolDef['markerType']);
        }
        if (isFnTypeSymbol('markerFill', this.symbolDef)) {
            this._markerFillFn = piecewiseConstant(this.symbolDef['markerFill']);
        }
        if (isFnTypeSymbol('markerFillPatternFile', this.symbolDef)) {
            this._markerFillPatternFileFn = piecewiseConstant(this.symbolDef['markerFillPatternFile']);
        }
        if (isFnTypeSymbol('markerFillOpacity', this.symbolDef)) {
            this._markerFillOpacityFn = piecewiseConstant(this.symbolDef['markerFillOpacity']);
        }
        if (isFnTypeSymbol('markerLineColor', this.symbolDef)) {
            this._markerLineColorFn = piecewiseConstant(this.symbolDef['markerLineColor']);
        }
        if (isFnTypeSymbol('markerLineWidth', this.symbolDef)) {
            this._markerLineWidthFn = piecewiseConstant(this.symbolDef['markerLineWidth']);
        }
        if (isFnTypeSymbol('markerLineOpacity', this.symbolDef)) {
            this._markerLineOpacityFn = piecewiseConstant(this.symbolDef['markerLineOpacity']);
        }
        if (isFnTypeSymbol('markerLineDasharray', this.symbolDef)) {
            this._markerLineDasharrayFn = piecewiseConstant(this.symbolDef['markerLineDasharray']);
        }
        if (isFnTypeSymbol('markerLinePatternFile', this.symbolDef)) {
            this._markerLinePatternFileFn = piecewiseConstant(this.symbolDef['markerLinePatternFile']);
        }

        if (isFnTypeSymbol('markerWidth', this.symbolDef)) {
            this._markerWidthFn = interpolated(this.symbolDef['markerWidth']);
        }
        if (isFnTypeSymbol('markerHeight', this.symbolDef)) {
            this._markerHeightFn = interpolated(this.symbolDef['markerHeight']);
        }
        if (isFnTypeSymbol('markerHorizontalAlignment', this.symbolDef)) {
            this._markerHorizontalAlignmentFn = piecewiseConstant(this.symbolDef['markerHorizontalAlignment']);
        }
        if (isFnTypeSymbol('markerVerticalAlignment', this.symbolDef)) {
            this._markerVerticalAlignmentFn = piecewiseConstant(this.symbolDef['markerVerticalAlignment']);
        }
    }

    _replacer(str, key) {
        return this.feature.properties[key] || 'default';
    }

    getShape(iconAtlas, glyphAtlas) {
        if (this._shape) {
            return this._shape;
        }
        let shape;
        const symbol = this.symbol;
        const iconGlyph = this.getIconAndGlyph();
        const properties = this.feature.properties;
        if (iconGlyph && iconGlyph.glyph) {
            const { font, text } = iconGlyph.glyph;
            if (text === '') {
                return null;
            }
            const glyphSize = 24;
            const size = this.size[0],
                fontScale = size / glyphSize;
            const oneEm = 24;
            const keepUpright = symbol['textKeepUpright'],
                textAlongLine = symbol['textRotationAlignment'] === 'map' && symbol['textPlacement'] === 'line' && !symbol['isIconText'];
            const glyphs = glyphAtlas.glyphMap[font],
                hAlignment = this._textHorizontalAlignmentFn ? this._textHorizontalAlignmentFn(null, properties) : symbol['textHorizontalAlignment'],
                vAlignment = this._textVerticalAlignmentFn ? this._textVerticalAlignmentFn(null, properties) : symbol['textVerticalAlignment'],
                textAnchor = getAnchor(hAlignment, vAlignment),
                lineHeight = 1.2 * oneEm, //TODO 默认的lineHeight的计算
                isAllowLetterSpacing = allowsLetterSpacing(text),
                textLetterSpacing =  isAllowLetterSpacing ? symbol['textLetterSpacing'] / fontScale || 0 : 0,
                textOffset = [symbol['textDx'] / fontScale || 0, symbol['textDy'] / fontScale || 0],
                wrapWidth = this._textWrapWidthFn ? this._textWrapWidthFn(null, properties) : symbol['textWrapWidth'],
                textWrapWidth = (wrapWidth || 10 * oneEm) / fontScale;
            shape = {};
            shape.horizontal = shapeText(
                text,
                glyphs,
                textWrapWidth, //默认为10个字符
                lineHeight,
                textAnchor,
                'center',
                textLetterSpacing,
                textOffset,
                oneEm, //verticalHeight
                WritingMode.horizontal
            );
            if (isAllowLetterSpacing && textAlongLine && keepUpright) {
                shape.vertical = shapeText(text, glyphs, textWrapWidth, lineHeight,
                    textAnchor, 'center', textLetterSpacing, textOffset, oneEm, WritingMode.vertical
                );
            }
        } else if (iconGlyph && iconGlyph.icon) {
            if (!iconAtlas.positions[iconGlyph.icon]) {
                //图片没有载入成功
                return null;
            }
            const hAlignment = this._markerHorizontalAlignmentFn ? this._markerHorizontalAlignmentFn(null, properties) : symbol['markerHorizontalAlignment'];
            const vAlignment = this._markerVerticalAlignmentFn ? this._markerVerticalAlignmentFn(null, properties) : symbol['markerVerticalAlignment'];
            const markerAnchor = getAnchor(hAlignment, vAlignment);
            shape = shapeIcon(iconAtlas.positions[iconGlyph.icon], markerAnchor);
            if (!this.size) {
                this.size = shape.image.displaySize;
            }
        }
        this._shape = shape;
        return shape;
    }

    getIconAndGlyph() {
        if (this.iconGlyph) {
            return this.iconGlyph;
        }
        const { zoom } = this.options;
        const result = {};
        const symbol = this.symbol;
        const properties = this.feature.properties;
        const markerFile = this._markerFileFn ? this._markerFileFn(null, properties) : symbol.markerFile;
        const markerType = this._markerTypeFn ? this._markerTypeFn(null, properties) : symbol.markerType;
        const hasMarker = markerFile || markerType || symbol.markerPath;
        const hasText = !isNil(this.symbolDef.textName);
        let size;
        if (hasMarker) {
            size = evaluateIconSize(symbol, properties, zoom);
        }
        if (hasText) {
            size = evaluateTextSize(symbol, properties, zoom);
        }
        this.size = size;
        if (hasMarker) {
            let icon;
            if (markerType) {
                const url = {};
                url['markerType'] = markerType;
                if (this._markerWidthFn) {
                    const width =  this._markerWidthFn(null, properties);
                    if (!isNil(width)) {
                        url['markerWidth'] = width;
                    }
                } else if (symbol.markerWidth >= 0) {
                    url['markerWidth'] = symbol.markerWidth;
                }
                if (this._markerHeightFn) {
                    const height = this._markerHeightFn(null, properties);
                    if (!isNil(height)) {
                        url['markerHeight'] = height;
                    }
                } else if (symbol.markerHeight >= 0) {
                    url['markerHeight'] = symbol.markerHeight;
                }
                if (this._markerFillFn) {
                    const fill = this._markerFillFn(null, properties);
                    if (!isNil(fill)) {
                        url['markerFill'] = fill;
                    }
                } else if (symbol.markerFill) {
                    url['markerFill'] = symbol.markerFill;
                }
                if (this._markerFillPatternFileFn) {
                    const fillPattern = this._markerFillPatternFileFn(null, properties);
                    if (!isNil(fillPattern)) {
                        url['markerFillPatternFile'] = fillPattern;
                    }
                } else if (symbol.markerFillPatternFile) {
                    url['markerFillPatternFile'] = symbol.markerFillPatternFile;
                }
                if (this._markerFillOpacityFn) {
                    const fillOpacity = this._markerFillOpacityFn(null, properties);
                    if (!isNil(fillOpacity)) {
                        url['markerFillOpacity'] = fillOpacity;
                    }
                } else if (symbol.markerFillOpacity >= 0) {
                    url['markerFillOpacity'] = symbol.markerFillOpacity;
                }
                if (this._markerLineColorFn) {
                    const lineColor = this._markerLineColorFn(null, properties);
                    if (!isNil(lineColor)) {
                        url['markerLineColor'] = lineColor;
                    }
                } else if (symbol.markerLineColor) {
                    url['markerLineColor'] = symbol.markerLineColor;
                }
                if (this._markerLineWidthFn) {
                    const lineWidth = this._markerLineWidthFn(null, properties);
                    if (!isNil(lineWidth)) {
                        url['markerLineWidth'] = lineWidth;
                    }
                } else if (symbol.markerLineWidth >= 0) {
                    url['markerLineWidth'] = symbol.markerLineWidth;
                }
                if (this._markerLineOpacityFn) {
                    const lineOpacity = this._markerLineOpacityFn(null, properties);
                    if (!isNil(lineOpacity)) {
                        url['markerLineOpacity'] = lineOpacity;
                    }
                } else if (symbol.markerLineOpacity >= 0) {
                    url['markerLineOpacity'] = symbol.markerLineOpacity;
                }
                if (this._markerLineDasharrayFn) {
                    const dasharray = this._markerLineDasharrayFn(null, properties);
                    if (!isNil(dasharray)) {
                        url['markerLineDasharray'] = dasharray;
                    }
                } else if (symbol.markerLineDasharray) {
                    url['markerLineDasharray'] = symbol.markerLineDasharray;
                }
                if (this._markerLinePatternFileFn) {
                    const linePattern = this._markerLinePatternFileFn(null, properties);
                    if (!isNil(linePattern)) {
                        url['markerLinePatternFile'] = linePattern;
                    }
                } else if (symbol.markerLinePatternFile) {
                    url['markerLinePatternFile'] = symbol.markerLinePatternFile;
                }
                icon = 'vector://' + JSON.stringify(url);
            } else {
                icon = markerFile ? markerFile.replace(URL_PATTERN, this._thisReplacer) :
                    symbol.markerPath ? getMarkerPathBase64(symbol, size[0], size[1]) : null;
            }
            result.icon = icon;
        }

        if (hasText) {
            const textName = this._textNameFn ? this._textNameFn(null, properties) : symbol['textName'];
            if (textName || textName === 0) {
                const textFaceName = this._textFaceNameFn ? this._textFaceNameFn(null, properties) : symbol['textFaceName'];
                const textStyle = this._textStyleFn ? this._textStyleFn(null, properties) : symbol['textStyle'];
                const textWeight = this._textWeightFn ? this._textWeightFn(null, properties) : symbol['textWeight'];
                const font = getSDFFont(textFaceName, textStyle, textWeight);
                const text = resolveText(textName, properties);
                //(改为在前端计算)在TextPainter中能通过feature.properties['$label']直接取得标签内容
                // this.feature.properties['$label'] = text;
                if (text && text.length) {
                    result.glyph = {
                        font, text
                    };
                }
            }
        }
        this.iconGlyph = result;
        return result;


        // markerOpacity
        // markerWidth
        // markerHeight
        // markerDx
        // markerDy
        // markerHorizontalAlignment
        // markerVerticalAlignment
        // markerPlacement
        // markerRotation
        // markerFile
        // markerType
        // markerFill
        // markerFillPatternFile
        // markerFillOpacity
        // markerLineColor
        // markerLineWidth
        // markerLineOpacity
        // markerLineDasharray
        // markerLinePatternFile
        // markerPath
        // markerPathWidth
        // markerPathHeight
    }
}

function getAnchor(h, v) {
    if (!v || v === 'middle') {
        v = 'center';
    }
    if (!h || h === 'middle') {
        h = 'center';
    }
    let vv = v !== 'center' ? v : '';
    vv += h !== 'center' ? (vv.length ? '-' : '') + h : '';
    return vv;
}
