import { mat4, quat, vec3 } from 'gl-matrix';
import { reshader } from '@maptalks/gl';
import partsModels from '../common/parts';
import * as gltf from '@maptalks/gltf-loader';
import { Util } from 'maptalks';
import { defined } from '../common/Util';
import pickingVert from './glsl/picking.vert';

const eyePosition = [0, 100000, 0];
const lookPosition = [0, 0, 0];
const helperPos = [
    -1, -1, 0,
    1, -1, 0,
    -1, 1, 0,
    1, 1, 0
]
const helperIndices = [
    3, 1, 0, 0, 2, 3
];
const internalScale = [0.1, 0.1, 0.1];
const QUAT = [], SCALE = [], TRANS = [], EMPTY_VEC = [], MAT = [];
const zDir = [0, -1, 0];
const phongUniforms = {
    'lightAmbient': [1.0, 1.0, 1.0],
    'lightDiffuse': [1.0, 1.0, 1.0],
    'lightSpecular': [1.0, 1.0, 1.0],
    'lightDirection': [1.0, 1.0, 1.0]
};
const pickingIdConnection = {
    4: [4, 5],
    5: [4, 5],
    7: [7, 8],
    8: [7, 8],
    9: [9, 10, 11],
    10: [9, 10, 11],
    11: [9, 10, 11]
}
const dischangeColors = [6];
export default class CutAnalysisController {
    constructor(map, renderer, position, rotation, scale) {
        this.map = map;
        this.renderer = renderer;
        this.updateTRS(position, rotation, scale);
        this.createPickHelper();
        this.createHelperMeshes();
        this._prepareRenderContext();
        this.registEvents();
        this.mouseAction = 'moving';
        this._mode = null;
        this._needRefreshPicking = true;
    }

    registEvents() {
        const map = this.map;
        map.on('dom:mousemove', this._mousemoveHandle, this);
        map.on('dom:mousedown', this._mousedownHandle, this);
        map.on('dom:mouseup', this._mouseupHandle, this);
        map.on('zooming moving dragrotating', this._viewchanging, this);
    }

    _mousemoveHandle(e) {
        this.currentMousePosition = {
            x: e.containerPoint.x,
            y: e.containerPoint.y
        };
        const meshes = this.getCntrollerMeshes();
        this.currentPickingObject = this._getPickingPoint(this.currentMousePosition, meshes, 'meshes');
        if (this.mouseAction === 'transform') {
            if (this._task === 'z-translate') {
                const zMesh = meshes[9]; // z方向上移动的mesh
                const zTrans = mat4.getTranslation(TRANS, zMesh.localTransform);
                this._transformPlaneHelper(true, zTrans, [(this._rotation[0]) * Math.PI / 180, (this._rotation[1]) * Math.PI / 180, this._rotation[2] * Math.PI / 180 ]);
            } else if (this._task === 'y-rotate') {
                const yMesh = meshes[4]; // 绕z轴旋转的mesh
                const yTrans = mat4.getTranslation(TRANS, yMesh.localTransform);
                this._transformPlaneHelper(true, yTrans, [0, 0, 0]);
            } else if (this._task === 'x-rotate') {
                const xMesh = meshes[7]; // 绕x轴旋转的mesh
                const xTrans = mat4.getTranslation(TRANS, xMesh.localTransform);
                this._transformPlaneHelper(true, xTrans, [(this._rotation[0]) * Math.PI / 180, (this._rotation[1]) * Math.PI / 180, this._rotation[2] * Math.PI / 180 ]);
            }
        } else {
            this._transformPlaneHelper(false);
        }
        this._meshAction();
        this._transformAction(this.currentMousePosition);
    }

    _meshAction() {
        this._resetStyle();
        if (this.currentPickingObject && this.currentPickingObject.meshId != null) {
            this.lastPickingMeshId = this.currentPickingObject.pickingId;
            this._updateStyle(this.currentPickingObject.pickingId, 0.6);
        }
        this._setToRedraw();
    }

