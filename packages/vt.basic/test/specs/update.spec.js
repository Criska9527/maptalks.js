const assert = require('assert');
const { readPixel } = require('../common/Util');
const maptalks = require('maptalks');
const { GeoJSONVectorTileLayer } = require('@maptalks/vt');
require('../../dist/maptalks.vt.basic');

const DEFAULT_VIEW = {
    center: [0, 0],
    zoom: 6,
    pitch: 0,
    bearing: 0
};

const line = {
    type: 'FeatureCollection',
    features: [
        { type: 'Feature', geometry: { type: 'LineString', coordinates: [[-1, 0], [1, 0]] }, properties: { type: 1 } }
    ]
};

const point = {
    type: 'FeatureCollection',
    features: [
        { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { type: 1 } }
    ]
};

describe('update style specs', () => {
    let container, map;
    before(() => {
        container = document.createElement('div');
        container.style.width = '128px';
        container.style.height = '128px';
        document.body.appendChild(container);
    });

    beforeEach(() => {
        map = new maptalks.Map(container, DEFAULT_VIEW);
    });

    afterEach(() => {
        map.remove();
    });

    it('should can setStyle', done => {
        assertChangeStyle(done, [0, 255, 0, 255], layer => {
            layer.setStyle([
                {
                    filter: true,
                    renderPlugin: {
                        type: 'line',
                        dataConfig: { type: 'line' },
                    },
                    symbol: { lineColor: '#0f0', lineWidth: 8, lineOpacity: 1 }
                }
            ]);
        });
    });

    it('should can setStyle with missed filter', done => {
        assertChangeStyle(done, [0, 0, 0, 0], layer => {
            layer.setStyle([
                {
                    filter: {
                        title: '所有数据',
                        value: ['==', 'missingCondition', 1]
                    },
                    renderPlugin: {
                        type: 'line',
                        dataConfig: { type: 'line' },
                    },
                    symbol: { lineColor: '#0f0', lineWidth: 8, lineOpacity: 1 }
                }
            ]);
        });
    });

    it('should can updateSymbol', done => {
        assertChangeStyle(done, [0, 255, 0, 255], layer => {
            layer.updateSymbol(0, {
                lineColor: '#0f0'
            });
        });
    });

    it('should hide by setting visible to false', done => {
        assertChangeStyle(done, [0, 0, 0, 0], layer => {
            layer.updateSymbol(0, {
                visible: false
            });
        });
    });

    it('should can update textFill', done => {
        const style = [
            {
                filter: {
                    title: '所有数据',
                    value: ['==', 'type', 1]
                },
                renderPlugin: {
                    type: 'text',
                    dataConfig: { type: 'point' },
                    sceneConfig: { collision: false }
                },
                symbol: { textName: '■■■', textSize: 30, textFill: '#f00' }
            }
        ];
        const layer = new GeoJSONVectorTileLayer('gvt', {
            data: point,
            style
        });
        let count = 0;
        const renderer = map.getRenderer();
        const x = renderer.canvas.width, y = renderer.canvas.height;
        layer.on('layerload', () => {
            count++;
            if (count === 2) {
                const pixel = readPixel(layer.getRenderer().canvas, x / 2, y / 2);
                //开始是红色
                assert.deepEqual(pixel, [255, 0, 0, 255]);
                layer.updateSymbol(0, { textFill: '#0f0' });
            } else if (count === 3) {
                const pixel = readPixel(layer.getRenderer().canvas, x / 2, y / 2);
                //变成绿色
                assert.deepEqual(pixel, [0, 255, 0, 255]);
                done();
            }
        });
        layer.addTo(map);
    });

    it('should can update textSize', done => {
        const style = [
            {
                filter: {
                    title: '所有数据',
                    value: ['==', 'type', 1]
                },
                renderPlugin: {
                    type: 'text',
                    dataConfig: { type: 'point' },
                    sceneConfig: { collision: false }
                },
                symbol: { textName: '■■■', textSize: 10, textFill: '#f00' }
            }
        ];
        const layer = new GeoJSONVectorTileLayer('gvt', {
            data: point,
            style
        });
        let count = 0;
        const renderer = map.getRenderer();
        const x = renderer.canvas.width, y = renderer.canvas.height;
        layer.on('layerload', () => {
            count++;
            if (count === 2) {
                const pixel = readPixel(layer.getRenderer().canvas, x / 2, y / 2);
                //开始是红色
                assert.deepEqual(pixel, [255, 0, 0, 255]);
                layer.updateSymbol(0, { textSize: 20, textFill: '#0f0' });
            } else if (count === 3) {
                const pixel = readPixel(layer.getRenderer().canvas, x / 2, y / 2);
                //变成绿色
                assert.deepEqual(pixel, [0, 255, 0, 255]);
                done();
            }
        });
        layer.addTo(map);
    });

    it('should can update textSize with line placement', done => {
        const style = [
            {
                filter: {
                    title: '所有数据',
                    value: ['==', 'type', 1]
                },
                renderPlugin: {
                    type: 'text',
                    dataConfig: { type: 'point' },
                    sceneConfig: { collision: false }
                },
                symbol: { textName: '■■', textSize: 10, textFill: '#f00', textPlacement: 'line', textSpacing: 5 }
            }
        ];
        const layer = new GeoJSONVectorTileLayer('gvt', {
            data: line,
            style
        });
        let count = 0;
        const renderer = map.getRenderer();
        const x = renderer.canvas.width, y = renderer.canvas.height;
        layer.on('layerload', () => {
            const xOffset = 2;
            count++;
            if (count === 2) {
                const pixel = readPixel(layer.getRenderer().canvas, x / 2 + xOffset, y / 2);
                //开始是红色
                assert.deepEqual(pixel, [255, 0, 0, 255]);
                layer.updateSymbol(0, { textSize: 20, textFill: '#0f0' });
            } else if (count === 3) {
                const pixel = readPixel(layer.getRenderer().canvas, x / 2 + xOffset, y / 2);
                //变成绿色
                assert.deepEqual(pixel, [0, 255, 0, 255]);
                done();
            }
        });
        layer.addTo(map);
    });

    it('should can update text visible with line placement', done => {
        const style = [
            {
                filter: {
                    title: '所有数据',
                    value: ['==', 'type', 1]
                },
                renderPlugin: {
                    type: 'text',
                    dataConfig: { type: 'point' },
                    sceneConfig: { collision: false }
                },
                symbol: { textName: '■■', textSize: 10, textFill: '#f00', textPlacement: 'line', textSpacing: 5 }
            }
        ];
        const layer = new GeoJSONVectorTileLayer('gvt', {
            data: line,
            style
        });
        let count = 0;
        const renderer = map.getRenderer();
        const x = renderer.canvas.width, y = renderer.canvas.height;
        layer.on('layerload', () => {
            const xOffset = 2;
            count++;
            if (count === 2) {
                const pixel = readPixel(layer.getRenderer().canvas, x / 2 + xOffset, y / 2);
                //开始是红色
                assert.deepEqual(pixel, [255, 0, 0, 255]);
                layer.updateSymbol(0, { visible: false });
            } else if (count === 3) {
                const pixel = readPixel(layer.getRenderer().canvas, x / 2 + xOffset, y / 2);
                //变成透明
                assert.deepEqual(pixel, [0, 0, 0, 0]);
                done();
            }
        });
        layer.addTo(map);
    });

    function assertChangeStyle(done, expectedColor, changeFun) {
        const style = [
            {
                filter: {
                    title: '所有数据',
                    value: ['==', 'type', 1]
                },
                renderPlugin: {
                    type: 'line',
                    dataConfig: { type: 'line' },
                },
                symbol: { lineColor: '#f00', lineWidth: 8, lineOpacity: 1 }
            }
        ];
        const layer = new GeoJSONVectorTileLayer('gvt', {
            data: line,
            style
        });
        let count = 0;
        const renderer = map.getRenderer();
        const x = renderer.canvas.width, y = renderer.canvas.height;
        layer.on('layerload', () => {
            count++;
            if (count === 2) {
                const pixel = readPixel(layer.getRenderer().canvas, x / 2, y / 2);
                //开始是红色
                assert.deepEqual(pixel, [255, 0, 0, 255]);
                changeFun(layer);
            } else if (count === 3) {
                const pixel = readPixel(layer.getRenderer().canvas, x / 2, y / 2);
                //变成绿色
                assert.deepEqual(pixel, expectedColor);
                done();
            }
        });
        layer.addTo(map);
    }

});

