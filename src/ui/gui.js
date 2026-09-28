'use strict';

import { Pane } from 'tweakpane';
import * as TweakpaneEssentialsPlugin from '@tweakpane/plugin-essentials';
import { vec2, vec3, vec4 } from 'gl-matrix';

/* ---------------------------------------------------------------------------------- */
/* INTERNAL GUI DATA STRUCTURE INITIALIZATION --------------------------------------------*/
/* ---------------------------------------------------------------------------------- */

/**
 * Creates an object that stores GUI related data.
 * @param {*} appData object with application data
 * @returns mediator object between GUI and the rest of the application
 */
export function initGUIData(appData)
{
  let GUIData = {
    idle: false,
    framesPerSecond: 0,
    // App Data
    settings: appData.settings,
    // lights: Object.fromEntries(Object.entries(appData.environment.volumeMedia)
    //   .map(([key, medium]) => [key, medium.lights])), // TODO: Is it needed?
    transferFunction: Object.fromEntries(Object.entries(appData.environment.volumeMedia)
      .map(([key, medium]) => [key, medium.transferFunction])),
    selectedVolumeMediumKey: Object.keys(appData.environment.volumeMedia)[0],
    volumeMedia: appData.environment.volumeMedia,
  };

  return GUIData;
}

/* ------------------------------------------------------------------------- */
/* TWEAKPANE INITIALIZATION ------------------------------------------------ */
/* ------------------------------------------------------------------------- */

function removeFolderBinding(folder, binding)
{
  folder.remove(binding);
}

function removeFolderBindings(folder)
{
  for (const child of folder.children)
    folder.remove(child);
}

function addTransferFunctionBinding(folder, GUIData)
{
  const key = GUIData.selectedVolumeMediumKey;
  const medium = GUIData.transferFunction[key];

  folder.addBinding(medium, "interval", { label: key, ...medium.options })
    .on('change', event =>
    {
      const { min, max } = event.value;
      vec2.set(medium.intervalVec, min, max);
    });

  folder.addBinding(medium, "color", {
    color: { type: "float" },
    picker: "inline",
    expanded: false,
  })
    .on('change', event =>
    {
      const { r, g, b, a } = event.value;
      vec4.set(medium.colorVec, r, g, b, a);
    });
}

function refreshTransferFunctionBinding(folder, GUIData)
{
  removeFolderBindings(folder);
  addTransferFunctionBinding(folder, GUIData);
}

/**
 * Creates a GUI section for tuning of the transfer function.
 * @param {*} folder Tweakfolder folder object
 * @param {*} GUIData mediator object between GUI and the rest of the application
 */
function addTransferFunctionFolder(folder, GUIData)
{
  const folderTF = folder.addFolder({ title: "Transfer Function" });
  addTransferFunctionBinding(folderTF, GUIData);

  return folderTF;
}

/**
 * Creates a GUI section for controlling the light sources.
 * @param {*} pane Tweakpane global-state object
 * @param {*} GUIData mediator object between GUI and the rest of the application
 */
function addLightsBindings(pane, GUIData)
{
  const folderLights = pane.addFolder({ title: "Lights" });

  for (const [key, light] of Object.entries(GUIData.lights))
  {
    const lightToggle = folderLights.addBinding(light, "enabled", { label: "toggle " + key });

    const lightPosition = folderLights.addBinding(light, "position", {
      label: key,
      min: -10,
      max: 10,
    })
      .on('change', event =>
      {
        const { x, y, z } = event.value;
        vec3.set(light.positionVec, x, y, z);
      });

    const lightIntensity = folderLights.addBinding(light, "intensity", {
      min: 0,
      max: 1,
    });

    // initial visibility
    lightPosition.hidden = !light.enabled;
    lightIntensity.hidden = !light.enabled;

    // visibility toggle
    lightToggle
      .on('change', event =>
      {
        lightPosition.hidden = !event.value;
        lightIntensity.hidden = !event.value;
      });
  }
}

function addShadingModelEnableBinding(index, folder, GUIData)
{
  return folder.addBinding(GUIData.volumeMedia[GUIData.selectedVolumeMediumKey].shading[index].enabled, "value", {
    label: "enable",
    index: 0,
  });
}

function refreshShadingModelEnableBinding(index, folder, GUIData, binding)
{
  removeFolderBinding(folder, binding);
  return addShadingModelEnableBinding(index, folder, GUIData);
}

function addShadingModelSelectBinding(index, folder, GUIData)
{
  const shadingModel = GUIData.volumeMedia[GUIData.selectedVolumeMediumKey].shading[index].model;
  const shadingModelsKeys = Object.keys(GUIData.volumeMedia[GUIData.selectedVolumeMediumKey].shading[index].parameters);

  return folder.addBinding(shadingModel, "value", {
    label: "model",
    // WARN: This will probably need to pull the options list from somewhere else when changes are introduced
    options: Object.fromEntries(shadingModelsKeys.map((key, index) => [key, index])),
  })
    .on('change', event =>
    {
      // WARN: This is not flexible
      const index = event.value;
      shadingModel.key = shadingModelsKeys[index];
    });
}

