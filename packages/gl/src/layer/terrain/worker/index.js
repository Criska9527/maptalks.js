import { Ajax } from '@maptalks/gltf-loader';
import "./zlib.min";
import Martini from '@maptalks/martini';
import { vec2, vec3 } from 'gl-matrix';
// 保存当前的workerId，用于告知主线程结果回传给哪个worker
let workerId;

let BITMAP_CANVAS = null;
let BITMAP_CTX = null;

const terrainRequests = {};

const terrainStructure = {
    width: 64,
    height: 64,
    elementsPerHeight: 3,
    heightOffset: -1000,
    exaggeration: 1.0,
    heightScale: 0.001,
    elementMultiplier: 256,
    stride: 4,
    skirtHeight: 0.002,
    skirtOffset: 0.01 //用于减少地形瓦片之间的缝隙
}
const requestHeaders = {
    'cesium_request_token': {
        'Accept': "application/json,*/*;q=0.01",
        'Accept-Encoding': 'gzip, deflate, br'
    },
    'tianditu': {
        'Accept-Encoding': 'gzip, deflate, br'
    },
    'cesium': {
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept': 'application/vnd.quantized-mesh,application/octet-stream;q=0.9,*/*;q=0.01'
    },
    'mapbox': {
        'Accept': 'image/webp,*/*'
    }
};
requestHeaders['cesium-ion'] = requestHeaders['cesium'];
const maxShort = 32767;
let cesium_access_token = null;
let cesiumAccessTokenPromise = null;
function load(url, headers, origin) {
    const options = {
        method: 'GET',
        referrer: origin,
        headers
    };
    const promise = Ajax.getArrayBuffer(url, options);
    const controller = promise.xhr;
    terrainRequests[url] = controller;
    return promise.then(res => {
        delete terrainRequests[url];
        return res;
    });
}

function abort(url) {
    if (terrainRequests[url]) {
        terrainRequests[url].abort();
        delete terrainRequests[url];
    }
}

function createHeightMap(heightmap, terrainWidth/*, exag*/) {
    const width = terrainWidth, height = terrainWidth;
    const endRow = width + 1, endColum = height + 1;
    const elementsPerHeight = terrainStructure.elementsPerHeight;
    const heightOffset = terrainStructure.heightOffset;
    const exaggeration = 1;//terrainStructure.exaggeration || exag;
    const heightScale = terrainStructure.heightScale;
    const elementMultiplier = terrainStructure.elementMultiplier;
    const stride = 4;
    const skirtHeight = terrainStructure.skirtHeight;
    const heights = new Float32Array(endRow * endColum);
    let index = 0;
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < endRow; i++) {
        const row = i >= height ? height - 1 : i;
        for(let j = 0; j < endColum; j++) {
            const colum = j >= width ? width - 1 : j;
            let heightSample = 0;
            const terrainOffset = row * (width * stride) + colum * stride;
            for (let elementOffset = 0; elementOffset < elementsPerHeight; elementOffset++) {
                heightSample = (heightSample * elementMultiplier) + heightmap[terrainOffset + elementOffset];
            }
            heightSample = (heightSample * heightScale + heightOffset) * exaggeration;
            heightSample -= skirtHeight;
            heights[index] = heightSample;
            if (heightSample < min) {
                min = heightSample;
            }
            if (heightSample > max) {
                max = heightSample;
            }
            index++;
        }
    }
    return { data: heights, min, max };
}

function decZlibBuffer(zBuffer) {
    if (zBuffer.length < 1000) {
        return null;
    }
    const inflate = new Zlib.Inflate(zBuffer);

    if (inflate) {
        return inflate.decompress();
    }
    return null;
}

