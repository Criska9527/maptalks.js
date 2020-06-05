import { vec3, vec4 } from 'gl-matrix';
import { packTangentFrame, buildTangents, buildNormals } from '@maptalks/tbn-packer';
import { isNumber, extend, isArray, isSupportVAO } from './common/Util';
import BoundingBox from './BoundingBox';
import { KEY_DISPOSED } from './common/Constants';

const DEFAULT_DESC = {
    'positionSize': 3,
    'primitive': 'triangles',
    //name of position attribute
    'positionAttribute': 'aPosition',
    'normalAttribute': 'aNormal',
    'uv0Attribute': 'aTexCoord',
    'uv1Attribute': 'aTexCoord1',
    'tangentAttribute': 'aTangent'
};

export default class Geometry {
    constructor(data, elements, count, desc) {
        this.data = data;
        this.elements = elements;
        this.desc = extend({}, DEFAULT_DESC, desc);
        const pos = data[this.desc.positionAttribute];
        if (!count) {
            if (elements) {
                count = getElementLength(elements);
            } else if (pos && pos.length) {
                count = pos.length / this.desc.positionSize;
            }
        }
        this.count = count;
        if (!this.elements) {
            this.elements = count;
        }
        this.properties = {};
        this._buffers = {};
        this._vao = {};
        this.updateBoundingBox();
        this.getVertexCount();
    }

    getREGLData(regl, activeAttributes) {
        let updated = false;
        if (!this._reglData) {
            const data = this.data;
            const { positionAttribute, normalAttribute, uv0Attribute, uv1Attribute, tangentAttribute } = this.desc;
            this._reglData = extend({}, this.data);
            delete this._reglData[positionAttribute];
            this._reglData['aPosition'] = data[positionAttribute];
            if (data[normalAttribute]) {
                delete this._reglData[normalAttribute];
                this._reglData['aNormal'] = data[normalAttribute];
            }
            if (data[uv0Attribute]) {
                delete this._reglData[uv0Attribute];
                this._reglData['aTexCoord'] = data[uv0Attribute];
            }
            if (data[uv1Attribute]) {
                delete this._reglData[uv1Attribute];
                this._reglData['aTexCoord1'] = data[uv1Attribute];
            }
            if (data[tangentAttribute]) {
                delete this._reglData[tangentAttribute];
                this._reglData['aTangent'] = data[tangentAttribute];
            }
            updated = true;
        }
        //support vao
        if (isSupportVAO(regl)) {
            const key = activeAttributes.key;
            if (!this._vao[key] || updated) {
                const vertexCount = this.getVertexCount();
                const buffers = activeAttributes.map(p => {
                    const attr = p.name;
                    const buffer = this._reglData[attr].buffer;
                    if (!buffer || !buffer.destroy) {
                        const data = this._reglData[attr];
                        const dimension = (data.data && isArray(data.data) ? data.data.length : data.length) / vertexCount;
                        if (data.data) {
                            data.dimension = dimension;
                            return data;
                        } else {
                            return {
                                data,
                                dimension
                            };
                        }
                    } else {
                        return buffer;
                    }
                });
                if (!this._vao[key]) {
                    this._vao[key] = {
                        vao: regl.vao(buffers)
                    };
                } else {
                    this._vao[key].vao(buffers);
                }
            }
            return this._vao[key];
        }
        return this._reglData;
    }

    generateBuffers(regl) {
        //generate regl buffers beforehand to avoid repeated bufferData
        //提前处理addBuffer插入的arraybuffer
        const allocatedBuffers = this._buffers;
        for (const p in allocatedBuffers) {
            if (!allocatedBuffers[p].buffer) {
                allocatedBuffers[p].buffer = regl.buffer(allocatedBuffers[p].data);
            }
            delete allocatedBuffers[p].data;
        }
        const data = this.data;
        const vertexCount = this.getVertexCount();
        const buffers = {};
        for (const key in data) {
            if (!data[key]) {
                continue;
            }
            //如果调用过addBuffer，buffer有可能是ArrayBuffer
            if (data[key].buffer && !(data[key].buffer instanceof ArrayBuffer)) {
                if (data[key].buffer.destroy) {
                    buffers[key] = data[key];
                } else if (allocatedBuffers[data[key].buffer]) {
                    //多个属性共用同一个ArrayBuffer(interleaved)
                    buffers[key] = extend({}, data[key]);
                    buffers[key].buffer = allocatedBuffers[data[key].buffer].buffer;
                }
            } else {
                const dimension = data[key].data ? data[key].data.length / vertexCount : data[key].length / vertexCount;
                const info = data[key].data ? data[key] : { data: data[key] };
                info.dimension = dimension;
                buffers[key] = {
                    buffer : regl.buffer(info)
                };
            }
        }
        this.data = buffers;
        delete this._reglData;

        if (this.elements && !isNumber(this.elements)) {
            this.elements = this.elements.destroy ? this.elements : regl.elements({
                primitive: this.getPrimitive(),
                data: this.elements,
                //type : 'uint16' // type is inferred from data
            });
        }
    }

