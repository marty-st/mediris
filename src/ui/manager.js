'use strict'

import { 
  controlApp, 
  controlCamera, 
  initAppControls, 
  initCameraControls, 
  initKeyboardControls, 
  initMouseControls, 
  resetAppControls, 
  resetCameraControls, 
  resetKeyboardControls, 
  resetMouseControls 
} from './controls.js';

export function initUI(canvas, GUIData)
{
  return {
    GUIData: GUIData,
    mouse: initMouseControls(canvas),
    keyboard: initKeyboardControls(),
    cameraControls: initCameraControls(),
    appControls: initAppControls(),
  };
}

export function control(UI)
{
  controlCamera(UI.mouse, UI.keyboard, UI.cameraControls);
  controlApp(UI.keyboard, UI.appControls);
}

export function resetControls(UI)
{
  resetMouseControls(UI.mouse);
  resetKeyboardControls(UI.keyboard);
  resetCameraControls(UI.cameraControls);
  resetAppControls(UI.appControls);
}