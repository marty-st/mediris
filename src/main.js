'use strict'

import * as twgl from 'twgl.js';
import loadDicom from './file/dicom.js';
import { initDebugGUI, initGUIData } from './ui/gui.js';
import { initUI, control, resetControls } from './ui/manager.js';
import { initGLCanvas, initGLContext, initGLStates, setOutputResolution } from './webgl/init.js';
import createShaderProgram from './webgl/program.js';
import { createSceneEmpty, createSceneRaycast } from './webgl/scene.js';
import render from './webgl/render.js';
import { create2DTexture, createVolumeTexture } from './webgl/texture.js';
import { createVolumeGeometry, createLoadingScreenGeometry } from './webgl/geometry.js';
import { updateCamera, initCamera } from './webgl/camera.js';
import loadImage from './file/image.js';
import { deleteCache } from './file/cache.js';

/* GLOBAL VARIABLES */

// HU units are usually defined in the range <-1000, 3000>,
// however, the data loads in unsigned short format, so
// the values must be offset by a constant
const C = 1000;
// Hounsfield units for various media
// template: { min: 0 + C, max: 0 + C },
const hu = {
  air: { min: -1000 + C, max: -950 + C},
  lungs: { min: -750 + C, max: -700 + C },
  fat: { min: -120 + C, max: -90 + C },
  water: { min: 0 + C, max: 0 + C },
  muscle: { min: 35 + C, max: 55 + C },
  softTissueContrast: { min: 100 + C, max: 300 + C },
  boneCancellous: { min: 300 + C, max: 400 + C },
  boneCortical: { min: 350 + C, max: 1900 + C },

};

// Transfer Function Definition
const tf = {
  air: { interval: hu.air, color: {r: 0, g: 0, b: 0, a: 0}, enabled: false},
  lungs: { interval: hu.lungs, color: {r: 0.65, g: 0.35, b: 0.11, a: 0.00}, enabled: false},
  fat: { interval: hu.fat, color: {r: 0.82, g: 0.83, b: 0.18, a: 0.00}, enabled: false},
  water: { interval: hu.water, color: {r: 0.03, g: 0.49, b: 0.87, a: 0.00}, enabled: false},
  muscle: { interval: hu.muscle, color: {r: 0.46, g: 0.02, b: 0.02, a: 0.00}, enabled: false},
  softTissueContrast: { interval: hu.softTissueContrast, color: {r: 0.66, g: 0.36, b: 0.52, a: 0.00}, enabled: false},
  boneCancellous: { interval: hu.boneCancellous, color: {r: 0.41, g: 0.66, b: 0.17, a: 0.0}, enabled: false},
  boneCortical: { interval: hu.boneCortical, color: {r: 0.88, g: 0.88, b: 0.88, a: 1.00}, enabled: true},
};

// Lights Setup
const lights = {
    keyLight: {
      position: {x: 0, y: 1, z: -1},
      intensity: 1.0,
    },
    fillLight: {
      position: {x: 1, y: 0.75, z: 0},
      intensity: 0.5,
    },
    backLight: {
      position: {x: 0, y: 1, z: 1},
      intensity: 0.25,
    },
};

/** @type {HTMLCanvasElement} */    // for VSCode to know that canvas is an HTML Canvas Element
let canvas = undefined;             // HTML <canvas> element 
let gl = undefined;                 // WebGL rendering context element
let pane = undefined;               // Tweakpane rendering window
let scene = undefined;              // Current scene object
let viewportMain = undefined;       // main viewport position and dimensions
let camera = undefined;

// Mediator object between Tweakpane and the rest of the application
let GUIData = undefined;
// Wrapper object for the UI controls & GUI, managed by the UI manager
let UI = undefined;

// Elapsed time helper variable
let previousTime = 0;

// Shader program file names
const loadingScreenShaderNames = {vert: "fsquad", frag: "fstexture"};
const mainShaderNames = {vert: "fsquad", frag: "raytrace"};

// FILE PRELOAD
// Load DICOM during module load
const imageDataPromise = loadDicom('CT WB w-contrast 5.0 B30s', true);
// Load images for texture use
const loadingScreenImagePromise = loadImage('loading.png');

/**/