    getVertexCount() {
        if (this._vertexCount === undefined) {
            const { positionAttribute, positionSize } = this.desc;
            let data = this.data[positionAttribute];
            if (data.data) {
                data = data.data;
            }
            this._vertexCount = data.length /  positionSize;
        }
        return this._vertexCount;
    }

    /**
     * 手动设置geometry的buffer，用于多个属性共用一个ArrayBuffer(interleaved)
     * @param {String} key - 属性
     * @param {ArrayBuffer|REGLBuffer} data - 数据
     */
    addBuffer(key, data) {
        this._buffers[key] = {
            data
        };
        delete this._reglData;
        this._deleteVAO();
        return this;
    }

    updateBuffer(key, data) {
        if (!this._buffers[key]) {
            throw new Error(`invalid buffer ${key} in geometry`);
        }
        // this._buffers[key].data = data;
        if (this._buffers[key].buffer) {
            this._buffers[key].buffer.subdata(data);
        } else {
            this._buffers[key].data = data;
        }
        delete this._reglData;
        this._deleteVAO();
        return this;
    }

    /**
     * Replace data or refill attribute data buffer
     * @param {String} name - data's name
     * @param {Number[] | Object} data - data to update
     * @returns this
     */
    updateData(name, data) {
        const buf = this.data[name];
        if (!buf) {
            return this;
        }
        let buffer;
        this.data[name] = data;
        if (buf.buffer && buf.buffer.destroy) {
            buffer = buf;
        }
        if (name === this.desc.positionAttribute) {
            this.updateBoundingBox();
            delete this._vertexCount;
            this.getVertexCount();
        }
        if (buffer) {
            buffer.buffer.subdata(data);
            this.data[name] = buffer;
        }
        delete this._reglData;
        return this;
    }

    getPrimitive() {
        return this.desc.primitive;
    }

    getElements() {
        return this.elements;
    }

    setElements(elements, count) {
        if (!elements) {
            throw new Error('elements data is invalid');
        }
        const e = this.elements;
        this.count = count === undefined ? getElementLength(elements) : count;

        if (e.destroy) {
            this.elements = e(elements);
        } else {
            this.elements = elements;
        }
        return this;
    }

    setDrawCount(count) {
        this.count1 = count;
        return this;
    }

    getDrawCount() {
        return this.count1 || this.count;
    }

    setDrawOffset(offset) {
        this.offset = offset;
        return this;
    }

    getDrawOffset() {
        return this.offset || 0;
    }

    dispose() {
        this._deleteVAO();
        this._forEachBuffer(buffer => {
            if (!buffer[KEY_DISPOSED]) {
                buffer[KEY_DISPOSED] = true;
                buffer.destroy();
            }
        });
        this.data = {};
        this._buffers = {};
        delete this._reglData;
        delete this._attributes;
        this.count = 0;
        this.elements = [];
        this._disposed = true;
    }

    isDisposed() {
        return !!this._disposed;
    }

    /**
     * Update boundingBox of Geometry
     */
    updateBoundingBox() {
        let bbox = this.boundingBox;
        if (!bbox) {
            bbox = this.boundingBox = new BoundingBox();
        }
        const posAttr = this.desc.positionAttribute;
        let posArr = this.data[posAttr];
        if (!isArray(posArr)) {
            // form of object: { usage : 'static', data : [...] }
            posArr = posArr.data;
        }
        if (posArr && posArr.length) {
            //TODO only support size of 3 now
            const min = bbox.min;
            const max = bbox.max;
            vec3.set(min, posArr[0], posArr[1], posArr[2]);
            vec3.set(max, posArr[0], posArr[1], posArr[2]);
            for (let i = 3; i < posArr.length;) {
                const x = posArr[i++];
                const y = posArr[i++];
                const z = posArr[i++];
                if (x < min[0]) { min[0] = x; }
                if (y < min[1]) { min[1] = y; }
                if (z < min[2]) { min[2] = z; }

                if (x > max[0]) { max[0] = x; }
                if (y > max[1]) { max[1] = y; }
                if (z > max[2]) { max[2] = z; }
            }
            bbox.dirty();
        }
    }