    _transformAction(mousePosition) {
        if (this.mouseAction === 'transform') {
            const planeMesh = this._pickHelperMesh;
            const planeInteract = this._getPickingPoint(this.currentMousePosition, [planeMesh], 'plane');
            const lastPlaneInteract = this._getPickingPoint(this.lastMousePosition, [planeMesh], 'plane');
            if (!planeInteract || planeInteract.meshId === null || !lastPlaneInteract || lastPlaneInteract.meshId === null) {
                return;
            }
            const deltaTranslate = [0, 0, 0];
            if (this._task === 'z-translate') {
                deltaTranslate[0] = planeInteract.point[0] - lastPlaneInteract.point[0];
                deltaTranslate[1] = planeInteract.point[1] - lastPlaneInteract.point[1];
                deltaTranslate[2] = planeInteract.point[2] - lastPlaneInteract.point[2];
                const zDirection = this._getZDirction();
                const angle = vec3.angle(deltaTranslate, zDirection);
                const distance = vec3.length(deltaTranslate) * Math.cos(angle);
                const k = Math.sign(distance) * Math.sqrt(Math.pow(distance, 2) / (Math.pow(zDirection[0], 2) + Math.pow(zDirection[1], 2) + Math.pow(zDirection[2], 2)));//(distance / a的平方 + b的平方 + c的平方))a,b,c为垂直平面的方向向量
                const zTranslate = vec3.set(EMPTY_VEC, zDirection[0] * k, zDirection[1] * k, zDirection[2] * k);
                this._transformZ(zTranslate);
            }
        }
        this.lastMousePosition = mousePosition;
        this.lastPickingObject = this.currentPickingObject;
        this.lastPickingMeshId = this.currentPickingObject.meshId;
    }

    _transformZ(zTranslate) {
        vec3.add(this._position, this._position, zTranslate);
        const modelMatrix = this.updateMatrix();
        mat4.scale(modelMatrix, modelMatrix, internalScale);
        const meshes = this.getCntrollerMeshes();
        for (let i = 0; i < meshes.length; i++) {
            const zMesh = meshes[i];
            let matrix = modelMatrix;
            mat4.multiply(zMesh.localTransform, matrix, zMesh.nodeMatrix);
        }
    }

    _setToRedraw() {
        if (this.renderer) {
            this.renderer.parentRenderer.setToRedraw();
        }
    }

    _mousedownHandle(e) {
        this.currentMousePosition = {
            x: e.containerPoint.x,
            y: e.containerPoint.y
        };
        const meshes = this.getCntrollerMeshes();
        this.firstDownPoint = this.currentPickingObject = this._getPickingPoint(this.currentMousePosition, meshes, 'meshes');
        if (this.currentPickingObject && this.currentPickingObject.meshId != null) {
            this.mouseAction = 'transform';
            this._setTask(this.currentPickingObject.pickingId);
            this.map.config('zoomable', false);
            this.map.config('draggable', false);
            this._setToRedraw();
        } else {
            this.mouseAction = 'pan';
            this.map.config('zoomable', true);
            this.map.config('draggable', true);
        }
        this.lastMousePosition = this.currentMousePosition;
        this.lastPickingObject = this.currentPickingObject;
        this.lastPickingMesh = meshes[this.currentPickingObject.meshId];
    }

    _setTask(pickingId) {
        if (pickingIdConnection[9].indexOf(pickingId) > -1) { //9, 10, 11
            this._task = 'z-translate';
        } else if (pickingIdConnection[4].indexOf(pickingId) > -1) {
            this._task = 'y-rotate';
        } else if (pickingIdConnection[7].indexOf(pickingId) > -1) {
            this._task = 'x-rotate';
        }
    }

    _transformPlaneHelper(rotated, trans, rotation) {
        const planeMesh = this._pickHelperMesh;
        const translate = trans || planeMesh.originTranslation;
        const scaling = mat4.getScaling(SCALE, planeMesh.localTransform);
        let r = quat.fromEuler(QUAT, 0, 0, 0);
        mat4.fromRotationTranslationScale(planeMesh.localTransform, r, translate, scaling);
        if (rotated && !this._isInMapCenter()) {
            mat4.rotateZ(planeMesh.localTransform, planeMesh.localTransform, rotation[2]);
            mat4.rotateX(planeMesh.localTransform, planeMesh.localTransform, rotation[0]);
            mat4.rotateY(planeMesh.localTransform, planeMesh.localTransform, rotation[1]);

        }
    }

    _isInMapCenter() {
        if (this.map.getPitch()) {
            return false;
        }
        const cameraPos = this.map.cameraPosition;
        const centerPos = this.map.coordinateToPointAtRes(this.map.getCenter(), this.map.getGLRes());
        vec3.set(centerPos, centerPos.x, centerPos.y, 0);
        const coordinate = this._target.getCoordinates();
        const p = this.map.coordinateToPointAtRes(coordinate, this.map.getGLRes());
        const trans = this._target.getTranslation();
        const position = vec3.set(TRANS, p.x, p.y, 0);
        const worldPos = vec3.add(position, position, trans);
        const vTargetToCamera = vec3.subtract(EMPTY_VEC, cameraPos, worldPos);
        const vCenterToCamera = vec3.subtract(EMPTY_VEC, cameraPos, centerPos);
        const angle = vec3.angle(vTargetToCamera, vCenterToCamera);
        const theta = (1 / 180) * Math.PI;
        if (angle < theta) {
            return true;
        }
        return false;
    }

