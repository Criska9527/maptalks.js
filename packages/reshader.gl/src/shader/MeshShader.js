import Shader from './Shader.js';
import InstancedMesh from '../InstancedMesh.js';

class MeshShader extends Shader {

    draw(regl, meshes) {
        if (!meshes || !meshes.length) {
            return this;
        }
        const props = [];
        let preCommand;
        for (let i = 0, l = meshes.length; i < l; i++) {
            if (!meshes[i].isValid()) {
                if (i === l - 1 && preCommand && props.length) {
                    preCommand(props);
                }
                continue;
            }
            if (!meshes[i].geometry.getDrawCount() || !this._runFilter(meshes[i])) {
                //此处regl有个潜在的bug:
                //如果count为0的geometry不过滤掉，regl生成的函数中，bind的texture不会执行unbind
                if (i === l - 1 && preCommand && props.length) {
                    preCommand(props);
                }
                continue;
            }
            const command = this.getMeshCommand(regl, meshes[i]);

            //run command one by one, for debug
            // const props = extend({}, this.context, meshes[i].getREGLProps());
            // console.log(i);
            // command(props);

            if (props.length && preCommand !== command) {
                //batch mode
                preCommand(props);
                props.length = 0;
            }
            const meshProps = meshes[i].getREGLProps(regl, command.activeAttributes);
            this.appendRenderUniforms(meshProps);
            props.push(meshProps);
            if (i < l - 1) {
                preCommand = command;
            } else if (i === l - 1) {
                command(props);
            }
        }
        return this;
    }

    // filter() {
    //     return true;
    // }

    _runFilter(m) {
        const filters = this.filter;
        if (!filters) {
            return true;
        }
        if (Array.isArray(filters)) {
            for (let i = 0; i < filters.length; i++) {
                if (!filters[i](m)) {
                    return false;
                }
            }
            return true;
        }
        return filters(m);
    }

    getMeshCommand(regl, mesh) {
        const key = this._dkey || '';
        const dKey = key + '_' + mesh.getCommandKey(regl);
        let command = this.commands[dKey];
        if (!command) {
            const defines = mesh.getDefines();
            const material = mesh.getMaterial();
            if (material) {
                const doubleSided = material.doubleSided;
                if (doubleSided && this.extraCommandProps && this.extraCommandProps.cull) {
                    this.extraCommandProps.cull.enable = false;
                }
            }
            command = this.commands[dKey] =
                this.createREGLCommand(
                    regl,
                    defines,
                    mesh.getElements(),
                    mesh instanceof InstancedMesh
                );
        }
        return command;
    }
}

export default MeshShader;