function transformBuffer(zlibData){
    const DataSize = 2;
    const dZlib = zlibData;
    const height_buffer = new ArrayBuffer(DataSize);
    const height_view = new DataView(height_buffer);

    const myW = terrainStructure.width;
    const myH = terrainStructure.height;
    const myBuffer = new Uint8Array(myW * myH * terrainStructure.stride);

    let i_height;
    let NN, NN_R;
    let jj_n, ii_n;
    for (let jj = 0; jj < myH; jj++) {
        for (let ii = 0; ii < myW; ii++) {
            jj_n = parseInt((149 * jj) / (myH - 1));
            ii_n = parseInt((149 * ii) / (myW - 1));
            if (DataSize === 4) {
                NN = DataSize * (jj_n * 150 + ii_n);
                height_view.setInt8(0, dZlib[NN]);
                height_view.setInt8(1, dZlib[NN + 1]);
                height_view.setInt8(2, dZlib[NN + 2]);
                height_view.setInt8(3, dZlib[NN + 3]);
                i_height = height_view.getFloat32(0, true);

            } else {
                NN = DataSize * (jj_n * 150 + ii_n);
                i_height = dZlib[NN] + (dZlib[NN + 1] * 256);
            }
            if (i_height > 10000 || i_height < -2000) {//低于海平面2000，高于地面10000
                i_height = 0;
            }
            NN_R = (jj * myW + ii) * 4;
            const i_height_new = (i_height + 1000) / terrainStructure.heightScale;
            const elementMultiplier = terrainStructure.elementMultiplier;
            myBuffer[NN_R] = i_height_new / (elementMultiplier * elementMultiplier);
            myBuffer[NN_R + 1] = (i_height_new - myBuffer[NN_R] * elementMultiplier * elementMultiplier) / elementMultiplier;
            myBuffer[NN_R + 2] = i_height_new - myBuffer[NN_R] * elementMultiplier * elementMultiplier - myBuffer[NN_R + 1] * elementMultiplier;
            myBuffer[NN_R + 3] = 255;
        }
    }
    return myBuffer;
}

function generateTiandituTerrain(buffer, terrainWidth) {
    const view = new DataView(buffer);
    const zBuffer = new Uint8Array(view.byteLength);
    let index = 0;
    while (index < view.byteLength) {
        zBuffer[index] = view.getUint8(index, true);
        index++;
    }
    //解压数据
    const dZlib = decZlibBuffer(zBuffer);
    const heightBuffer = transformBuffer(dZlib);
    const heights = createHeightMap(heightBuffer, terrainWidth - 1);
    heights.width = heights.height = terrainWidth - 1;
    return heights;
}

function zigZagDecode(value) {
    return (value >> 1) ^ -(value & 1);
}

function lerp(p, q, time) {
    return (1.0 - time) * p + time * q;
}

const POSITIONS = [];

function generateCesiumTerrain(buffer) {
    // cesium 格式说明：
    // https://www.cnblogs.com/oloroso/p/11080222.html
    let pos = 0;
    const cartesian3Elements = 3;
    // const boundingSphereElements = cartesian3Elements + 1;
    const cartesian3Length = Float64Array.BYTES_PER_ELEMENT * cartesian3Elements;
    // const boundingSphereLength =
    // Float64Array.BYTES_PER_ELEMENT * boundingSphereElements;
    const encodedVertexElements = 3;
    const encodedVertexLength =
    Uint16Array.BYTES_PER_ELEMENT * encodedVertexElements;
    const triangleElements = 3;
    let bytesPerIndex = Uint16Array.BYTES_PER_ELEMENT;

    const view = new DataView(buffer);
    pos += cartesian3Length;

    const minimumHeight = view.getFloat32(pos, true);
    pos += Float32Array.BYTES_PER_ELEMENT;
    const maximumHeight = view.getFloat32(pos, true);
    pos += Float32Array.BYTES_PER_ELEMENT;
    pos += cartesian3Length;
    const radius = view.getFloat64(pos, true);
    pos += Float64Array.BYTES_PER_ELEMENT;
    pos += cartesian3Length;

    const vertexCount = view.getUint32(pos, true);
    pos += Uint32Array.BYTES_PER_ELEMENT;
    const encodedVertexBuffer = new Uint16Array(buffer, pos, vertexCount * 3);
    pos += vertexCount * encodedVertexLength;

    if (vertexCount > 64 * 1024) {
        bytesPerIndex = Uint32Array.BYTES_PER_ELEMENT;
    }

    const uBuffer = encodedVertexBuffer.subarray(0, vertexCount);
    const vBuffer = encodedVertexBuffer.subarray(vertexCount, 2 * vertexCount);
    const heightBuffer = encodedVertexBuffer.subarray(
        vertexCount * 2,
        3 * vertexCount
    );

    zigZagDeltaDecode(uBuffer, vBuffer, heightBuffer);

    if (pos % bytesPerIndex !== 0) {
        pos += bytesPerIndex - (pos % bytesPerIndex);
    }

    const triangleCount = view.getUint32(pos, true);
    pos += Uint32Array.BYTES_PER_ELEMENT;
    const indices = vertexCount > 65536 ? new Uint32Array(buffer, pos, triangleCount * triangleElements) : new Uint16Array(buffer, pos, triangleCount * triangleElements);

    let highest = 0;
    const length = indices.length;
    for (let i = 0; i < length; ++i) {
        const code = indices[i];
        indices[i] = highest - code;
        if (code === 0) {
            ++highest;
        }
    }
    const terrain = {
        minimumHeight: minimumHeight,
        maximumHeight: maximumHeight,
        quantizedVertices: encodedVertexBuffer,
        indices: indices,
    };

    const quantizedVertices = terrain.quantizedVertices;
    const quantizedVertexCount = quantizedVertices.length / 3;
    const uBuffer_1 = quantizedVertices.subarray(0, quantizedVertexCount);
    const vBuffer_1 = quantizedVertices.subarray(
        quantizedVertexCount,
        2 * quantizedVertexCount
    );
    const heightBuffer_1 = quantizedVertices.subarray(
        quantizedVertexCount * 2,
        3 * quantizedVertexCount
    );
    const positions = POSITIONS;
    for (let i = 0; i < quantizedVertexCount; ++i) {
        const rawU = uBuffer_1[i];
        const rawV = vBuffer_1[i];

        const u = rawU / maxShort;
        const v = rawV / maxShort;
        const height = lerp(
            minimumHeight,
            maximumHeight,
            heightBuffer_1[i] / maxShort
        );
        positions[i * 3] = u;
        positions[i * 3 + 1] = (1 - v);
        positions[i * 3 + 2] = height;
    }
    return { positions, radius, min: minimumHeight, max: maximumHeight, indices}
}

