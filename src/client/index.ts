/* eslint-disable @typescript-eslint/no-explicit-any */
// declare const tfvis: typeof import('@tensorflow/tfjs-vis');
// import * as tfvis from '@tensorflow/tfjs-vis';
// import type { fitCallbacks } from '@tensorflow/tfjs-vis/dist/show/history';
import './index.css';
// import { deserialize } from '../extension/serializer';
// import { renderHeatmap, renderLayer, valuesDistribution } from './common';

console.log('Inside VIS');
const api = acquireVsCodeApi();
window.addEventListener('message', (e) => onMessage(e.data));
api.postMessage({ type: 'loaded' });

function onMessage(data?: { _type?: 'helloWorld' } | any) {
    if (!data || !data.type) {
        return;
    }
    /*switch (data.type) {
    }*/
}
