const cubePosition = [1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1,
    1, 1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1,
    1, 1, 1, 1, 1, -1, -1, 1, -1, -1, 1, 1,
    -1, 1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1,
    -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1,
    1, -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, -1];
const cubeNormal =  [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
    1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
    0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
    -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
    0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
    0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1];
const cubeIndices = [0, 1, 2, 0, 2, 3,
    4, 5, 6, 4, 6, 7,
    8, 9, 10, 8, 10, 11,
    12, 13, 14, 12, 14, 15,
    16, 17, 18, 16, 18, 19,
    20, 21, 22, 20, 22, 23];

const plane = {
    // Create a plane
    //    v2----- v3
    //   /       /
    //  v1------v0
    // Coordinates
    vertices : [
        -1, 0, -1,
        1, 0, -1,
        -1, 0, 1,
        1, 0, 1,
    ],

    // Normal
    normals : [
        0, 1, 0,
        0, 1, 0,
        0, 1, 0,
        0, 1, 0,
    ],
    // Indices of the vertices
    indices : [
        3, 1, 0, 0, 2, 3
    ],

    uv : [
        0.0, 0.0,
        1.0, 0.0,
        0.0, 1.0,
        1.0, 1.0
    ]
};

const pyramid = {
    vertices: [-0.8111000061035156, 2.0102999210357666, -0.8111000061035156, 0, 0.010300000198185444, -0, -0.8111000061035156, 2.0102999210357666, 0.8111000061035156, -0.8111000061035156, 2.0102999210357666, 0.8111000061035156, 0, 0.010300000198185444, -0, 0.8111000061035156, 2.0102999210357666, 0.8111000061035156, 0.8111000061035156, 2.0102999210357666, 0.8111000061035156, 0, 0.010300000198185444, -0, 0.8111000061035156, 2.0102999210357666, -0.8111000061035156, 0.8111000061035156, 2.0102999210357666, -0.8111000061035156, 0, 0.010300000198185444, -0, -0.8111000061035156, 2.0102999210357666, -0.8111000061035156, 0.8111000061035156, 2.0102999210357666, -0.8111000061035156, -0.8111000061035156, 2.0102999210357666, -0.8111000061035156, 0, 2.9419000148773193, -0, 0.8111000061035156, 2.0102999210357666, 0.8111000061035156, 0.8111000061035156, 2.0102999210357666, -0.8111000061035156, 0, 2.9419000148773193, -0, -0.8111000061035156, 2.0102999210357666, -0.8111000061035156, -0.8111000061035156, 2.0102999210357666, 0.8111000061035156, 0, 2.9419000148773193, -0, -0.8111000061035156, 2.0102999210357666, 0.8111000061035156, 0.8111000061035156, 2.0102999210357666, 0.8111000061035156, 0, 2.9419000148773193, -0],

    normals: [-0.9267006516456604, -0.3758002817630768, -0, -0.9267006516456604, -0.3758002817630768, -0, -0.9267006516456604, -0.3758002817630768, -0, 0, -0.3758002817630768, 0.9267006516456604, 0, -0.3758002817630768, 0.9267006516456604, 0, -0.3758002817630768, 0.9267006516456604, 0.9267006516456604, -0.3758002817630768, -0, 0.9267006516456604, -0.3758002817630768, -0, 0.9267006516456604, -0.3758002817630768, -0, 0, -0.3758002817630768, -0.9267006516456604, 0, -0.3758002817630768, -0.9267006516456604, 0, -0.3758002817630768, -0.9267006516456604, 0, 0.656676173210144, -0.7541726231575012, 0, 0.656676173210144, -0.7541726231575012, 0, 0.656676173210144, -0.7541726231575012, 0.7541726231575012, 0.656676173210144, -0, 0.7541726231575012, 0.656676173210144, -0, 0.7541726231575012, 0.656676173210144, -0, -0.7541726231575012, 0.656676173210144, -0, -0.7541726231575012, 0.656676173210144, -0, -0.7541726231575012, 0.656676173210144, -0, 0, 0.656676173210144, 0.7541726231575012, 0, 0.656676173210144, 0.7541726231575012, 0, 0.656676173210144, 0.7541726231575012],

    indices: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]
};

export const simpleModels = {
    'cube': {
        meshes : [{
            primitives : [{
                attributes : {
                    POSITION : {
                        array : new Int8Array(cubePosition)
                    },
                    NORMAL :{
                        array : new Int8Array(cubeNormal)
                    }
                },
                indices : new Uint16Array(cubeIndices),
                mode : 4
            }]
        }],
        scenes : [
            {
                nodes : [
                    {
                        mesh : 0
                    }
                ]
            }
        ]
    },
    'plane': {
        meshes : [{
            primitives : [{
                attributes : {
                    POSITION : {
                        array : new Int8Array(plane.vertices)
                    },
                    NORMAL :{
                        array : new Int8Array(plane.normals)
                    },
                    TEXCOORD_0: {
                        array : new Int8Array(plane.uv)
                    }
                },
                indices : new Uint16Array(plane.indices),
                mode : 4
            }]
        }],
        scenes : [
            {
                nodes : [
                    {
                        mesh : 0
                    }
                ]
            }
        ]
    },
    'pyramid': {
        meshes : [{
            primitives : [{
                attributes : {
                    POSITION : {
                        array : new Float32Array(pyramid.vertices)
                    },
                    NORMAL :{
                        array : new Float32Array(pyramid.normals)
                    },
                    TEXCOORD_0: {
                        array : new Float32Array(pyramid.uv)
                    }
                },
                indices : new Uint16Array(pyramid.indices),
                mode : 4
            }]
        }],
        scenes : [
            {
                nodes : [
                    {
                        mesh : 0
                    }
                ]
            }
        ]
    }
};

//简单模型由于会重复使用，为了避免模型结构会影响，需要进行拷贝使用
export function getSimpleModel(url) {
    let simpleModel = null;
    if (simpleModels[url]) {
        simpleModel = {
            meshes: simpleModels[url].meshes
        };
        simpleModel.scenes = JSON.parse(JSON.stringify(simpleModels[url].scenes));
    }
    return simpleModel;
}