const P0P1 = [];
const P1P2 = [];
const A = [];
const B = [];
const C = [];

class Triangle {
    constructor(positions, a, b, c, radius) {
        this.p0 = [];
        this.p1 = [];
        this.p2 = [];
        this.normal = [];
        this.min = [];
        this.max = [];
        this.set(positions, a, b, c, radius);
    }

    set(positions, a, b, c, radius) {
        this.radius = radius;
        let x = a * 3;
        let y = a * 3 + 1;
        let z = a * 3 + 2;
        this.p0[0] = positions[x] * radius;
        this.p0[1] = positions[y] * radius;
        this.p0[2] = positions[z];
        x = b * 3;
        y = b * 3 + 1;
        z = b * 3 + 2;
        this.p1[0] = positions[x] * radius;
        this.p1[1] = positions[y] * radius;
        this.p1[2] = positions[z];
        x = c * 3;
        y = c * 3 + 1;
        z = c * 3 + 2;
        this.p2[0] = positions[x] * radius;
        this.p2[1] = positions[y] * radius;
        this.p2[2] = positions[z];

        this.min[0] = Math.min(this.p0[0], this.p1[0], this.p2[0]);
        this.min[1] = Math.min(this.p0[1], this.p1[1], this.p2[1]);

        this.max[0] = Math.max(this.p0[0], this.p1[0], this.p2[0]);
        this.max[1] = Math.max(this.p0[1], this.p1[1], this.p2[1]);

        const p0p1 = vec3.sub(P0P1, this.p1, this.p0);
        const p1p2 = vec3.sub(P1P2, this.p2, this.p1);
        this.normal = vec3.normalize(this.normal, vec3.cross(this.normal, p0p1, p1p2));
    }

    contains(x, y) {
        if (x < this.min[0] || x > this.max[0] || y < this.min[1] || y > this.max[1]) {
            return false;
        }
        vec2.set(A, this.p0[0], this.p0[1]);
        vec2.set(B, this.p1[0], this.p1[1]);
        vec2.set(C, this.p2[0], this.p2[1]);
        const SABC = calTriangleArae(A[0], A[1], B[0], B[1], C[0], C[1]);
        const SPAC = calTriangleArae(x, y, A[0], A[1], C[0], C[1]);
        const SPAB = calTriangleArae(x, y, A[0], A[1], B[0], B[1]);
        const SPBC = calTriangleArae(x, y, B[0], B[1], C[0], C[1]);
        return SPAC + SPAB + SPBC - SABC <= 0.0001;
    }

