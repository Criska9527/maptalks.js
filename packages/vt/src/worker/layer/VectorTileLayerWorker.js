import LayerWorker from './BaseLayerWorker';
import Pbf from 'pbf';
import { VectorTile } from '@mapbox/vector-tile';
import Ajax from '../util/Ajax';
import { hasOwn } from '../../common/Util';

export default class VectorTileLayerWorker extends LayerWorker {
    constructor(id, options, uploader, cache, loadings, callback) {
        super(id, options, uploader, cache, loadings);
        options = options || {};
        callback();
    }

    /**
     * Load a tile, paint and return gl directives
     * @param {Object} tileInfo  - tileInfo, url, xyz, res, extent, etc
     * @param {Function} cb      - callback function when finished
     */
    getTileFeatures(tileInfo, cb) {
        const url = tileInfo.url;
        return Ajax.getArrayBuffer(url, (err, response) => {
            if (err) {
                cb(err);
                return;
            }
            const tile = new VectorTile(new Pbf(response.data));
            const features = [];
            if (!tile.layers) {
                cb(null, features, []);
                return;
            }
            const layers = {};
            let feature;
            for (const layer in tile.layers) {
                if (hasOwn(tile.layers, layer)) {
                    layers[layer] = {
                        types: {}
                    };
                    const types = layers[layer].types;
                    for (let i = 0, l = tile.layers[layer].length; i < l; i++) {
                        feature = tile.layers[layer].feature(i);

                        types[feature.type] = 1;
                        // feature.properties['$layer'] = layer;
                        // feature.properties['$type'] = feature.type;
                        features.push({
                            type: feature.type,
                            layer: layer,
                            geometry: feature.loadGeometry(),
                            properties: feature.properties,
                            extent: feature.extent
                        });
                    }
                }
            }

            for (const p in layers) {
                layers[p].types = Object.keys(layers[p].types).map(t => +t);
            }

            cb(null, features, layers, { byteLength: response.data.byteLength });
        });
    }

    abortTile(url, cb) {
        const xhr = this.requests[url];
        delete this.requests[url];
        //需要先从requests中删除url，再abort，触发cancel逻辑, 否则会被当成xhr的error处理掉
        if (xhr && xhr.abort) {
            xhr.abort();
        }
        this._cancelLoadings(url);
        cb();
    }

    onRemove() {
        for (const url in this.requests) {
            this.requests[url].abort();
        }
        this.requests = {};
    }
}
