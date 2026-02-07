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

/**
 * Creates an object that manages user controls and GUI. 
 * @param {*} canvas HTML canvas element
 * @param {*} GUIData mediator object between GUI and the rest of the application
 * @returns UI manager object
 */
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

/**
 * Calls functions that process user input.
 * @param {*} UI UI manager object
 */
export function control(UI)
{
  controlCamera(UI.mouse, UI.keyboard, UI.cameraControls);
  controlApp(UI.keyboard, UI.appControls);
}

/**
 * Calls functions that reset frame-dynamic states of control objects.
 * @param {*} UI UI manager object
 */
export function resetControls(UI)
{
  resetMouseControls(UI.mouse);
  resetKeyboardControls(UI.keyboard);
  resetCameraControls(UI.cameraControls);
  resetAppControls(UI.appControls);
}