    createTangent(name = 'aTangent') {
        const { normalAttribute, positionAttribute, uv0Attribute } = this.desc;
        const normals = this.data[normalAttribute];
        const tangents = buildTangents(
            this.data[positionAttribute],
            normals,
            this.data[uv0Attribute],
            this.elements
        );
        const aTangent = this.data[name] = new Float32Array(tangents.length);
        const t = [], n = [], q = [];
        for (let i = 0; i < tangents.length; i += 4) {
            const ni = i / 4 * 3;
            vec3.set(n, normals[ni], normals[ni + 1], normals[ni + 2]);
            vec4.set(t, tangents[i], tangents[i + 1], tangents[i + 2], tangents[i + 3]);
            packTangentFrame(q, n, t);
            vec4.copy(aTangent.subarray(i, i + 4), q);
        }
    }

    createNormal(name = 'aNormal') {
        const vertices = this.data[this.desc.positionAttribute];
        this.data[name] = buildNormals(vertices, this.elements);
    }

    /**
     * Create barycentric attribute data
     * @param {String} name - attribute name for barycentric attribute
     */
    createBarycentric(name = 'aBarycentric') {
        if (this.desc.primitive !== 'triangles') {
            throw new Error('Primitive must be triangles to create bary centric data');
        }
        const bary = new Uint8Array(this.getVertexCount() * 3);
        for (let i = 0, l = this.elements.length; i < l;) {
            for (let j = 0; j < 3; j++) {
                const ii = this.elements[i++];
                bary[ii * 3 + j] = 1;
            }
        }
        this.data[name] = bary;
    }

    /**
     * Build unique vertex data for each attribute
     */
    buildUniqueVertex() {
        const data = this.data;
        const indices = this.elements;
        if (!isArray(indices)) {
            throw new Error('elements must be array to build unique vertex.');
        }

        const keys = Object.keys(data);
        const oldData = {};

        const pos = data[this.desc.positionAttribute];
        if (!isArray(pos)) {
            throw new Error(this.desc.positionAttribute + ' must be array to build unique vertex.');
        }
        const vertexCount = this.getVertexCount();

        const l = indices.length;
        for (let i = 0; i < keys.length; i++) {
            const name = keys[i];
            const size = data[name].length / vertexCount;
            if (!isArray(data[name])) {
                throw new Error(name + ' must be array to build unique vertex.');
            }
            oldData[name] = data[name];
            oldData[name].size = size;
            data[name] = new data[name].constructor(l * size);
        }

        let cursor = 0;
        for (let i = 0; i < l; i++) {
            const idx = indices[i];
            for (let ii = 0; ii < keys.length; ii++) {
                const name = keys[ii];
                const array = data[name];
                const size = oldData[name].size;

                for (let k = 0; k < size; k++) {
                    array[cursor * size + k] = oldData[name][idx * size + k];
                }
            }
            indices[i] = cursor++;
        }
    }

    getMemorySize() {
        let size = 0;
        for (const p in this.data) {
            if (this.data.hasOwnProperty(p)) {
                const buffer = this.data[p];
                if (buffer.data) {
                    size += buffer.data.length * buffer.data.BYTES_PER_ELEMENT;
                } else {
                    size += buffer.length * buffer.BYTES_PER_ELEMENT;
                }
            }
        }
        return size;
    }

    _deleteVAO() {
        for (const p in this._vao) {
            this._vao[p].vao.destroy();
        }
        this._vao = {};
    }

    _forEachBuffer(fn) {
        if (this.elements && this.elements.destroy)  {
            fn(this.elements);
        }
        for (const p in this.data) {
            if (this.data.hasOwnProperty(p)) {
                if (this.data[p] && this.data[p].buffer && this.data[p].buffer.destroy) {
                    fn(this.data[p].buffer);
                }
            }
        }

        for (const p in this._buffers) {
            if (this._buffers.hasOwnProperty(p)) {
                if (this._buffers[p] && this._buffers[p].buffer && this._buffers[p].buffer.destroy) {
                    fn(this._buffers[p].buffer);
                }
            }
        }
    }
}

