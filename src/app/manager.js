'use strict'

import { deleteCache } from '../file/cache.js';
import { updateCamera } from '../webgl/camera.js';
import { reloadShaders } from '../webgl/scene.js';
import { updateSceneFloatUniforms, updateSceneLights } from '../webgl/scene.js';

/**
 * Updates the application environment based on user input.
 * @param {*} appData object with application data
 * @param {*} UI UI manager object
 */
function updateAppFromUI(appData, UI)
{
  if (UI.appControls.reloadShaders)
    reloadShaders(appData.environment.scene);

  // if (UI.appControls.reloadDicom)
    // use loadDicom(folder, useCache = false); 

  if (UI.appControls.deleteCache)
    deleteCache();
}

/**
 * Updates the application for each frame. This includes user input, camera, float uniforms.
 * @param {*} appData object with application data
 * @param {*} UI UI manager object
 */
export function updateApp(appData, UI)
{
  updateAppFromUI(appData, UI);
  updateCamera(appData.environment.camera, UI.cameraControls, appData.environment.viewport, appData.environment.time.delta);
  updateSceneFloatUniforms(appData.environment.scene, appData.settings.uniforms);
  updateSceneLights(appData.environment.scene, appData.environment.lights);
}
