'use strict';

import { deleteCache } from '../file/cache.js';
import { updateCamera } from '../webgl/camera.js';
import { reloadShaders } from '../webgl/scene.js';
// import { updateVolumeMediaLights } from '../webgl/uniform.js';

/**
 * Updates the application environment based on user input.
 * @param {*} appData object with application data
 * @param {*} UI UI manager object
 */
async function updateAppFromUI(appData, UI)
{
  if (UI.appControls.reloadShaders)
    await reloadShaders(appData.context.gl, appData.environment.scene);

  // if (UI.appControls.reloadDicom)
  // use loadDicom(folder, useCache = false);

  if (UI.appControls.deleteCache)
    deleteCache();
}

/**
 * Updates the state object of `appData` based on other factors within the app.
 * @param {*} appData object with application data
 * @param {*} UI UI manager object
 */
function updateAppState(appData, UI)
{
  const state = appData.environment.state;

  if (!UI.cameraControls.idle || !UI.GUIData.idle || UI.appControls.reloadShaders)
    state.idleRender = false;
}

// function updateLights(appData)
// {
//   if (appData.environment.state.idleRender)
//     return;

//   updateVolumeMediaLights(appData.environment.cameraRelativeLights, appData.environment.camera);
// }

/**
 * Resets frame-dependent app states.
 * @param {*} state `appData` state object
 */
function resetAppState(state)
{
  state.idleRender = true;
}

/**
 * Updates the application for each frame. This includes user input, camera, float uniforms.
 * @param {*} appData object with application data
 * @param {*} UI UI manager object
 */
export function updateApp(appData, UI)
{
  updateAppFromUI(appData, UI);
  updateAppState(appData, UI);
  updateCamera(appData.environment.camera, UI.cameraControls, appData.environment.viewport, appData.environment.time.delta);
  // updateLights(appData);
}

/**
 * Updates the application after each frame.
 * @param {*} appData object with application data
 */
export function updateAppPostFrame(appData)
{
  resetAppState(appData.environment.state);
}
