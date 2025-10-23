'use strict'

import loadDicom from './file/dicom.js';
import { initDebugUI, initUIData } from './ui/init.js';
import { initGLCanvas, initGLContext, initGLStates, setOutputResolution } from './webgl/init.js';
import createShaderProgram from './webgl/program.js';
import render from './webgl/render.js';
import { create2DTexture, createVolumeTexture } from './webgl/texture.js';
import { createSliceGeometry, createVolumeGeometry, createLoadingScreenGeometry } from './webgl/geometry.js';
import { updateCamera, initCamera } from './webgl/camera.js';
import loadImage from './file/image.js';
import { controlApp, controlCamera, initAppControls, initCameraControls, initKeyboardControls, initMouseControls, resetAppControls, resetCameraControls, resetKeyboardControls, resetMouseControls } from './ui/controls.js';

/* --------------------- */
/* --GLOBAL VARIABLES--- */
/* --------------------- */

/** @type {HTMLCanvasElement} */    // for VSCode to know that canvas is an HTML Canvas Element
let canvas = undefined;             // HTML <canvas> element 
let gl = undefined;                 // WebGL rendering context element
let pane = undefined;               // Tweakpane rendering window
let geometries = [];                // array of rendered objects
let viewportMain = undefined;       // main viewport position and dimensions

// Debug variables
const debugMode = false;
let geometriesDebug = [];
let viewportDebug = undefined;

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
  boneCortical: { min: 500 + C, max: 1900 + C },

};

// Transfer Function Definition
// NOTE: To add another medium
// 1. define its values here
// 2. Dually add them to UIData in ui/init.js (for Tweakpane and for shader uniform)
// 3. Add binding to the UI pane (interval, color + on change events)
// 4. Add 2 uniforms (itv, color) to the volumeGeometry object in createVolumeGeometry - webgl/geometry.js
// 5. Handle in the shader
// const tf = {
//   air: { interval: hu.air, color: {r: 0, g: 0, b: 0, a: 0} },
//   lungs: { interval: hu.lungs, color: {r: 0.65, g: 0.35, b: 0.11, a: 0.00} },
//   fat: { interval: hu.fat, color: {r: 0.82, g: 0.83, b: 0.18, a: 0.11} },
//   water: { interval: hu.water, color: {r: 0.03, g: 0.49, b: 0.87, a: 0.12} },
//   muscle: { interval: hu.muscle, color: {r: 0.46, g: 0.02, b: 0.02, a: 0.05} },
//   softTissueContrast: { interval: hu.softTissueContrast, color: {r: 0.66, g: 0.36, b: 0.52, a: 0.02} },
//   boneCancellous: { interval: hu.boneCancellous, color: {r: 0.17, g: 0.23, b: 0.66, a: 0.43} },
//   boneCortical: { interval: hu.boneCortical, color: {r: 0.07, g: 0.42, b: 0.07, a: 0.80} },
// };

const tf = {
  air: { interval: hu.air, color: {r: 0, g: 0, b: 0, a: 0} },
  lungs: { interval: hu.lungs, color: {r: 0.65, g: 0.35, b: 0.11, a: 0.00} },
  fat: { interval: hu.fat, color: {r: 0.82, g: 0.83, b: 0.18, a: 0.00} },
  water: { interval: hu.water, color: {r: 0.03, g: 0.49, b: 0.87, a: 0.00} },
  muscle: { interval: hu.muscle, color: {r: 0.46, g: 0.02, b: 0.02, a: 0.00} },
  softTissueContrast: { interval: hu.softTissueContrast, color: {r: 0.66, g: 0.36, b: 0.52, a: 0.00} },
  boneCancellous: { interval: hu.boneCancellous, color: {r: 0.17, g: 0.23, b: 0.66, a: 0.43} },
  boneCortical: { interval: hu.boneCortical, color: {r: 0.07, g: 0.42, b: 0.07, a: 0.80} },
};

// Mediator object between Tweakpane and the rest of the application
let UIData = initUIData(tf);

let mouse = undefined;
let keyboard = undefined;
let camera = undefined;
let cameraControls = undefined;
let appControls = undefined;

let previousTime = 0;

/* --------------------- */
/* ----FILE LOADING----- */
/* --------------------- */

// Load DICOM during module load
const imageDataPromise = loadDicom('CT WB w-contrast 5.0 B30s');
// Load images for texture use
const loadingScreenImagePromise = loadImage('loading.png');