// Define WebGL window initialization
window.onload = async function init()
{
  /* --------------------- */
  /* CANVAS INITIALIZATION */
  /* --------------------- */
  
  canvas = initGLCanvas();  
  setOutputResolution(canvas);
  
  gl = initGLContext(canvas);
  initGLStates(gl);
  
  /* --------------------- */
  /* UI INITIALIZATION --- */
  /* --------------------- */

  GUIData = initGUIData(tf, lights);
  pane = initDebugGUI(GUIData);
  UI = initUI(canvas, GUIData);

  /* --------------------- */
  /* SHADER INITIALIZATION */
  /* --------------------- */

  const useCachedShaderText = false;

  const loadingScreenProgramInfo = await createShaderProgram(gl, loadingScreenShaderNames.vert, loadingScreenShaderNames.frag, useCachedShaderText);
  const volumeProgramInfo = await createShaderProgram(gl, mainShaderNames.vert, mainShaderNames.frag, useCachedShaderText);

  /* --------------------- */
  /* DATA INITIALIZATION - */
  /* --------------------- */

  viewportMain = {
    leftX: 0,
    bottomY: 0,
    width: canvas.width,
    height: canvas.height,
  };

  camera = initCamera(viewportMain);

  const sceneEmpty = createSceneEmpty();
  const sceneRaycast = createSceneRaycast(gl, volumeProgramInfo, camera, GUIData);
  scene = sceneRaycast;

  loadingScreenImagePromise.then((loadingScreenImage) =>{
    const loadingScreenTexture = create2DTexture(gl, loadingScreenImage, { width: 1920, height: 1080 });
    const loadingScreenGeometry = [createLoadingScreenGeometry(gl, loadingScreenProgramInfo, loadingScreenShaderNames, loadingScreenTexture)];

    /* --------------------- */
    /* RENDER LOAD SCREEN -- */
    /* --------------------- */

    render(gl, canvas, viewportMain, sceneEmpty, loadingScreenGeometry);
  })

  // Asynchronously load DICOM to display later
  imageDataPromise.then((imageData) => {

    console.log("DICOM:", imageData);
    const dimensions = imageData.dimensions;
    const volume = imageData.volume;

    const volumeTexture = createVolumeTexture(gl, volume, dimensions);

    scene.geometries.push(createVolumeGeometry(gl, volumeProgramInfo, mainShaderNames, volumeTexture, dimensions, GUIData));

    /* --------------------- */
    /* RENDER LOOP --------- */
    /* --------------------- */
    
    // start render loop with the volume geometry loaded
    this.requestAnimationFrame(renderLoop);
  })
}

/**
 * Reloads the shader programs by re-fetching their appropriate text files. Used for application development.
 */
async function reloadShaders()
{
  for (const geometry of scene.geometries)
  {
    const shader = geometry.shaderFileNames;
  
    geometry.programInfo = await createShaderProgram(gl, shader.vert, shader.frag, false);
  
    if (geometry.uniformBlock)
    {
      const blockName = geometry.uniformBlock.info.name;
      geometry.uniformBlock.info = twgl.createUniformBlockInfo(gl, geometry.programInfo, blockName);
    }
  }
  
  // Uniforms and UBOs are shared by all geometries in a scene, hence only needs to be set once
  if (scene.geometries?.length > 0 && scene.uniformBlock)
  {
    const blockName = scene.uniformBlock.info.name;
    scene.uniformBlock.info = twgl.createUniformBlockInfo(gl, scene.geometries[0].programInfo, blockName);
  }

  console.log("Reloaded shaders");
}

/**
 * Updates the application environment based on user input.
 */
function updateApp()
{
  if (UI.appControls.reloadShaders)
    reloadShaders();

  // if (UI.appControls.reloadDicom)
    // use loadDicom(folder, useCache = false); 

  if (UI.appControls.deleteCache)
    deleteCache();
}

/**
 * Updates variables and object states fpr each frame throughout the render loop.
 * @param currentTime current application time in ms
 */
function update(currentTime)
{
  const timeDelta = 0.001 * (currentTime - previousTime);

  // FPS Counter
  GUIData.framesPerSecond = timeDelta > 0.0 ? 1.0 / timeDelta : 0.0;

  // Shading model GUI updates
  scene.uniforms.u_mode = GUIData.mode;
  scene.uniforms.u_step_size = GUIData.stepSize;
  scene.uniforms.u_default_step_size = GUIData.defaultStepSize;
  scene.uniforms.u_shading_model = GUIData.shadingModel;
  scene.uniforms.u_roughness = GUIData.roughness;
  scene.uniforms.u_subsurface = GUIData.subsurface;
  scene.uniforms.u_sheen = GUIData.sheen;
  scene.uniforms.u_sheen_tint = GUIData.sheenTint;

  // Light properties GUI updates
  let i = 0;
  for (const key in GUIData.lights)
  {
    scene.uniformBlock.uniforms.lights_array[i].intensity = GUIData.lights[key].intensity;
    ++i;
  }
  
  // User controls
  control(UI);

  updateCamera(camera, UI.cameraControls, viewportMain, timeDelta);
  updateApp();

  resetControls(UI);

  previousTime = currentTime;
}

/**
 * Main render loop called via requestAnimationFrame(). 
 * Actual rendering is forwarded to the main render() function.
 * @param {*} currentTime current application time in ms
 */
function renderLoop(currentTime)
{
  update(currentTime);

  render(gl, canvas, viewportMain, scene, scene.geometries);

  requestAnimationFrame(renderLoop);
}
