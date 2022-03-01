import * as maptalks from 'maptalks';
import * as maptalksgl from '@maptalks/gl';

//refereing maptalksgl to include it in rollup bundle
const mat4 = maptalksgl.mat4;
mat4.create();

import chunk from './worker.js';
maptalks.registerWorkerAdapter('@maptalks/vt', chunk);

export * from '../src/layer/';

