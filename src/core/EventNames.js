/**
 * store events name to on/off/fire
 * cause of each const event name has been changed by 'stamp',we recommend using this method.
 * @author yellow 2017/5/26
 */

import {stamp} from './../utils/stamp';

const _KIWI_EVENT_RESIZE = stamp('resize');

const _KIWI_EVENT_ANIMATION_ONCANCEL=stamp('animation_cancel');

const _KIWI_EVENT_ANIMATION_ONFINISH=stamp('animation_onfinish');

export {
    _KIWI_EVENT_RESIZE,
    _KIWI_EVENT_ANIMATION_ONCANCEL,
    _KIWI_EVENT_ANIMATION_ONFINISH
};