    _mouseupHandle() {
        if (this.mouseAction === 'transform') {
            this.firstDownPoint = null;
            this._needRefreshPicking = true;
        }
        this.mouseAction = 'moving';
        this._task = null;
        this.map.config('zoomable', true);
        this.map.config('draggable', true);
        this._setToRedraw();
    }

    _viewchanging() {
        this._needRefreshPicking = true;
    }

    _resetStyle() {
        if (defined(this.lastPickingMeshId)) {
            this._updateStyle(this.lastPickingMeshId)
        }
        this.map.resetCursor();
    }

    _updateStyle(pickingId, opacity) {
        const meshes = this.getCntrollerMeshes();
        if (dischangeColors.indexOf(pickingId) < 0) {
            const Ids = pickingIdConnection[pickingId];
            if (Ids) {
                for (let i = 0; i < Ids.length; i++) {
                    const mesh = meshes[Ids[i]];
                    this._updatePolygonFill(mesh, opacity);
                }
            } else {
                const mesh = meshes[pickingId];
                this._updatePolygonFill(mesh, opacity);
            }
        }
        this.map.setCursor('pointer');
    }

    _updatePolygonFill(mesh, opacity) {
        const polygonFill = mesh.material.get('polygonFill');
        polygonFill[3] = opacity || mesh.originOpacity;
        mesh.material.set('polygonFill', polygonFill);
    }

    _getPickingPoint(containerPoint, meshes, task) {
        const map = this.map;
        if (!map || !this._picking || !this.renderer || !this.renderer.canvas) {
            return null;
        }
        const dpr = map.getDevicePixelRatio();
        const x = containerPoint.x * dpr, y = containerPoint.y * dpr;
        const uniforms = { projViewMatrix: this.map.projViewMatrix, pointSize: 1.0 };
        if (this._needRefreshPicking || !this._pickTask || this._pickTask !== task) {
            this._picking.render(meshes, uniforms, true);
            this._pickTask = task;
            this._needRefreshPicking = false;
        }
        const picked = this._picking.pick(
            x,   // 屏幕坐标 x轴的值
            y,  // 屏幕坐标 y轴的值
            10,
            uniforms,
            {
                viewMatrix : this.map.viewMatrix,  //viewMatrix和projMatrix用于计算点的世界坐标值
                projMatrix : this.map.projMatrix,
                returnPoint : true
            }
        );
        return picked;
    }

    updateTRS(T, R, S) {
        this._position = vec3.copy([], T);
        this._scale = vec3.copy([], S);
        this._rotation = vec3.copy([], R);//angle
    }

    updateMatrix() {
        const rotation = this._rotation;
        const translation = this._position;
        const scale = this._scale;
        const r = quat.identity(QUAT);
        quat.rotateZ(r, r, rotation[2] * Math.PI / 180);
        quat.rotateX(r, r, rotation[0] * Math.PI / 180);
        quat.rotateY(r, r, rotation[1] * Math.PI / 180);
        const modelMatrix = mat4.fromRotationTranslationScale(MAT, r, translation, scale);
        return modelMatrix;
    }

    _getZDirction() {
        const rotation = this._rotation;
        const matrix = mat4.identity(MAT);
        mat4.rotateZ(matrix, matrix, rotation[2] * Math.PI / 180);
        mat4.rotateX(matrix, matrix, rotation[0] * Math.PI / 180);
        mat4.rotateY(matrix, matrix, rotation[1] * Math.PI / 180);
        const direction = vec3.transformMat4(EMPTY_VEC, zDir, matrix);
        return direction;
    }

