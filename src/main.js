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
import { controlCamera, initCameraControls, initMouseControls, resetCameraControls, resetMouseControls } from './ui/controls.js';

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
const debugMode = true;
let geometriesDebug = [];
let viewportDebug = undefined;

// Transfer Function Definition
// NOTE: To add another medium
// 1. define its values here
// 2. Dually add them to UIData in ui/init.js (for Tweakpane and for shader uniform)
// 3. Add binding to the UI pane (interval, color + on change events)
// 4. Add 2 uniforms (itv, color) to the volumeGeometry object in createVolumeGeometry - webgl/geometry.js
// 5. Handle in the shader
const tf = {
  skin: { interval: {min: 1040, max: 1080}, color: {r: 0.46, g: 0.02, b: 0.02, a: 0.05} },
  boneCortical: { interval: {min: 1350, max: 3200}, color: {r: 0.07, g: 0.42, b: 0.07, a: 0.80} },
};

// Mediator object between Tweakpane and the rest of the application
let UIData = initUIData(tf);

let camera = undefined;
let mouse = undefined;
let cameraControls = undefined;

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

  /* --------------------- */
  /* -DATA INITIALIZATION- */
  /* --------------------- */

  viewportMain = {
    leftX: 0,
    bottomY: canvas.height * 0.5,
    width: canvas.width,
    height: canvas.height * 0.5,
  };
  
  viewportDebug = {
    leftX: 0,
    bottomY: 0,
    width: canvas.width,
    height: canvas.height * 0.5,
  }

  camera = initCamera(viewportMain);
  mouse = initMouseControls();
  cameraControls = initCameraControls();

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
  
  previousTime = currentTime;
  resetMouseControls(mouse);
  resetCameraControls(cameraControls);
}

/**
 * Main render loop called via requestAnimationFrame(). 
 * Actual rendering is forwarded to the main render() function
 */
export function renderLoop(currentTime)
{
  update(currentTime);

  render(gl, canvas, viewportMain, geometries);
  if (debugMode)
    render(gl, canvas, viewportDebug, geometriesDebug)
  requestAnimationFrame(renderLoop);
}
