import { Marker, renderer } from 'maptalks';

export default class IconRequestor {
    //options.errorUrl : alt image when failing loading the icon
    constructor(options) {
        this.options = options || {};
        this.resources = new renderer.ResourceCache();
        const canvas = document.createElement('canvas');
        this.ctx = canvas.getContext('2d');
    }

    getIcons(icons, cb) {
        if (!icons || !Object.keys(icons).length) {
            cb(null, { icons: null });
            return;
        }
        const urls = Object.keys(icons);
        const images = {}, buffers = [];
        let count = 0;
        let current = 0;
        const self = this;
        function onload() {
            current++;
            const ctx = self.ctx;
            let width, height;
            try {
                width = ctx.canvas.width = this.width;
                height = ctx.canvas.height = this.height;
                ctx.drawImage(this, 0, 0);
                const data = ctx.getImageData(0, 0, width, height).data;
                buffers.push(data.buffer);
                images[this.url] = { data: { data, width, height }, url: this.src };
            } catch (err) {
                //tainted canvas
                console.warn(err);
            }
            if (current === count) {
                cb(null, { icons: images, buffers });
            }
        }
        function onerror(err) {
            console.warn(`failed loading icon(${this.index}) at "${this.url}"`);
            console.warn(err);
            if (self.options.iconErrorUrl) {
                this.src = self.options.iconErrorUrl;
            } else {
                current++;
                if (current === count) {
                    cb(null, { icons: images, buffers });
                }
            }
        }
        let hasAsyn = false;
        let marker;
        for (let i = 0; i < urls.length; i++) {
            const url = urls[i];
            if (url.indexOf('vector://') === 0) {
                marker = marker ||  new Marker([0, 0]);
                const symbol = JSON.parse(url.substring('vector://'.length));
                const { markerFill, markerLineColor } = symbol;
                if (markerFill && Array.isArray(markerFill)) {
                    symbol.markerFill = convertColorArray(markerFill);
                }
                if (markerLineColor && Array.isArray(markerLineColor)) {
                    symbol.markerLineColor = convertColorArray(markerLineColor);
                }
                delete symbol.markerHorizontalAlignment;
                delete symbol.markerVerticalAlignment;
                delete symbol.markerDx;
                delete symbol.markerDy;
                delete symbol.markerPlacement;
                delete symbol.markerFile;
                marker.setSymbol(symbol);
                const sprite = marker['_getSprite'](this.resources);
                if (sprite) {
                    const canvas = sprite.canvas;
                    const width = canvas.width;
                    const height = canvas.height;
                    const data = canvas.getContext('2d').getImageData(0, 0, width, height).data;
                    images[url] = { data: { data, width, height }, url };
                    buffers.push(data.buffer);
                }

            } else {
                const img = new Image();
                img.index = i;
                img.onload = onload;
                img.onerror = onerror;
                img.onabort = onerror;
                img.url = url;
                img.crossOrigin = 'Anonymous';
                hasAsyn = true;
                count++;
                img.src = url;
            }
        }
        if (!hasAsyn) {
            cb(null, { icons: images, buffers });
        }
    }
}



function resize(image, canvas) {
    if (isPowerOfTwo(image.width) && isPowerOfTwo(image.height)) {
        canvas.width = image.width;
        canvas.height = image.height;
        canvas.getContext('2d').drawImage(image, 0, 0, image.width, image.height);
        return image;
    }
    let width = image.width;
    let height = image.height;
    if (!isPowerOfTwo(width)) {
        width = ceilPowerOfTwo(width);
    }
    if (!isPowerOfTwo(height)) {
        height = ceilPowerOfTwo(height);
    }
    // const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(image, 0, 0, width, height);
    const url = image.src;
    const idx = url.lastIndexOf('/') + 1;
    const filename = url.substring(idx);
    console.warn(`Texture(${filename})'s size is not power of two, resize from (${image.width}, ${image.height}) to (${width}, ${height})`);
    return canvas;
}

function isPowerOfTwo(value) {
    return (value & (value - 1)) === 0 && value !== 0;
}


function ceilPowerOfTwo(value) {
    return Math.pow(2, Math.ceil(Math.log(value) / Math.LN2));
}

function convertColorArray(color) {
    if (color.length === 3) {
        color.push(1);
    }
    return color.reduce((accumulator, v, idx) => {
        if (idx < 3) {
            accumulator += v * 255 + ',';
        } else {
            accumulator += v + ')';
        }
        return accumulator;
    }, 'rgba(');
}