    createPickHelper() {
        const pickGeometry = new reshader.Geometry({
            POSITION: helperPos
        },
        helperIndices,
        0,
        {
            primitive : 'triangles',
            positionAttribute: 'POSITION'
        });
        const uniforms = Util.extend({}, phongUniforms, {
            polygonFill: [0.0, 0.0, 0.0, 0.01]
        });
        this._pickHelperMesh = new reshader.Mesh(pickGeometry, new reshader.PhongMaterial(uniforms));
        this._pickHelperMesh.setUniform('uPickingId', 12);
        const modelMatrix = mat4.identity([]);
        const rotate = quat.fromEuler([], 0, 0, 0);
        this._pickHelperMesh.originRotation = [0, 0, 0];
        mat4.fromRotationTranslationScale(modelMatrix, rotate, this._position, [0.8, 0.8, 0.8]);
        this._pickHelperMesh.originTranslation = this._position;
        this._pickHelperMesh.localTransform = modelMatrix;
        this._pickHelperMesh.transparent = true;
        this._pickHelperMesh.setDefines({
            HAS_HELPERPARTS: 1,
            HAS_PICKING_ID: 2
        });
    }

    createHelperMeshes() {
        this._helperMeshes = this._prepareMesh('helper');
        this._allMeshes = [];
        this._allMeshes.push(...this._helperMeshes);
        this._allMeshes.push(this._pickHelperMesh);
    }

    getPickHelperMesh() {
        return this._pickHelperMesh;
    }

    getCntrollerMeshes() {
        return this._helperMeshes;
    }

    getAllMeshes() {
        if (this._allMeshes.length < 12) {
            this._allMeshes.push(...this._helperMeshes);
        }
        return this._allMeshes;
    }

    createProjViewMatrix() {
        const modelMatrix = this.updateMatrix();
        const lookPoint = vec3.transformMat4([], lookPosition, modelMatrix);
        const eyePos = vec3.transformMat4([], eyePosition, modelMatrix);
        const distance = Math.sqrt(Math.pow(eyePos[0] - lookPoint[0], 2) + Math.pow(eyePos[1] - lookPoint[1], 2) + Math.pow(eyePos[2] - lookPoint[2], 2));
        const projMatrix = mat4.ortho([], -this._scale[0], this._scale[1], -this._scale[0], this._scale[1], 1.0, distance);
        const viewMatrix = mat4.lookAt([], eyePos, lookPoint, [0, 0, 1]);
        const projViewMatrix = mat4.multiply([], projMatrix, viewMatrix);
        return  projViewMatrix;
    }

    _prepareMesh(modelName) {
        const meshes = [];
        const promise = createGLTFMesh(modelName);
        const modelMatrix = this.updateMatrix();
        mat4.scale(modelMatrix, modelMatrix, internalScale);
        promise.then(data => {
            const gltfPack = reshader.GLTFHelper.exportGLTFPack(data);
            const geometries = gltfPack.getMeshesInfo();
            geometries.forEach((g, index) => {
                const materialInfo = g.materialInfo || {};
                if (index === 6) {
                    materialInfo.polygonFill = [1.0, 1.0, 1.0, 0.1];
                } else {
                    materialInfo.polygonFill = [1.0, 1.0, 1.0, 1.0];
                }
                Util.extend(materialInfo, phongUniforms, materialInfo);
                const material = new reshader.PhongMaterial(materialInfo);
                const mesh = new reshader.Mesh(g.geometry, material);
                mesh.setUniform('uPickingId', index);
                const defines = mesh.getDefines();
                defines.HAS_HELPERPARTS = 1;
                defines.HAS_PICKING_ID = 2;
                mesh.setDefines(defines);
                mat4.multiply(mesh.localTransform, modelMatrix, g.nodeMatrix);
                mesh.nodeMatrix = g.nodeMatrix;
                mesh.originTransform = mat4.copy([], mesh.localTransform);
                if (index === 6) {
                    mesh.originOpacity = 0.1;
                } else {
                    mesh.originOpacity = 1.0;
                }
                mesh.transparent = true;
                meshes.push(mesh);
            });
        });
        return meshes;
    }

    _prepareRenderContext() {
        this.pickingFBO = this.renderer.regl.framebuffer(this.renderer.canvas.width, this.renderer.canvas.height);
        this._picking = new reshader.FBORayPicking(
            this.renderer,
            {
                vert : pickingVert,
                uniforms : [
                    {
                        name : 'projViewModelMatrix',
                        type : 'function',
                        fn : function (context, props) {
                            return mat4.multiply([], props['projViewMatrix'], props['modelMatrix']);
                        }
                    }
                ]
            },
            this.pickingFBO
        );
    }

    dispose() {
        this.pickingFBO.dispose();
    }
}

function createGLTFMesh(modelName) {
    const loader = new gltf.GLTFLoader('', partsModels[modelName]);
    return loader.load().then(gltf => {
        return gltf;
    });
}