/**
 * remove current program in to gl.actuator.currentProgram
 * @modify 2018/5/2
 * @author yellow
 */
import { include, createDefaultStates } from './Utils';
import GLConstants from './GLConstants';
import MockExtensions from './extensions/Mocks';

let uid = 1;

/**
 * @class
 */
class GLContext {
    /**
     *
     * @param {WebGLRenderingContext} gl
     * @param {Object} [options]
     */
    constructor(gl) {
        this.uid = uid++;
        /**
         * @type {String}
         */
        this.states = createDefaultStates(gl);
        /**
         * @type {WebGLRenderingContext}
         */
        this._gl = gl;

        this._gl['_fusiongl_drawCalls'] = 0;

        this._is2 = (typeof WebGL2RenderingContext) && (this._gl instanceof WebGL2RenderingContext);
    }

    /**
     * Get canvas of the context
     * https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/canvas
     * @returns {HTMLCanvasElement}
     */
    get canvas() {
        return this._gl.canvas;
    }

    /**
     * drawingBufferWidth
     * https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/drawingBufferWidth
     * @returns {Number}
     */
    get drawingBufferWidth() {
        return this._gl.drawingBufferWidth;
    }

    /**
     * drawingBufferHeight
     * https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/drawingBufferHeight
     * @returns {Number}
     */
    get drawingBufferHeight() {
        return this._gl.drawingBufferHeight;
    }

    /**
     * get webglrendercontext
     * @returns {WebGLRenderingContext}
     */
    get gl() {
        return this._gl;
    }


    get buffersOES() {
        if (!this._buffersOES) {
            this._buffersOES = this._gl.getExtension('WEBGL_draw_buffers');
        }
        return this._buffersOES;
    }

    get vaoOES() {
        if (!this._vaoOES) {
            this._vaoOES = this._gl.getExtension('OES_vertex_array_object');
        }
        return this._vaoOES;
    }

    get angleOES() {
        if (!this._angleOES) {
            this._angleOES = this._gl.getExtension('ANGLE_instanced_arrays');
        }
        return this._angleOES;
    }

    /**
     * https://developer.mozilla.org/zh-CN/docs/Web/API/WebGLRenderingContext/attachShader
     * @param {GLProgram} program
     * @param {GLShader} shader
     */
    attachShader(program, shader) {
        return this._gl.attachShader(program, shader);
    }

    /**
     * https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/shaderSource
     * @param {GLShader} shader
     * @param {String} source
     */
    shaderSource(shader, source) {
        return this._gl.shaderSource(shader, source);
    }

    /**
     * https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/compileShader
     * @param {GLShader} shader
     */
    compileShader(shader) {
        return this._gl.compileShader(shader);
    }
    /**
     * https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/createShader
     * @param {String} type Either gl.VERTEX_SHADER or gl.FRAGMENT_SHADER
     */
    createShader(type) {
        return this._gl.createShader(type);
    }
    /**
     * https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/createProgram
     * @returns {GLProgram}
     */
    createProgram() {
        return this._gl.createProgram();
    }

    /**
     * https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/deleteProgram
     * @param {*} program
     */
    deleteProgram(program) {
        if (this.states.program === program) {
            this.states.program = null;
        }
        return this._gl.deleteProgram(program);
    }

    /**
     * https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/deleteShader
     * @param {*} shader
     */
    deleteShader(shader) {
        return this._gl.deleteShader(shader);
    }

    /**
     * https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/detachShader
     */
    detachShader(program, shader) {
        return this._gl.detachShader(program, shader);
    }

    /**
     * https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/getAttachedShaders
     * @param {*} program
     */
    getAttachedShaders(program) {
        return this._gl.getAttachedShaders(program);
    }

    /**
     * https://developer.mozilla.org/zh-CN/docs/Web/API/WebGLRenderingContext/linkProgram
     * @param {GLProgram} program
     */
    linkProgram(program) {
        return this._gl.linkProgram(program);
    }


    /**
     * https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/getShaderParameter
     * @param {GLShader} shader
     * @param {GLenum} name
     */
    getShaderParameter(shader, name) {
        return this._gl.getShaderParameter(shader, name);
    }

    /**
     * https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/getShaderPrecisionFormat
     * @param {GLenum} shaderType
     * @param {GLenum} precisionType
     */
    getShaderPrecisionFormat(shaderType, precisionType) {
        return this._gl.getShaderPrecisionFormat(shaderType, precisionType);
    }

