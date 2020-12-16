import parseRGBE from './common/HDR.js';
import Texture from './AbstractTexture.js';
/**
 * config properties:
 * https://github.com/regl-project/regl/blob/gh-pages/API.md#textures
 */
class Texture2D extends Texture {

    onLoad({ data }) {
        const config = this.config;
        if (!config) {
            //disposed
            return;
        }
        if (config.hdr) {
            data = parseRGBE(data.data, 0, config.maxRange);
            this.rgbmRange = data.rgbmRange;
            config.data = data.pixels;
        } else {
            config.data = data;
        }
        //refresh width / height
        config.width = config.width || data.width;
        config.height = config.height || data.height;
        this._updateREGL();
    }

    createREGLTexture(regl) {
        return regl.texture(this.config);
    }
}

export default Texture2D;