// Define WebGL window initialization
window.onload = async function init()
{
  /* --------------------- */
  /* --UI INITIALIZATION-- */
  /* --------------------- */

  pane = initDebugUI(UIData);

  /* --------------------- */
  /* CANVAS INITIALIZATION */
  /* --------------------- */
  
  canvas = initGLCanvas();  
  gl = initGLContext(canvas);
  setOutputResolution(canvas);
  initGLStates(gl);
  
  /* --------------------- */
  /* SHADER INITIALIZATION */
  /* --------------------- */

  const loadingScreenProgramInfo = await createShaderProgram(gl, "fsquad", "fstexture");
  const sliceProgramInfo = await createShaderProgram(gl, "fsquad", "slice_texture");
  const volumeProgramInfo = await createShaderProgram(gl, "fsquad", "raytrace");

  console.log(volumeProgramInfo);

  /* --------------------- */
  /* -DATA INITIALIZATION- */
  /* --------------------- */

  viewportMain = {
    leftX: 0,
    bottomY: debugMode ? canvas.height * 0.5 : 0,
    width: canvas.width,
    height: debugMode ? canvas.height * 0.5 : canvas.height,
  };
  
  viewportDebug = {
    leftX: 0,
    bottomY: 0,
    width: canvas.width,
    height: canvas.height * 0.5,
  }

  mouse = initMouseControls(canvas);
  keyboard = initKeyboardControls();
  camera = initCamera(viewportMain);
  cameraControls = initCameraControls();
  appControls = initAppControls();

  loadingScreenImagePromise.then((loadingScreenImage) =>{
    const loadingScreenTexture = create2DTexture(gl, loadingScreenImage, { width: 1920, height: 1080 });
    geometries.push(createLoadingScreenGeometry(gl, loadingScreenProgramInfo, loadingScreenTexture));
    geometriesDebug.push(createLoadingScreenGeometry(gl, loadingScreenProgramInfo, loadingScreenTexture));

    /* --------------------- */
    /* -----RENDER LOAD----- */
    /* --------------------- */

    render(gl, canvas, viewportMain, geometries);
    if (debugMode)
      render(gl, canvas, viewportDebug, geometries);
  })

  // Asynchronously load DICOM to display later
  imageDataPromise.then((imageData) => {

    console.log("DICOM:", imageData);
    const dimensions = imageData.dimensions;
    const volume = imageData.volume;

    const volumeTexture = createVolumeTexture(gl, volume, dimensions);

    // Remove loading screen
    geometries.pop();
    geometriesDebug.pop();

    geometries.push(createVolumeGeometry(gl, volumeProgramInfo, volumeTexture, dimensions, UIData, camera));
    geometriesDebug.push(createSliceGeometry(gl, sliceProgramInfo, volumeTexture, dimensions, UIData));

    /* --------------------- */
    /* -----RENDER LOOP----- */
    /* --------------------- */
    
    // start render loop with the volume geometry loaded
    this.requestAnimationFrame(renderLoop);
  })
}

async function reloadShaders()
{
  // NOTE: Temporary manual solution, should be possible to make each geometry take care of its own shader
  const volumeProgramInfo = await createShaderProgram(gl, "fsquad", "raytrace");

  geometries[0].programInfo = volumeProgramInfo;

  console.log("Reloaded shaders");
}

function updateApp()
{
  if (appControls.reloadShaders)
    reloadShaders();
}

/**
 * Updates variables throughout the render loop
 */
function update(currentTime)
{
  const timeDelta = 0.001 * (currentTime - previousTime);
  UIData.framesPerSecond = timeDelta > 0.0 ? 1.0 / timeDelta : 0.0;
  geometriesDebug[0].uniforms.u_slice_number = UIData.slice;

  controlCamera(mouse, cameraControls);
  updateCamera(camera, cameraControls, viewportMain, timeDelta);

  controlApp(keyboard, appControls);
  updateApp();

  previousTime = currentTime;
  resetMouseControls(mouse);
  resetKeyboardControls(keyboard);
  resetCameraControls(cameraControls);
  resetAppControls(appControls);
}

/**
 * Main render loop called via requestAnimationFrame(). 
 * Actual rendering is forwarded to the main render() function
 */
function renderLoop(currentTime)
{
  update(currentTime);

  render(gl, canvas, viewportMain, geometries);
  if (debugMode)
    render(gl, canvas, viewportDebug, geometriesDebug)
  requestAnimationFrame(renderLoop);
}