    getHeight(x, y) {
        // https://stackoverflow.com/questions/18755251/linear-interpolation-of-three-3d-points-in-3d-space
        //z1 - ((x4-x1)*N.x + (y4-y1)*N.y)/ N.z
        const N = this.normal;
        return this.p0[2] - ((x - this.p0[0]) * N[0] + (y - this.p0[1]) * N[1]) / N[2];
    }
}

// 当前像素命中某三角形后，下一个像素也很可能会在该三角形中，可以节省一些循环
let preTriangle = null;
function findInTriangle(triangles, x, y) {
    if (preTriangle && preTriangle.contains(x, y)) {
        return preTriangle.getHeight(x, y);
    }
    for (let i = 0; i < triangles.length; i++) {
        if (triangles[i].contains(x, y)) {
            preTriangle = triangles[i];
            return triangles[i].getHeight(x, y);
        }
    }
    return 0;
}
const TRIANGLES = [];

function cesiumTerrainToHeights(cesiumTerrain, terrainWidth) {
    const { positions, min, max, indices, radius } = cesiumTerrain;
    const triangles = [];
    let index = 0;
    for (let i = 0; i < indices.length; i += 3) {
        let triangle = TRIANGLES[index];
        if (triangle) {
            triangle.set(positions, indices[i], indices[i + 1], indices[i + 2], radius * 2);
        } else {
            triangle = TRIANGLES[index] =  new Triangle(positions, indices[i], indices[i + 1], indices[i + 2], radius * 2);
        }
        index++;
        triangles.push(triangle);
    }
    const heights = new Float32Array(terrainWidth * terrainWidth);
    index = 0;
    for (let i = 0; i < terrainWidth; i++) {
        for (let j = 0; j < terrainWidth; j++) {
            heights[index++] = findInTriangle(triangles, j / terrainWidth * radius * 2, i / terrainWidth * radius * 2);
        }
    }

    const result = { data: heights, min, max, width: terrainWidth, height: terrainWidth };

    return result;
}



function calTriangleArae(x1, y1, x2, y2, x3, y3) {
    return Math.abs(x1 * y2 + x2 * y3 + x3 * y1 - x1 * y3 - x2 * y1 - x3 * y2) * 0.5;
}

function zigZagDeltaDecode(uBuffer, vBuffer, heightBuffer) {
    const count = uBuffer.length;

    let u = 0;
    let v = 0;
    let height = 0;

    for (let i = 0; i < count; ++i) {
        u += zigZagDecode(uBuffer[i]);
        v += zigZagDecode(vBuffer[i]);

        uBuffer[i] = u;
        vBuffer[i] = v;

        if (heightBuffer) {
            height += zigZagDecode(heightBuffer[i]);
            heightBuffer[i] = height;
        }
    }
}

function generateMapboxTerrain(buffer) {
    const blob = new self.Blob([new Uint8Array(buffer)]);
    return self.createImageBitmap(blob);
}

function loadTerrain(params, cb) {
    const { url, origin, type, accessToken, terrainWidth, error, maxAvailable } = params;
    const headers = params.headers || requestHeaders[type];
    if (type === 'tianditu') {
        fetchTerrain(url, headers, type, terrainWidth, error, maxAvailable, cb);
    } else if (type === 'cesium-ion') {
        const tokenUrl = params.cesiumIonTokenURL + accessToken;
        if (cesium_access_token) {
            fetchTerrain(url, headers, type, terrainWidth, error, maxAvailable, cb);
        } else if (cesiumAccessTokenPromise) {
            cesiumAccessTokenPromise.then(() => {
                fetchTerrain(url, headers, type, terrainWidth, error, maxAvailable, cb);
            });
        } else {
            cesiumAccessTokenPromise = fetch(tokenUrl, {
                responseType: "json",
                method: 'GET',
                referrer: origin,
                headers: {
                    Accept: "application/json,*/*;q=0.01",
                    'Accept-Encoding': 'gzip, deflate, br',
                },
            }).then(tkJson => {
                return tkJson.json();
            }).then(res => {
                cesium_access_token = res.accessToken;
                cesiumAccessTokenPromise = null;
            });
            cesiumAccessTokenPromise.then(() => {
                fetchTerrain(url, headers, type, terrainWidth, error, maxAvailable, cb);
            });
        }
    } else if (type === 'cesium') {
        fetchTerrain(url, headers, type, terrainWidth, error, maxAvailable, cb);
    } else if (type === 'mapbox') {
        fetchTerrain(url, headers, type, terrainWidth, error, maxAvailable, cb);
    }
}