function getElementLength(elements) {
    if (isNumber(elements)) {
        return elements;
    } else if (elements.length !== undefined) {
        return elements.length;
    } else if (elements.data) {
        return elements.data.length;
    }
    throw new Error('invalid elements length');
}

// function buildTangents2(vertices, normals, uvs, indices) {
//     const vtxCount = vertices.length / 3;
//     const tangent = new Array(vtxCount * 4);
//     const tanA = new Array(vertices.length);
//     const tanB = new Array(vertices.length);

//     // (1)
//     const indexCount = indices.length;
//     for (let i = 0; i < indexCount; i += 3) {
//         const i0 = indices[i];
//         const i1 = indices[i + 1];
//         const i2 = indices[i + 2];

//         const pos0 = vec3.set([], vertices[i0 * 3], vertices[i0 * 3 + 1], vertices[i0 * 3 + 2]);
//         const pos1 = vec3.set([], vertices[i1 * 3], vertices[i1 * 3 + 1], vertices[i1 * 3 + 2]);
//         const pos2 = vec3.set([], vertices[i2 * 3], vertices[i2 * 3 + 1], vertices[i2 * 3 + 2]);

//         const tex0 = vec2.set([], uvs[i0 * 2], uvs[i0 * 2 + 1]);
//         const tex1 = vec2.set([], uvs[i1 * 2], uvs[i1 * 2 + 1]);
//         const tex2 = vec2.set([], uvs[i2 * 2], uvs[i2 * 2 + 1]);

//         const edge1 = vec3.sub([], pos1, pos0);
//         const edge2 = vec3.sub([], pos2, pos0);

//         const uv1 = vec2.sub([], tex1, tex0);
//         const uv2 = vec2.sub([], tex2, tex0);

//         const r = 1.0 / (uv1[0] * uv2[1] - uv1[1] * uv2[0]);

//         const tangent = [
//             ((edge1[0] * uv2[1]) - (edge2[0] * uv1[1])) * r,
//             ((edge1[1] * uv2[1]) - (edge2[1] * uv1[1])) * r,
//             ((edge1[2] * uv2[1]) - (edge2[2] * uv1[1])) * r
//         ];

//         const bitangent = [
//             ((edge1[0] * uv2[0]) - (edge2[0] * uv1[0])) * r,
//             ((edge1[1] * uv2[0]) - (edge2[1] * uv1[0])) * r,
//             ((edge1[2] * uv2[0]) - (edge2[2] * uv1[0])) * r
//         ];

//         tanA[i0] = tanA[i0] || [0, 0, 0];
//         tanA[i1] = tanA[i1] || [0, 0, 0];
//         tanA[i2] = tanA[i2] || [0, 0, 0];
//         vec3.add(tanA[i0], tanA[i0], tangent);
//         vec3.add(tanA[i1], tanA[i1], tangent);
//         vec3.add(tanA[i2], tanA[i2], tangent);
//         // tanA[i0] += tangent;
//         // tanA[i1] += tangent;
//         // tanA[i2] += tangent;

//         tanB[i0] = tanB[i0] || [0, 0, 0];
//         tanB[i1] = tanB[i1] || [0, 0, 0];
//         tanB[i2] = tanB[i2] || [0, 0, 0];
//         vec3.add(tanB[i0], tanB[i0], bitangent);
//         vec3.add(tanB[i1], tanB[i1], bitangent);
//         vec3.add(tanB[i2], tanB[i2], bitangent);
//         // tanB[i0] += bitangent;
//         // tanB[i1] += bitangent;
//         // tanB[i2] += bitangent;
//     }

//     // (2)
//     for (let j = 0; j < vtxCount; j++) {
//         const n = vec3.set([], normals[j * 3], normals[j * 3 + 1], normals[j * 3 + 2]);
//         const t0 = tanA[j];
//         const t1 = tanB[j];

//         const n1 = vec3.scale([], n, vec3.dot(n, t0));
//         const t = vec3.sub([], t0, n1);
//         vec3.normalize(t, t);
//         // const t = t0 - (n * dot(n, t0));
//         // t = normaljze(t);

//         const c = vec3.cross(n, n, t0);
//         const w = (vec3.dot(c, t1) < 0) ? -1.0 : 1.0;
//         tangent[j * 4] = t[0];
//         tangent[j * 4 + 1] = t[1];
//         tangent[j * 4 + 2] = t[2];
//         tangent[j * 4 + 3] = w;
//     }
//     return tangent;
// }

