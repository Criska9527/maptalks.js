/**
 * Create and copy from data to typed arrays as definitions
 * @param {Object} format type array definitions
 * @param {Number[]} data data copied from
 * @returns {Object} typed arrays
 */
export function fillTypedArray(format, data) {
    const arrays = {};
    for (let i = 0; i < format.length; i++) {
        const d = format[i];
        const type = d.type;
        const name = d.name;
        if (type === Array) {
            arrays[name] = data[name];
        } else {
            arrays[name] = createTypedArray(data[name], type);
            // arrays[name] = new type(data[name].getArray());
        }
    }
    return arrays;
}

export function getFormatWidth(format) {
    let width = 0;
    for (const p in format) {
        width += format[p].width;
    }
    return width;
}

export function getIndexArrayType(max) {
    // if (max < 256) return Uint8Array;
    // according to http://www.webglinsights.com/, Uint8Array performs badly in directx according to ANGLE
    if (max < 65536) return Uint16Array;
    return Uint32Array;
}

export function getPosArrayType(max) {
    max = Math.abs(max);
    if (max < 128) return Int8Array;
    if (max < 65536 / 2) return Int16Array;
    // https://stackoverflow.com/questions/3793838/which-is-the-first-integer-that-an-ieee-754-float-is-incapable-of-representing-e
    if (max < Math.pow(2, 24)) return Float32Array;
    //TODO 这里不能用Int32Array，可能是regl的bug
    return Float32Array;
}

export function getUnsignedArrayType(max) {
    if (max < 256) return Uint8Array;
    if (max < 65536) return Uint16Array;
    if (max < Math.pow(2, 32)) return Uint32Array;
    return Float64Array;
}

export function createTypedArray(values, ctor) {
    const arr = new ctor(values.length);
    const len = arr.length;
    for (let i = 0; i < len; i++) {
        arr[i] = values[i];
    }
    return arr;
}
