import Eventable from './common/Eventable.js';
import { isNil, extend1, hasOwn, getTexMemorySize } from './common/Util.js';
import AbstractTexture from './AbstractTexture.js';
import { KEY_DISPOSED } from './common/Constants.js';

class Material {
    constructor(uniforms = {}, defaultUniforms) {
        this._version = 0;
        this.uniforms = extend1({}, defaultUniforms || {}, uniforms);
        for (const p in uniforms) {
            const getter = Object.getOwnPropertyDescriptor(uniforms, p).get;
            if (getter) {
                Object.defineProperty(this.uniforms, p, {
                    get: getter
                });
            }
        }
        this._reglUniforms = {};
        this.refCount = 0;
        this._bindedOnTextureComplete = this._onTextureComplete.bind(this);
        this._genUniformKeys();
        this._checkTextures();
    }

    set version(v) {
        throw new Error('Material.version is read only.');
    }

    get version() {
        return this._version;
    }

    isReady() {
        return this._loadingCount <= 0;
    }

    set(k, v) {
        const dirty = isNil(this.uniforms[k]) && !isNil(v) ||
            !isNil(this.uniforms[k]) && isNil(v);

        if (this.uniforms[k] && this.isTexture(k)) {
            this.uniforms[k].dispose();
        }
        if (!isNil(v)) {
            this.uniforms[k] = v;
        } else if (!isNil(this.uniforms[k])) {
            delete this.uniforms[k];
        }
        this._dirtyUniforms = true;
        if (this.isTexture(k)) {
            this._checkTextures();
        }
        if (dirty) {
            this._genUniformKeys();
            this._incrVersion();
        }
        return this;
    }

    get(k) {
        return this.uniforms[k];
    }

    isDirty() {
        return this._uniformVer !== this.version;
    }

    /**
     * Get shader defines
     * @return {Object}
     */
    appendDefines(defines/*, geometry*/) {
        const uniforms = this.uniforms;
        if (uniforms['jointTexture']) {
            defines['HAS_SKIN'] = 1;
        }
        if (uniforms['morphWeights1']) {
            defines['HAS_MORPH'] = 1;
        }
        if (uniforms['khr_offset'] || uniforms['khr_rotation'] || uniforms['khr_scale']) { //对纹理坐标转换的扩展的支持
            defines['HAS_KHR_TEXTURE_TRANSFORM'] = 1;
        }
        return defines;
    }

    hasSkinAnimation() {
        return this.uniforms['jointTexture'] && this.uniforms['skinAnimation'];
    }

    getUniforms(regl) {
        if (this._reglUniforms && !this.isDirty()) {
            return this._reglUniforms;
        }
        const uniforms = this.uniforms;
        const realUniforms = {};
        for (const p in uniforms) {
            if (this.isTexture(p)) {
                Object.defineProperty(realUniforms, p, {
                    enumerable: true,
                    configurable: true,
                    get: function () {
                        return uniforms[p].getREGLTexture(regl);
                    }
                });
            } else {
                Object.defineProperty(realUniforms, p, {
                    enumerable: true,
                    configurable: true,
                    get: function () {
                        return uniforms[p];
                    }
                });
            }
        }
        this._reglUniforms = realUniforms;
        this._uniformVer = this.version;
        return realUniforms;
    }

    isTexture(k) {
        const v = this.uniforms[k];
        if (v instanceof AbstractTexture) {
            return true;
        }
        return false;
    }

    dispose() {
        for (const p in this.uniforms) {
            const u = this.uniforms[p];
            if (u) {
                if (u.dispose) {
                    u.dispose();
                } else if (u.destroy && !u[KEY_DISPOSED]) {
                    //a normal regl texture
                    u.destroy();
                    u[KEY_DISPOSED] = true;
                }
            }
        }
        delete this.uniforms;
        delete this._reglUniforms;
        this._disposed = true;
    }

    isDisposed() {
        return !!this._disposed;
    }

    _checkTextures() {
        this._loadingCount = 0;
        for (const p in this.uniforms) {
            if (this.isTexture(p)) {
                const texture = this.uniforms[p];
                if (!texture.isReady()) {
                    this._loadingCount++;
                    texture.on('complete', this._bindedOnTextureComplete);
                }
            }
        }
    }

    _onTextureComplete() {
        this._loadingCount--;
        this._incrVersion();
        if (this._loadingCount <= 0) {
            if (!this._disposed) {
                this.fire('complete');
            }
        }
    }

    getUniformKeys() {
        return this._uniformKeys;
    }

    _genUniformKeys() {
        const keys = [];
        for (const p in this.uniforms) {
            if (hasOwn(this.uniforms, p) && !isNil(this.uniforms[p])) {
                keys.push(p);
            }
        }
        this._uniformKeys = keys.join();
    }

    _incrVersion() {
        this._version++;
    }

    getMemorySize() {
        const uniforms = this.uniforms;
        let size = 0;
        for (const p in uniforms) {
            if (this.isTexture(p)) {
                size += uniforms[p].getMemorySize();
            } else if (this.uniforms[p].destroy) {
                size += getTexMemorySize(this.uniforms[p]);
            }
        }
        return size;
    }
}

export default Eventable(Material);