function addShadingModelParametersBindings(index, folder, GUIData)
{
  const modelKey = GUIData.volumeMedia[GUIData.selectedVolumeMediumKey].shading[index].model.key;
  const model = GUIData.volumeMedia[GUIData.selectedVolumeMediumKey].shading[index].parameters[modelKey];
  for (const [paramKey, param] of Object.entries(model))
  {
    folder.addBinding(param, "value", { label: paramKey, ...param.options });
  }
}

function refreshShadingModelParametersBindings(index, folder, GUIData)
{
  removeFolderBindings(folder);
  addShadingModelParametersBindings(index, folder, GUIData);
}

function addShadingModelParametersFolder(index, folder, GUIData)
{
  const folderP = folder.addFolder({
    title: "Parameters",
    expanded: false,
  });

  addShadingModelParametersBindings(index, folderP, GUIData);

  return folderP;
}

function addShadingModelBindings(index, folder, GUIData)
{
  let enableModelBinding = addShadingModelEnableBinding(index, folder, GUIData);
  const modelSelectBinding = addShadingModelSelectBinding(index, folder, GUIData);
  const folderP = addShadingModelParametersFolder(index, folder, GUIData);

  modelSelectBinding
    .on('change', () =>
    {
      enableModelBinding = refreshShadingModelEnableBinding(
        index,
        folder,
        GUIData,
        enableModelBinding
      );
      refreshShadingModelParametersBindings(index, folderP, GUIData);
    });
}

function refreshShadingModelBindings(index, folder, GUIData)
{
  removeFolderBindings(folder);
  addShadingModelBindings(index, folder, GUIData);
}

function addShadingFolders(folder, GUIData)
{
  let shadingsArray = [];
  for (let i = 0; i < GUIData.volumeMedia[GUIData.selectedVolumeMediumKey].shading.length; ++i)
  {
    const folderS = folder.addFolder({ title: `Shading ${i + 1}` });
    shadingsArray.push(folderS);
    addShadingModelBindings(i, folderS, GUIData);
  }

  return shadingsArray;
}

function addVolumeMediumSelectBinding(folder, GUIData)
{
  return folder.addBinding(GUIData, "selectedVolumeMediumKey", {
    label: "select",
    options: Object.fromEntries(Object.keys(GUIData.volumeMedia).map(key => [key, key])),
  });
}

function addVolumeMediumEnableBinding(folder, GUIData)
{
  return folder.addBinding(GUIData.volumeMedia[GUIData.selectedVolumeMediumKey].enabled, "value", {
    label: "enable",
    index: 0,
  });
}

function refreshVolumeMediumEnableBinding(folder, GUIData, binding)
{
  removeFolderBinding(folder, binding);
  return addVolumeMediumEnableBinding(folder, GUIData);
}

function addVolumeMediumFolder(folder, GUIData)
{
  const folderVM = folder.addFolder({ title: "Volume Medium" });

  const selectVMBinding = addVolumeMediumSelectBinding(folderVM, GUIData);

  let enableVMBinding = addVolumeMediumEnableBinding(folderVM, GUIData);

  const folderTF = addTransferFunctionFolder(folderVM, GUIData);

  const folderSArray = addShadingFolders(folderVM, GUIData);

  selectVMBinding
    .on('change', () =>
    {
      // NOTE: Needs to keep its existence for the remove function
      enableVMBinding = refreshVolumeMediumEnableBinding(
        folderVM,
        GUIData,
        enableVMBinding
      );
      refreshTransferFunctionBinding(folderTF, GUIData);
      for (let i = 0; i < folderSArray.length; ++i)
        refreshShadingModelBindings(i, folderSArray[i], GUIData);
    });

  return folderVM;
}

/**
 * Initializes the context of Tweakpane GUI elements for debugging purposes.
 * @param GUIData object that reflects states of Tweakpane controlled variables
 * @returns `Pane`object
 */
export function initDebugGUI(GUIData)
{
  const pane = new Pane();

  pane.registerPlugin(TweakpaneEssentialsPlugin);

  pane.addBinding(GUIData, "framesPerSecond", {
    readonly: true,
    label: "FPS",
    view: "graph",
    min: 0,
    max: 200,
  });

  // General
  pane.addBinding(GUIData.settings.uniforms.general.u_mode, "value", {
    label: "u_mode",
    options: GUIData.settings.uniforms.general.u_mode.options,
  });

  // Ray Tracing
  const folderRT = pane.addFolder({ title: "Ray Tracing" });

  for (const [key, setting] of Object.entries(GUIData.settings.uniforms.rayTracing))
  {
    const optionalParameters = "isList" in setting.options
      ? { label: key, options: setting.options }
      : { label: key, ...setting.options };

    folderRT.addBinding(setting, "value", optionalParameters);
  }

  // addLightsBindings(pane, GUIData);

  addVolumeMediumFolder(pane, GUIData);

  pane
    .on('change', event =>
    {
    // Ignore self-updating components
      if (event.target.key == "framesPerSecond")
        return;
      GUIData.idle = false;
    });

  return pane;
}

/**
 * Resets states affected by the 'on-change' event handler of the GUI pane.
 * @param {*} GUIData mediator object between GUI and the rest of the application
 */
export function resetGUIState(GUIData)
{
  GUIData.idle = true;
}
