describe('maptalks.gltf', function () {
    let map;
    beforeEach(function() {
        map = createMap();
    });

    afterEach(function() {
        removeMap(map);
    });

    it('gltflayer\'s renderer has not prepared when adding marker to it', (done) => {
        const gltflayer = new maptalks.GLTFLayer('gltf');
        const marker = new maptalks.GLTFMarker(center, { symbol: { url: url2 }});
        gltflayer.addGeometry(marker);
        marker.on('click', e => {
            const meshId = e.meshId;
            const target = e.target;
            expect(meshId).to.be.eql(0);
            expect(target instanceof maptalks.GLTFMarker).to.be.ok();
            
            done();
        });
        gltflayer.addTo(map);
        marker.on('load', () => {
            setTimeout(function () {
                map.fire('dom:click', {
                    coordinate: clickPoint,
                    containerPoint: clickContainerPoint
                });
            }, 100);
        });
    });

    it('gltflayer should display when added to map', function () {
        const layer = new maptalks.GLTFLayer('gltf').addTo(map);
        layer.remove();
    });

    it('gltflayer can be removed from map', function () {
        const layer = new maptalks.GLTFLayer('gltf', {
            symbol: {
                url: url3
            }
        }).addTo(map);
        layer.remove();
    });

    it('add marker', function () {
        const gltflayer = new maptalks.GLTFLayer('gltf1').addTo(map);
        new maptalks.GLTFMarker([center.x, center.y, 0], { symbol:  { url: url1 }}).addTo(gltflayer);
        
    });

    it('gltfmarker\'s symbol with polygonFill、polygonOpacity、lineColor、lineOpacity', () => {
        const gltflayer = new maptalks.GLTFLayer('gltf').addTo(map);
        new maptalks.GLTFMarker([center.x, center.y, 0], { symbol:  {
            'polygonFill': [0.5, 0.5, 0.5, 1.0],
            'polygonOpacity': 0.8,
            'lineColor': [0.1, 0.2, 1.0, 1.0],
            'lineOpacity': 0.8
        }}).addTo(gltflayer);
        new maptalks.GLTFMarker([center.x, center.y, 0], { symbol:  {
            'shader': 'pbr',
            'polygonFill': [0.5, 0.5, 0.5, 1.0],
            'polygonOpacity': 0.8,
            'lineColor': [0.1, 0.2, 1.0, 1.0],
            'lineOpacity': 0.8
        }}).addTo(gltflayer);
        
    });

    it('gltfmarker has default trs', () => {
        const gltflayer = new maptalks.GLTFLayer('gltf').addTo(map);
        const marker1 = new maptalks.GLTFMarker([center.x, center.y]).addTo(gltflayer);
        const marker2 = new maptalks.GLTFMarker([center.x + 0.01, center.y], {
            symbol: {
                scaleX: 2,
                scaleY: 2,
                scaleZ: 2,
                translationX: 1,
                translationY: 0,
                translationZ: 0
            }
        }).addTo(gltflayer);
        const marker3 = new maptalks.GLTFMarker([center.x, center.y + 0.01], {
            symbol: {
                shader: 'wireframe'
            }
        }).addTo(gltflayer);
        const translation1 = marker1.getTranslation();
        const rotation1 = marker1.getRotation();
        const scale1 = marker1.getScale();
        expect(translation1).to.be.eql([0, 0, 0]);
        expect(rotation1).to.be.eql([0, 0, 0]);
        expect(scale1).to.be.eql([1, 1, 1]);

        const translation2 = marker2.getTranslation();
        const rotation2 = marker2.getRotation();
        const scale2 = marker2.getScale();
        expect(translation2).to.be.eql([1, 0, 0]);
        expect(rotation2).to.be.eql([0, 0, 0]);
        expect(scale2).to.be.eql([2, 2, 2]);

        const symbol = marker3.getSymbol();
        const translation3 = marker3.getTranslation();
        const rotation3 = marker3.getRotation();
        const scale3 = marker3.getScale();
        expect(symbol.shader).to.be.eql('wireframe');
        expect(translation3).to.be.eql([0, 0, 0]);
        expect(rotation3).to.be.eql([0, 0, 0]);
        expect(scale3).to.be.eql([1, 1, 1]);

        
    });

    it('remove marker', function () {
        const gltflayer = new maptalks.GLTFLayer('gltf2').addTo(map);
        const marker = new maptalks.GLTFMarker([center.x, center.y, 0], { symbol: { url: url1 }});
        gltflayer.addGeometry(marker);
        let count = gltflayer.getCount();
        expect(count).to.be.eql(1);
        gltflayer.removeGeometry(marker);
        count = gltflayer.getCount();
        expect(count).to.be.eql(0);
        
    });

    it('clear markers', function () {
        const gltflayer = new maptalks.GLTFLayer('gltf3').addTo(map);
        const markers = [];
        for (let i = 0; i < 4; i++) {
            markers.push(new maptalks.GLTFMarker([center.x + i * 0.01, center.y - i * 0.01, 0], { symbol: { url: url1 }}));
        }
        gltflayer.addGeometry(markers);
        let count = gltflayer.getCount();
        expect(count).to.be.eql(4);
        // setTimeout(function () {
        gltflayer.clear();
        count = gltflayer.getCount();
        expect(count).to.be.eql(0);
        
        // }, 100);
    });

    it('set coordinate for gltfmarker, modelMatrix will change', function (done) {
        const gltflayer = new maptalks.GLTFLayer('gltf4').addTo(map);
        const marker = new maptalks.GLTFMarker([center.x, center.y, 0], { symbol: { url: url1 }});
        marker.on('load', () => {
            marker.setCoordinates([center.x + 0.1, center.y, 10]);
            const expectMatrix = maptalksgl.mat4.fromValues(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
            const modelMatrix = marker.getModelMatrix();
            expect(maptalksgl.mat4.equals(expectMatrix, modelMatrix)).not.to.be.ok();
            
            done();
        });
        gltflayer.addGeometry(marker);
    });

    it('change translation, rotation, and scale', function () {
        const gltflayer = new maptalks.GLTFLayer('gltf5').addTo(map);
        const marker = new maptalks.GLTFMarker(center, { symbol: { url: url1 }});
        gltflayer.addGeometry(marker);
        // setTimeout(function () {
        marker.setTranslation(10, 10, 10);
        marker.setRotation(0, 60, 0);
        marker.setScale(2, 2, 2);
        const expectMatrix = maptalksgl.mat4.fromValues(1.0000000000000002, 0, -1.7320508075688772, 0, 0, 2, 0, 0, 1.7320508075688772, 0, 1.0000000000000002, 0, 0.13082664542728, 0.1308266454209729, 0.1707822812928094, 1);
        const modelMatrix = marker.getModelMatrix();
        expect(maptalksgl.mat4.equals(expectMatrix, modelMatrix)).to.be.ok();
        
        // }, 100);
    });

    it('isDirty', () => {
        const gltflayer = new maptalks.GLTFLayer('gltf6').addTo(map);
        const marker = new maptalks.GLTFMarker(center, { symbol: { url: url1 }});
        gltflayer.addGeometry(marker);
        expect(marker.isDirty()).to.be.ok();
        marker.setTranslation(10, 10, 10);
        expect(marker.isDirty()).to.be.ok();
        
    });

    it('setUniform', () => {
        const marker = new maptalks.GLTFMarker(center, { symbol: { url: url1 }});
        expect(marker.setUniform('key', '1')).to.be.ok();
        const value = marker.getUniform('key');
        expect(value).to.be.eql('1');
    });

    it('copy', function (done) {
        const marker = new maptalks.GLTFMarker(center, { symbol: { url: url1 }}, {
            shader: 'light',
            translationX: 10,
            scaleX: 2,
            scaleY: 2,
            scaleZ: 2,
            rotationX: 1,
            rotationY: 0,
            rotationZ: 0,
            properties: {
                name:'jack'
            }
        });
        const copyOne = marker.copy();
        expect(JSON.stringify(marker.getCoordinates()) === JSON.stringify(copyOne.getCoordinates())).to.be.ok();
        expect(JSON.stringify(marker.getShader()) === JSON.stringify(copyOne.getShader())).to.be.ok();
        expect(JSON.stringify(marker.getUniforms()) === JSON.stringify(copyOne.getUniforms())).to.be.ok();
        expect(JSON.stringify(marker.getTranslation()) === JSON.stringify(copyOne.getTranslation())).to.be.ok();
        expect(JSON.stringify(marker.getRotation()) === JSON.stringify(copyOne.getRotation())).to.be.ok();
        expect(JSON.stringify(marker.getScale()) === JSON.stringify(copyOne.getScale())).to.be.ok();
        expect(JSON.stringify(marker.getProperties()) === JSON.stringify(copyOne.getProperties())).to.be.ok();
        done();
    });

    it('setCoordinates', function (done) {
        const marker = new maptalks.GLTFMarker(center, { symbol: { url: url1 }});
        const copyOne = marker.copy();
        let coordCopy = copyOne.getCoordinates();
        expect(coordCopy).to.be.eql(center);
        copyOne.setCoordinates([center.x + 0.001, center.y]);
        coordCopy = copyOne.getCoordinates();
        expect(coordCopy).to.be.eql(new maptalks.Coordinate(center.x + 0.001, center.y));
        done();
    });

    it('show and hide GLTFMarker', function (done) {
        const gltflayer = new maptalks.GLTFLayer('gltf8').addTo(map);
        const marker = new maptalks.GLTFMarker(center, { symbol: { url: url1 }}).addTo(gltflayer);
        marker.on('load', () => {
            expect(marker.isVisible()).to.be.ok();
            marker.hide();
            expect(marker.isVisible()).not.to.be.ok();
            
            done();
        });
    });

    it('isAnimated', done => {
        const gltflayer = new maptalks.GLTFLayer('gltf8').addTo(map);
        const marker = new maptalks.GLTFMarker(center, {
            symbol:{
                url: url1,
                animation: true
            }
        }).addTo(gltflayer);
        expect(marker.isAnimated()).not.to.be.ok();
        marker.on('load', () => {
            expect(marker.isAnimated()).to.be.ok();
            
            done();
        });
    });

    it('the markers with same url which has animations should not affect each other', done => {
        const gltflayer = new maptalks.GLTFLayer('gltf8').addTo(map);
        const marker1 = new maptalks.GLTFMarker(center, {
            symbol:{
                url: url1,
                animation: false
            }
        }).addTo(gltflayer);
        const marker2 = new maptalks.GLTFMarker(center, {
            symbol:{
                url: url1,
                animation: true,
                loop: true
            }
        }).addTo(gltflayer);
        gltflayer.on('modelload', () => {
            setTimeout(function() {
                const mesh1 = marker1.getMeshes(null, null, 100)[0];
                const mesh2 = marker2.getMeshes(null, null, 100)[0];
                const localTransform1 = mesh1.localTransform;
                const localTransform2 = mesh2.localTransform;
                expect(maptalksgl.mat4.equals(localTransform1, localTransform2)).not.to.be.ok();            
                done();
            }, 200);
        });
    });

    it('more than one animations', done => {
        const gltflayer = new maptalks.GLTFLayer('layer');
        new maptalks.GroupGLLayer('group', [gltflayer],  { sceneConfig }).addTo(map);
        const marker = new maptalks.GLTFMarker(center, {
            symbol:{
                url: url11,
                animation: true
            }
        }).addTo(gltflayer);
        marker.on('load', () => {
            const animations = marker.getAnimations();
            expect(animations).to.be.eql(['Survey', 'Walk', 'Run']);
            marker.setCurrentAnimation('Walk');
            const currentAnimation = marker.getCurrentAnimation();
            expect(currentAnimation).to.be.eql('Walk');
            done();
        })
    })

    it('registerShader', function (done) {
        maptalks.GLTFLayer.registerShader('a', 'MeshShader', shader);
        maptalks.GLTFLayer.registerShader('b', 'MeshShader', shader);
        maptalks.GLTFLayer.registerShader('c', 'MeshShader', shader);
        const gltflayer = new maptalks.GLTFLayer('gltf9').addTo(map);
        new maptalks.GLTFMarker(center, { symbol: { url: url1 }}, {
            animation:false
        }).addTo(gltflayer);
        gltflayer.on('rendercomplete-debug', function (e) {
            expect(e.count > 5).to.be.ok();
            maptalks.GLTFLayer.removeShader('a');
            maptalks.GLTFLayer.removeShader('b');
            maptalks.GLTFLayer.removeShader('c');
            
            done();
        });
    });

    it('getShaders', done => {
        maptalks.GLTFLayer.registerShader('a', 'MeshShader', shader);
        maptalks.GLTFLayer.registerShader('b', 'MeshShader', shader);
        maptalks.GLTFLayer.registerShader('c', 'WireframeShader', shader);
        const shaders = maptalks.GLTFLayer.getShaders();
        expect(shaders.length).to.be.eql(12);
        maptalks.GLTFLayer.removeShader('a');
        maptalks.GLTFLayer.removeShader('b');
        maptalks.GLTFLayer.removeShader('c');
        done();
    });

    it('toJSON', () => {//TODO 整个json判断
        const gltflayer = new maptalks.GLTFLayer('gltf').addTo(map);
        new maptalks.GLTFMarker(center, {
            id: 'marker',
            symbol:{
                url: url1,
                animation: true,
                translationX: 1,
                translationY: 1,
                translationZ: 1,
                rotationX: 0, 
                rotationY: 0, 
                rotationZ: 90, 
                scaleX: 1,
                scaleY: 1,
                scaleZ: 1,
                shadow: true,
                uniforms: {
                    polygonFill: [1, 0, 0, 1],
                    polygonOpacity: 0.8
                }
            },
            properties: {
                prop: 'value'
            }
        }).addTo(gltflayer);
        const layerJSON = gltflayer.toJSON();
        expect(JSON.stringify(layerJSON)).to.be.eql('{"type":"GLTFLayer","id":"gltf","options":{},"geometries":[{"coordinates":{"x":0,"y":0},"options":{"symbol":{"url":"models/cube-animation/cube.gltf","animation":true,"translationX":1,"translationY":1,"translationZ":1,"rotationX":0,"rotationY":0,"rotationZ":90,"scaleX":1,"scaleY":1,"scaleZ":1,"shadow":true,"uniforms":{"polygonFill":[1,0,0,1],"polygonOpacity":0.8}},"id":"marker","properties":{"prop":"value"}},"zoomOnAdded":17}]}');
    });

    it('fromJSON', (done) => {//TODO 增加像素判断
        const gltflayer1 = new maptalks.GLTFLayer('gltf1').addTo(map);
        const marker = new maptalks.GLTFMarker(center, {
            symbol:{
                url: url1,
                animation: true
            }
        }).addTo(gltflayer1);
        marker.once('load', () => {
            setTimeout(function() {
                const pixel1 = pickPixel(map, map.width / 2, map.height / 2, 1, 1);
                const layerJSON = gltflayer1.toJSON();
                layerJSON.id = 'gltf2';
                gltflayer1.remove();
                const gltflayer2 = maptalks.GLTFLayer.fromJSON(layerJSON);
                gltflayer2.addTo(map);
                setTimeout(function() {
                    const pixel2 = pickPixel(map, map.width / 2, map.height / 2, 1, 1);
                    expect(pixelMatch(pixel1, pixel2)).to.be.eql(true);
                    done();
                }, 100);
            }, 100);
        });
    });

    it('setStyle、toJSON、fromJSON', (done) => {
        const gltflayer = new maptalks.GLTFLayer('gltf').addTo(map);
        const markers = [];
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                const gltfmarker = new maptalks.GLTFMarker(center.add(i * 0.01 - 0.015, j * 0.01 - 0.015), {
                    properties: {
                        'num': (i + j) * 0.1
                    }
                });
                markers.push(gltfmarker);
            }
        }
        gltflayer.addGeometry(markers);
        const style = [{
            'filter': ['<', 'num', 0.2],
            'symbol': {
                'url': url1,
                'animation': true,
                'loop': true,
                'scale': [2, 2, 2],
                'rotation': [90, 0, 0],
                'shader': 'phong',
                'polygonFill': [0.5, 0.5, 0.5, 1.0],
                'polygonOpacity': 0.8,
                'uniforms': {
                    'baseColorFactor': [0.8, 0.2, 0.0, 1.0]
                }
            }
        },
        {
            'filter': ['>=', 'num', 0.2],
            'symbol': {
                'url': url2,
                'shader': 'wireframe',
                'rotation': [90, 0, 0],
                'uniforms': {
                    'time': 0,
                    'seeThrough': true,
                    'thickness': 0.03
                }
            }
        }];
        gltflayer.setStyle(style);
        const container1 = document.createElement('div');
        container1.style.width = '400px';
        container1.style.height = '300px';
        document.body.appendChild(container1);
        setTimeout(function () {
            const style1 = gltflayer.getStyle();
            expect(style1.length).to.be.eql(style.length);
            for (let i = 0; i < style1.length; i++) {
                for (const s in style1[i]) {
                    expect(style1[i][s]).to.be.eql(style[i][s]);
                }
            }
            const json = map.toJSON();
            expect(json.layers[0].style.length).to.be.eql(style.length);
            const geometries = json.layers[0].geometries;
            for (let i = 0; i < geometries.length; i++) {
                expect(geometries[i].options.properties).to.be.ok();
            }
            const map1 = maptalks.Map.fromJSON(container1, json);
            map1.remove();
            maptalks.DomUtil.removeDomNode(container1);
            
            done();
        }, 100);
    });

    it('updateSymbol, setStyle event, updateSymbol event', (done) => {
        let completeIndex = 0;
        const gltflayer = new maptalks.GLTFLayer('gltf').addTo(map);
        const markers = [];
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                const gltfmarker = new maptalks.GLTFMarker(center.add(i * 0.01 - 0.015, j * 0.01 - 0.015), {
                    properties: {
                        'num': (i + j) * 0.1
                    }
                });
                markers.push(gltfmarker);
            }
        }
        gltflayer.addGeometry(markers);
        const style = [{
            'filter': ['<', 'num', 0.2],
            'symbol': {
                'url': url1,
                'animation': true,
                'loop': true,
                'scale': [2, 2, 2],
                'rotation': [90, 0, 0],
                'shader': 'phong',
                'uniforms': {
                    'baseColorFactor': [0.8, 0.2, 0.0, 1.0]
                }
            }
        },
        {
            'filter': ['>', 'num', 0.2],
            'symbol': {
                'url': url2,
                'shader': 'wireframe',
                'rotation': [90, 0, 0],
                'uniforms': {
                    'time': 0,
                    'seeThrough': true,
                    'thickness': 0.03
                }
            }
        },
        {
            'filter': ['==', 'num', 0.2],
            'symbol': {
                url : url3,
                shader: 'phong',
                rotationX: 90,
                rotationY: 0,
                rotationZ: 0,
                polygonFill: [1.0, 1.0, 1.0, 1.0],
                polygonOpacity: 1.0
            }
        }];
        gltflayer.on('setstyle', () => {
            completeIndex++;
            if (completeIndex === 3) {
                done();
            }
        });
        gltflayer.on('updatesymbol', () => {
            completeIndex++;
            if (completeIndex === 3) {
                done();
            }
        });
        gltflayer.setStyle(style);
        setTimeout(function () {
            gltflayer.updateSymbol(0, {
                animation: true,
                loop: true,
                visible: true,
                url: url4,
                shader: 'pbr',
                scaleX: 2,
                scaleY: 2,
                scaleZ: 2,
                translationX: 1,
                translationY: 0,
                translationZ: 0,
                rotationX: 90,
                rotationY: 0,
                rotationZ: 0,
                uniforms: {
                    'baseColorFactor': [0.73, 0.73, 0.73, 1],
                    'albedoPBRFactor': 1,
                    'specularF0Factor': 0.5,
                    'outputLinear': 0,
                    'anisotropyDirection': 0,
                    'anisotropyFactor': 0,
                    'roughnessFactor': 0.4,
                    'metallicFactor': 0,
                    'uvScale': [1, 1],
                    'uvOffset': [0, 0],
                    'normalMapFactor': 1,
                    'normalMapFlipY': 0,
                    'clearCoatThickness': 5,
                    'clearCoatFactor': 0,
                    'clearCoatIor': 1.4,
                    'clearCoatRoughnessFactor': 0.04,
                    'clearCoatF0': 0.04,
                    'emitColor': [0, 0, 0],
                    'emitColorFactor': 1,
                    'emitMultiplicative': 0,
                    'hsv': [0, 0, 0],
                    'occlusionFactor': 1,
                    'EnvironmentTransform': [0.5063, -0.0000, 0.8624, 0.6889, 0.6016, -0.4044, -0.5188, 0.7988, 0.3046],
                    'ClearCoatTint': [0.0060, 0.0060, 0.0060],
                    'SpecularAntiAliasingVariance': 1,
                    'SpecularAntiAliasingThreshold': 1
                }
            });
            completeIndex++;
            if (completeIndex === 3) {
                done();
            }
        }, 100);
    });

    it('fit size', (done) => {
        const layer = new maptalks.GLTFLayer('layer', {
            fitSize: 100
        }).addTo(map);
        const gltfMarker = new maptalks.GLTFMarker(center, {
            url: url1
        }).addTo(layer);
        setTimeout(function () {
            const renderer = layer.getRenderer();
            const fitSize = renderer.getMarkerFitSizeScale(gltfMarker);
            expect(fitSize).to.be.eql([0.2664926988975706 * 2, 0.2664926988975706 * 2, 0.2664926988975706 * 2]);
            done();
        }, 100);
    });

    it('fit translate', done => {
        const layer = new maptalks.GLTFLayer('layer', {
            fitSize: 100
        }).addTo(map);
        const gltfMarker = new maptalks.GLTFMarker(center, {
            url: url1
        }).addTo(layer);
        setTimeout(function () {
            const renderer = layer.getRenderer();
            const fitTranslate = renderer.getMarkerFitTranslate(gltfMarker);
            expect(fitTranslate).to.be.eql([0, -2.7755575615628914e-17 * 2, -0.0027448748514599377 * 2]);
            done();
        }, 100);
    });

    it('change gltfmarker\'s url, and then should update fit translate', done => {
        const gltflayer = new maptalks.GLTFLayer('layer');
        new maptalks.GroupGLLayer('group', [gltflayer],  { sceneConfig }).addTo(map);
        const gltfMarker = new maptalks.GLTFMarker(center, {
            animation: true
        }).addTo(gltflayer);
        setTimeout(function() {
            gltfMarker.updateSymbol({ url: url12 });
            gltfMarker.on('load', () => {
                setTimeout(function() {
                    const renderer = gltflayer.getRenderer();
                    const fitTranslate = renderer.getMarkerFitTranslate(gltfMarker);
                    expect(fitTranslate).to.be.eql([0, 0.0011782542035874838 * 2, 0.39234494443387824 * 2]);
                    done();
                }, 100);
            });
        }, 100);
    });

    it('toGeoJSON', () => { //TODO 把json打印出来判断整体是不是一致
        const gltflayer = new maptalks.GLTFLayer('gltf', geojson).addTo(map);
        const features = geojson.features;
        gltflayer.getGeometries().map((m, i) => {
            const json = m.toGeoJSON();
            expect(JSON.stringify(json)).to.be.eql(JSON.stringify(features[i]));
        });
    });

    it('empty gltflayer add to groupgllayer', () => {
        const gltflayer = new maptalks.GLTFLayer('layer');
        new maptalks.GroupGLLayer('group', [gltflayer],  { sceneConfig }).addTo(map);
    });

    it('support altitude for coordinate', done => {
        const gltflayer = new maptalks.GLTFLayer('gltflayer').addTo(map);
        const altitude = 100;
        const marker = new maptalks.GLTFMarker([center.x, center.y, altitude], {
            symbol : {
                url: url2
            }
        }).addTo(gltflayer);
        map.setPitch(50);
        marker.on('click', () => {
            done();
        });
        gltflayer.on('modelload', () => {
            setTimeout(function() {
                //TODO 判断在正确位置响应事件
                map.fire('dom:click', {
                    containerPoint: new maptalks.Point([map.width / 2, 5])
                });
            }, 100);
        });
    });

    it('The units for translations are meters', () => {
        const gltflayer = new maptalks.GLTFLayer('gltflayer');
        const marker = new maptalks.GLTFMarker(center, {
            symbol: {
                translationX: 0,
                translationY: -133,
                translationZ: 0
            }
        }).addTo(gltflayer);
        marker.on('click', () => {
            done();
        });
        new maptalks.GroupGLLayer('gl', [gltflayer], {sceneConfig}).addTo(map);
        const clickPoint = new maptalks.Coordinate([-0.000010728836059570312, -0.0013732910154828915]);
        map.fire('dom:click', {
            coordinate: clickPoint
        });
    });

    it('add many layers in map', (done) => {
        const times = 5;
        let count = 0;
        const complete = function (layer) {
            const renderer = layer.getRenderer();
            expect(Object.keys(renderer.getShaderList()).length).to.be.eql(9);
            layer.remove();
            count++;
            if (count === times) {
                done();
            }
        };
        for (let i = 0; i < times; i++) {
            const layer = new maptalks.GLTFLayer('layer' + i).addTo(map);
            new maptalks.GLTFMarker(center, {
            }).addTo(layer);
            layer.once('rendercomplete-debug', () => {
                complete(layer);
            });
        }
    });

    it('Adding gltfmarkers in different layers will not change the global shadermap', () => {
        const shadermap = maptalks.GLTFLayer.getShaderMap();
        const layer1 = new maptalks.GLTFLayer('layer1').addTo(map);
        expect(Object.keys(shadermap).length).to.be.eql(9);
        new maptalks.GLTFMarker(center, {
            symbol: {
                uniforms: {
                    lightAmbient: [1.0, 0.0, 0.0]
                }
            }
        }).addTo(layer1);
        expect(shadermap['phong'].uniforms.lightAmbient).not.to.be.eql([1.0, 0.0, 0.0]);
        const layer2 = new maptalks.GLTFLayer('layer2').addTo(map);
        new maptalks.GLTFMarker(center, {
            symbol: {
                uniforms: {
                    lightAmbient: [0.0, 1.0, 0.0]
                }
            }
        }).addTo(layer2);
        expect(shadermap['phong'].uniforms.lightAmbient).not.to.be.eql([0.0, 1.0, 0.0]);
    });

    it('when registering new shader on GLTFLayer, ShaderMap should updating globally', () => {
        const ShaderMap  = maptalks.GLTFLayer.getShaderMap();
        expect(Object.keys(ShaderMap).length).to.be.eql(9);
        expect(ShaderMap['phong']).to.be.ok();
        maptalks.GLTFLayer.registerShader('a', 'MeshShader', {
            uniforms1: 'uniformValue'
        }, {});
        expect(Object.keys(ShaderMap).length).to.be.eql(10);
        expect(ShaderMap['a']).to.be.ok();
        maptalks.GLTFLayer.registerShader('b', 'MeshShader', {
            uniforms2: 'uniformValue'
        }, {});
        expect(Object.keys(ShaderMap).length).to.be.eql(11);
        expect(ShaderMap['b']).to.be.ok();
        maptalks.GLTFLayer.removeShader('a');
        maptalks.GLTFLayer.removeShader('b');
        expect(Object.keys(ShaderMap).length).to.be.eql(9);
    });

    it('remove shader', () => {
        maptalks.GLTFLayer.registerShader('shader1', 'MeshShader', {
            uniforms: 'uniformValue'
        });
        const ShaderMap  = maptalks.GLTFLayer.getShaderMap();
        const shaders1 = maptalks.GLTFLayer.getShaders();
        expect(shaders1.length).to.be.eql(10);
        expect(ShaderMap['shader1']).to.be.ok();
        maptalks.GLTFLayer.removeShader('shader1');
        const shaders2 = maptalks.GLTFLayer.getShaders();
        expect(shaders2.length).to.be.eql(9);
        expect(ShaderMap['shader1']).not.to.be.ok();
    });
});