function fetchTerrain(url, headers, type, terrainWidth, error, maxAvailable, cb) {
    if (type === 'cesium-ion') {
        headers['Authorization'] = 'Bearer ' + cesium_access_token;
    }
    load(url, headers, origin).then(res => {
        if (!res || res.message) {
            if (!res) {
                // aborted by user
                cb({ error: res || { canceled: true }});
            } else {
                const terrainData = createEmtpyTerrainImage(terrainWidth);
                // console.warn(e);
                triangulateTerrain(error, terrainData, terrainWidth, false, null, null, true, false, (data, transferables) => {
                    data.originalError = res;
                    cb(data, transferables);
                });
            }
        } else {
            const buffer = res.data;
            let terrain = null;
            if (type === 'tianditu') {
                const terrainData = generateTiandituTerrain(buffer, terrainWidth);
                triangulateTerrain(error, terrainData, terrainWidth, maxAvailable, null, null, true, true, cb);
            } else if (type === 'cesium-ion' || type === 'cesium') {
                terrain = generateCesiumTerrain(buffer);
                const terrainData = cesiumTerrainToHeights(terrain, terrainWidth);
                triangulateTerrain(error, terrainData, terrainWidth, maxAvailable, null, null, true, true, cb);
            } else if (type === 'mapbox') {
                terrain = generateMapboxTerrain(buffer);
                terrain.then(imgBitmap => {
                    const imageData = bitmapToImageData(imgBitmap);
                    const terrainData = mapboxBitMapToHeights(imageData, terrainWidth);
                    triangulateTerrain(error, terrainData, terrainWidth, maxAvailable, imageData, imgBitmap, true, true, cb);
                });

                // terrain = generateMapboxTerrain(buffer);
                // terrain.then(imgBitmap => {
                //     const terrainData = createEmtpyTerrainImage(terrainWidth);
                //     // console.warn(e);
                //     triangulateTerrain(error, terrainData, terrainWidth, false, null, imgBitmap,  true, false, (data, transferables) => {
                //         cb(data, transferables);
                //     });
                // });
            }
        }
    }).catch(e => {
        delete terrainRequests[url];
        const terrainData = createEmtpyTerrainImage(terrainWidth);
        // console.warn(e);
        triangulateTerrain(error, terrainData, terrainWidth, false, null, null,  true, false, (data, transferables) => {
            data.originalError = e;
            cb(data, transferables);
        });
        // cb({ error: e});
    });
}

function createEmtpyTerrainImage(size) {
    const length = size * size;
    return {
        data: new Uint8Array(length),
        width: size,
        height: size,
        max: 0,
        min: 0
    };
}


function triangulateTerrain(error, terrainData, terrainWidth, maxAvailable, imageData, imageBitmap, isTransferData, hasSkirts, cb) {
    const mesh = createMartiniData(error, terrainData.data, terrainWidth, true);
    const transferables = [mesh.positions.buffer, mesh.texcoords.buffer, mesh.triangles.buffer];
    if (imageBitmap) {
        transferables.push(imageBitmap);
    }
    const data = { mesh };
    data.image = imageBitmap;
    if (isTransferData) {
        data.data = terrainData;
        if (maxAvailable && imageData) {
            const originalTerrainData = mapboxBitMapToHeights(imageData, imageData.width + 1);
            data.data = originalTerrainData;
            transferables.push(originalTerrainData.data.buffer);
        } else {
            transferables.push(terrainData.data.buffer);
        }
    }
    cb(data, transferables);
}

function bitmapToImageData(imgBitmap) {
    const { width, height } = imgBitmap;
    // const pow = Math.floor(Math.log(width) / Math.log(2));
    // width = height = Math.pow(2, pow) + 1;

    // TODO 需要解决OffscreenCanvas的兼容性：不支持时，在主线程里获取imageData
    // const supportOffscreenCanvas = typeof OffscreenCanvas !== undefined;
    if (!BITMAP_CANVAS) {
        BITMAP_CANVAS = new OffscreenCanvas(1, 1);
        BITMAP_CTX = BITMAP_CANVAS.getContext('2d', { willReadFrequently: true });
    }

    BITMAP_CANVAS.width = width;
    BITMAP_CANVAS.height = height;
    BITMAP_CTX.drawImage(imgBitmap, 0, 0, width, height);
    return BITMAP_CTX.getImageData(0, 0, width, height);
}

