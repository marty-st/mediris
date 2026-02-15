'use strict'

import loadDicom from './file/dicom.js';
import { initDebugGUI, initGUIData } from './ui/gui.js';
import { initUI, control, resetControls } from './ui/manager.js';
import { initGLCanvas, initGLContext, initGLStates, setOutputResolution } from './webgl/init.js';
import createShaderProgram from './webgl/program.js';
import { createSceneEmpty, createSceneRaycast } from './webgl/scene.js';
import render from './webgl/render.js';
import { create2DTexture, createVolumeTexture } from './webgl/texture.js';
import { createVolumeGeometry, createLoadingScreenGeometry } from './webgl/geometry.js';
import { initCamera } from './webgl/camera.js';
import loadImage from './file/image.js';
import { initAppData } from './app/data.js';
import { updateApp } from './app/manager.js';

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

// Application time keeping
const time = {
  current: 0,
  previous: 0,
  delta: 0,
};

// Application environment data
const environment = {
  time: time,
  camera: undefined,
  viewport: undefined,    // Viewport position and dimensions
  scene: undefined,       // Current scene object
  lights: lights 
};

// Application settings
const settings = {
  uniforms: {
    general: {
      u_mode: 0,
    },
    rayTracing: {
      u_default_step_size: 0.0025,
      u_step_size: 0.0025,
      u_shading_model: 0,
    },
    shadingModel: {
      u_roughness: 0.1,
      u_subsurface: 0.0,
      u_sheen: 0.0,
      u_sheen_tint: 0.0,
    },
  },
}

/** @type {HTMLCanvasElement} */    // for VSCode to know that canvas is an HTML Canvas Element
let canvas = undefined;             // HTML <canvas> element 
let gl = undefined;                 // WebGL rendering context element
let pane = undefined;               // Tweakpane rendering window

// Application data
const appData = initAppData(settings, environment, tf);

// Mediator object between Tweakpane and the rest of the application
let GUIData = undefined;
// Wrapper object for the UI controls & GUI, managed by the UI manager
let UI = undefined;

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

  GUIData = initGUIData(appData);
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

  appData.environment.viewport = {
    leftX: 0,
    bottomY: 0,
    width: canvas.width,
    height: canvas.height,
  };

  appData.environment.camera = initCamera(appData.environment.viewport);

  const sceneEmpty = createSceneEmpty();
  const sceneRaycast = createSceneRaycast(gl, volumeProgramInfo, appData.settings.uniforms, appData.environment);
  appData.environment.scene = sceneRaycast;

  loadingScreenImagePromise.then((loadingScreenImage) =>{
    const loadingScreenTexture = create2DTexture(gl, loadingScreenImage, { width: 1920, height: 1080 });
    const loadingScreenGeometry = [createLoadingScreenGeometry(gl, loadingScreenProgramInfo, loadingScreenShaderNames, loadingScreenTexture)];

    /* --------------------- */
    /* RENDER LOAD SCREEN -- */
    /* --------------------- */

    render(gl, canvas, appData.environment.viewport, sceneEmpty, loadingScreenGeometry);
  })

  // Asynchronously load DICOM to display later
  imageDataPromise.then((imageData) => {

    console.log("DICOM:", imageData);
    const dimensions = imageData.dimensions;
    const volume = imageData.volume;

    const volumeTexture = createVolumeTexture(gl, volume, dimensions);

    appData.environment.scene.geometries.push(createVolumeGeometry(gl, volumeProgramInfo, mainShaderNames, volumeTexture, dimensions, appData));

    /* --------------------- */
    /* RENDER LOOP --------- */
    /* --------------------- */
    
    // start render loop with the volume geometry loaded
    this.requestAnimationFrame(renderLoop);
  })
}

/**
 * Updates variables and object states fpr each frame throughout the render loop.
 * @param currentTime current application time in ms
 */
function update(currentTime)
{
  const time = appData.environment.time;
  time.current = currentTime;
  time.delta = 0.001 * (time.current - time.previous);

  // FPS Counter
  GUIData.framesPerSecond = time.delta > 0.0 ? 1.0 / time.delta : 0.0;
  
  // User controls
  control(UI);

  // State updates
  updateApp(appData, UI);

  resetControls(UI);

  time.previous = time.current;
}

/**
 * Main render loop called via requestAnimationFrame(). 
 * Actual rendering is forwarded to the main render() function.
 * @param {*} currentTime current application time in ms
 */
function renderLoop(currentTime)
{
  update(currentTime);

  render(gl, canvas, appData.environment.viewport, appData.environment.scene, appData.environment.scene.geometries);

  requestAnimationFrame(renderLoop);
}