    /**
     * https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/getShaderInfoLog
     * @param {GLShader} shader
     */
    getShaderInfoLog(shader) {
        return this._gl.getShaderInfoLog(shader);
    }

    /**
     * https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/getShaderSource
     */
    getShaderSource(shader) {
        return this._gl.getShaderSource(shader);
    }

    /**
     * https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/getProgramInfoLog
     * @param {GLProgram} program
     */
    getProgramInfoLog(program) {
        return this._gl.getProgramInfoLog(program);
    }

    /**
     * https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/getProgramParameter
     * @type {GLProgram} program
     * @type {GLenum} pname
     */
    getProgramParameter(program, pname) {
        return this._gl.getProgramParameter(program, pname);
    }
    /**
     * https://developer.mozilla.org/zh-CN/docs/Web/API/WebGLRenderingContext/getError
     */
    getError() {
        return this._gl.getError();
    }
    /**
     * https://developer.mozilla.org/zh-CN/docs/Web/API/WebGLRenderingContext/getContextAttributes
     */
    getContextAttributes() {
        return this._gl.getContextAttributes();
    }
    /**
     * https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/getExtension
     * @param {String} name
     */
    getExtension(name) {
        if (MockExtensions.has(this, name)) {
            return MockExtensions.mock(this, name);
        }
        return this._gl.getExtension(name);
    }

    getSupportedExtensions() {
        return this._gl.getSupportedExtensions();
    }

    /**
     * https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/getParameter
     * @param {String} pname
     */
    getParameter(pname) {
        return this._gl.getParameter(pname);
    }

    isEnabled(cap) {
        return this._gl.isEnabled(cap);
    }

    isProgram(program) {
        return this._gl.isProgram(program);
    }

    isShader(shader) {
        return this._gl.isShader(shader);
    }

    validateProgram(program) {
        return this._gl.validateProgram(program);
    }

    /**
     * https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/clear
     */
    clear(mask) {
        this._checkAndRestore();
        return this._gl.clear(mask);
    }

    /**
     * https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/drawArrays
     */
    drawArrays(mode, first, count) {
        this._checkAndRestore();
        this._addDrawCall();
        return this._gl.drawArrays(mode, first, count);
    }
    /**
     * https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/drawElements
     */
    drawElements(mode, count, type, offset) {
        this._checkAndRestore();
        // this._saveDataStatus();
        this._addDrawCall();
        return this._gl.drawElements(mode, count, type, offset);
    }

    drawBuffers(buffers) {
        this._checkAndRestore();
        // this._saveDataStatus();
        this._addDrawCall();
        if (this._is2) {
            return this._gl.drawBuffers(buffers);
        }
        return this.buffersOES.drawBuffersWEBGL(buffers);
    }

    _addDrawCall() {
        this._gl['_fusiongl_drawCalls']++;
    }

    resetDrawCalls() {
        this._gl['_fusiongl_drawCalls'] = 0;
    }

    getDrawCalls() {
        return this._gl['_fusiongl_drawCalls'];
    }

    _saveDataStatus() {
        const gl = this._gl;
        const program = gl.getParameter(gl.CURRENT_PROGRAM);
        const max = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
        const buffers = [];
        for (let i = 0; i < max; i++) {
            buffers.push(gl.getVertexAttrib(i, gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING));
        }
        this._dataStatus = {
            buffers,
            elements : gl.getParameter(gl.ELEMENT_ARRAY_BUFFER_BINDING),
            framebuffer: gl.getParameter(gl.FRAMEBUFFER_BINDING)
        };
        if (window.DEBUGGING) {
            console.log(this.uid, this._dataStatus);
            console.log(this.uid, this.states.attributes);
            console.log(this.states.attributes[0].buffer === this._dataStatus.buffers[0]);
            console.log(this.states.attributes[1].buffer === this._dataStatus.buffers[1]);
            console.log(this.states.attributes[2].buffer === this._dataStatus.buffers[2]);
            // console.trace();
        }
    }

    finish() {
        // avoid as recommended by WebGL best practices
        // https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices
        return this._gl.finish();
    }

    flush() {
        this._checkAndRestore();
        return this._gl.flush();
    }

    commit() {
        this._checkAndRestore();
        return this._gl.commit();
    }

    /**
     * https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/isContextLost
     */
    isContextLost() {
        return this._gl.isContextLost();
    }
}

include(GLContext.prototype, GLConstants);

export default GLContext;