function mapboxBitMapToHeights(imageData, terrainWidth) {

    const { data: imgData, width } = imageData;
    // const terrainWidth = width;

    let min = Infinity;
    let max = -Infinity;


    const heights = new Float32Array(terrainWidth * terrainWidth);

    const stride = Math.round(width / terrainWidth);

    const edge = terrainWidth - 1 - 1;

    for (let i = 0; i < terrainWidth; i++) {
        for (let j = 0; j < terrainWidth; j++) {
            const index = i + j * terrainWidth;
            let height = 0;

            let nullCount = 0;
            let tx = i;
            let ty = j;
            if (tx >= edge) {
                tx = edge;
            }
            if (ty >= edge) {
                ty = edge;
            }
            for (let k = 0; k < stride; k++) {
                for (let l = 0; l < stride; l++) {
                    const x = tx * stride + k;
                    const y = ty * stride + l;
                    const imageIndex = x + y * width;
                    const R = imgData[imageIndex * 4];
                    const G = imgData[imageIndex * 4 + 1];
                    const B = imgData[imageIndex * 4 + 2];
                    const A = imgData[imageIndex * 4 + 3];
                    if (A === 0) {
                        nullCount += 1;
                    } else {
                        height += -10000 + ((R * 256 * 256 + G * 256 + B) * 0.1);
                    }
                }
            }
            const count = (stride * stride - nullCount);
            height = height / (count || 1);
            if (height > max) {
                max = height;
            }
            if (height < min) {
                min = height;
            }
            heights[index] = height;
        }
    }
    // debugger
    // const terrainData = createMartiniData(heights, terrainWidth);
    // offscreenCanvasContext.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
    return { data: heights, /*terrainData, */width: terrainWidth, height: terrainWidth, min, max };

}

// function createMartiniData(error, heights, width) {
//     const martini = new Martini(width);
//     const terrainTile = martini.createTile(heights);
//     const mesh = terrainTile.getMesh(error);
//     const { triangles, vertices } = mesh;
//     const positions = [], texcoords = [];
//     const skirtOffset = 0;//terrainStructure.skirtOffset;
//     for (let i = 0; i < vertices.length / 2; i++) {
//         const x = vertices[i * 2], y = vertices[i * 2 + 1];
//         positions.push(x * (1 + skirtOffset));
//         positions.push(-y * (1 + skirtOffset));
//         positions.push(heights[y * width + x]);
//         // if (i >= numVerticesWithoutSkirts) {
//         //     positions.push(0);
//         // } else {
//         //     positions.push(heights[y * width + x]);
//         // }
//         texcoords.push(x / width);
//         texcoords.push(y / width);
//     }
//     const terrain = {
//         positions: new Float32Array(positions), texcoords: new Float32Array(texcoords), triangles
//     };
//     return terrain;
// }

function createMartiniData(error, heights, width, hasSkirts) {
    const martini = new Martini(width);
    const terrainTile = martini.createTile(heights);
    //TODO 需要增加判断，只有pbr渲染时，才需要把isolateSkirtVertices设成true
    const isolateSkirtVertices = true;
    const mesh = hasSkirts ? terrainTile.getMeshWithSkirts(error, isolateSkirtVertices) : terrainTile.getMesh(error);
    const { triangles, vertices, leftSkirtIndex, rightSkirtIndex, bottomSkirtIndex, topSkirtIndex } = mesh;
    let { numVerticesWithoutSkirts, numTrianglesWithoutSkirts } = mesh;
    if (!numVerticesWithoutSkirts) {
        numVerticesWithoutSkirts = vertices.legnth / 3;
        numTrianglesWithoutSkirts = triangles.length / 3;
    }
    const positions = [], texcoords = [];
    const skirtOffset = 0;//terrainStructure.skirtOffset;
    const count = vertices.length / 2;
    // debugger
    for (let i = 0; i < count; i++) {
        const x = vertices[i * 2], y = vertices[i * 2 + 1];
        if (i >= numVerticesWithoutSkirts) {
            // positions.push(0);
            const index = x / 2 * 3;
            let height;
            // 侧面因为顶底uv[1]相等，导致和normal合并计算tangent时会出现NaN，导致侧面的normal结果错误
            // 给skirt顶面的uv的x和y都增加一点偏移量即能解决该问题
            let texOffset = 0.001;
            if (isolateSkirtVertices) {
                const start = i < leftSkirtIndex / 2 ? numVerticesWithoutSkirts :
                    i < rightSkirtIndex / 2 ? leftSkirtIndex / 2 :
                        i < bottomSkirtIndex / 2 ? rightSkirtIndex / 2 : bottomSkirtIndex / 2;
                if ((i - start) % 3 === 0) {
                    height = 0;
                    texOffset = 0;
                } else {
                    height = positions[index + 2];
                }
            } else {
                height = 0;
            }
            positions.push(positions[index], positions[index + 1], height);
            texcoords.push(positions[index] / width + texOffset);
            texcoords.push(-positions[index + 1] / width + texOffset);
        } else {
            positions.push(x * (1 + skirtOffset));
            positions.push(-y * (1 + skirtOffset));
            positions.push(heights[y * width + x]);
            texcoords.push(x / width);
            texcoords.push(y / width);
        }
    }
    const terrain = {
        positions: new Float32Array(positions), texcoords: new Float32Array(texcoords), triangles,
        leftSkirtIndex,
        rightSkirtIndex,
        bottomSkirtIndex,
        topSkirtIndex,
        numTrianglesWithoutSkirts, numVerticesWithoutSkirts
    };
    return terrain;
}

// 把heights转换为width为terrainWidth的高程数组数据
const cachedArray = {};
function convertHeightWidth(heights, terrainWidth) {
    const { data, width } = heights;
    const result = cachedArray[terrainWidth] = cachedArray[terrainWidth] || new Float32Array(terrainWidth * terrainWidth);
    let min = Infinity;
    let max = -Infinity;
    const stride = width > terrainWidth ? Math.round(width / terrainWidth) : Math.round(terrainWidth / width);

    const edge = terrainWidth - 1;

    for (let i = 0; i < terrainWidth; i++) {
        for (let j = 0; j < terrainWidth; j++) {
            const index = i + j * terrainWidth;
            let height = 0;
            let tx = i;
            let ty = j;
            if (tx >= edge) {
                tx = edge;
            }
            if (ty >= edge) {
                ty = edge;
            }
            if (width > terrainWidth) {
                for (let k = 0; k < stride; k++) {
                    for (let l = 0; l < stride; l++) {
                        const x = tx * stride + k;
                        const y = ty * stride + l;

                        const imageIndex = x + y * width;
                        height += data[imageIndex];
                    }
                }
                const count = stride * stride;
                height = height / (count || 1);
            } else {
                const x = Math.floor(tx / stride);
                const y = Math.floor(ty / stride);
                const imageIndex = x + y * width;
                height = data[imageIndex];
            }
            if (height > max) {
                max = height;
            }
            if (height < min) {
                min = height;
            }
            result[index] = height;
        }
    }
    return { data: result, width: terrainWidth, height: terrainWidth, min, max };
}

export const onmessage = function (message, postResponse) {
    const data = message.data;
    if (data.command === 'addLayer' || data.command === 'removeLayer') {
        // 保存当前worker的workerId。
        workerId = message.workerId;
        self.postMessage({type: '<response>', actorId: data.actorId, workerId, params: 'ok', callback: message.callback });
    } else if (data.command === 'createTerrainMesh') {
        const { error, terrainHeights, terrainWidth } = data.params;
        let terrainData = terrainHeights;
        if (terrainHeights.width !== terrainWidth) {
            terrainData = convertHeightWidth(terrainHeights, terrainWidth);
        }
        triangulateTerrain(error, terrainData, terrainWidth, false, null, null, false, true, (data, transferables) => {
            data.data = terrainHeights;
            transferables.push(terrainHeights.data.buffer);
            postResponse(data.error, data, transferables);
        });
    } else if (data.command === 'fetchTerrain') {
        //加载地形数据的逻辑
        loadTerrain(data.params, (data, transferables) => {
            postResponse(data.error, data, transferables);
        });
    } else if (data.command === 'abortTerrain') {
        //加载地形数据的逻辑
        abort(data.params.url, () => {
            postResponse(null, {}, []);
        });
    }
}

export const initialize = function () {
};
