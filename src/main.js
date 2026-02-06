'use strict'

import * as twgl from 'twgl.js';
import loadDicom from './file/dicom.js';
import { initDebugUI, initUIData } from './ui/init.js';
import { initGLCanvas, initGLContext, initGLStates, setOutputResolution } from './webgl/init.js';
import createShaderProgram from './webgl/program.js';
import { createSceneEmpty, createSceneRaycast } from './webgl/scene.js';
import render from './webgl/render.js';
import { create2DTexture, createVolumeTexture } from './webgl/texture.js';
import { createVolumeGeometry, createLoadingScreenGeometry, createSphereGeometry } from './webgl/geometry.js';
import { updateCamera, initCamera } from './webgl/camera.js';
import loadImage from './file/image.js';
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
} from './ui/controls.js';

/* GLOBAL VARIABLES */

/** @type {HTMLCanvasElement} */    // for VSCode to know that canvas is an HTML Canvas Element
let canvas = undefined;             // HTML <canvas> element 
let gl = undefined;                 // WebGL rendering context element
let pane = undefined;               // Tweakpane rendering window
let sceneEmpty = undefined;         // Object with empty settings for scenes with no additional spec
let sceneRaycast = undefined;       // object with raycast scene settings
let geometries = [];                // array of rendered objects
let viewportMain = undefined;       // main viewport position and dimensions

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

// Mediator object between Tweakpane and the rest of the application
let UIData = initUIData(tf, lights);

// Object for user control
let mouse = undefined;
let keyboard = undefined;
let camera = undefined;
let cameraControls = undefined;
let appControls = undefined;

// Elapsed time helper variable
let previousTime = 0;

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
  /* UI INITIALIZATION --- */
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

  const useCachedShaderText = false;

  const loadingScreenProgramInfo = await createShaderProgram(gl, "fsquad", "fstexture", useCachedShaderText);
  const volumeProgramInfo = await createShaderProgram(gl, "fsquad", "raytrace", useCachedShaderText);
  const sphereProgramInfo = await createShaderProgram(gl, "fsquad", "sphere", useCachedShaderText);

  /* --------------------- */
  /* DATA INITIALIZATION - */
  /* --------------------- */

  viewportMain = {
    leftX: 0,
    bottomY: UIData.mode == 2 ? canvas.height * 0.5 : 0,
    width: canvas.width,
    height: UIData.mode == 2 ? canvas.height * 0.5 : canvas.height,
  };

  mouse = initMouseControls(canvas);
  keyboard = initKeyboardControls();
  camera = initCamera(viewportMain);
  cameraControls = initCameraControls();
  appControls = initAppControls();
  sceneEmpty = createSceneEmpty();
  sceneRaycast = createSceneRaycast(gl, volumeProgramInfo, camera, UIData);

  loadingScreenImagePromise.then((loadingScreenImage) =>{
    const loadingScreenTexture = create2DTexture(gl, loadingScreenImage, { width: 1920, height: 1080 });
    geometries.push(createLoadingScreenGeometry(gl, loadingScreenProgramInfo, loadingScreenTexture));

    /* --------------------- */
    /* RENDER LOAD SCREEN -- */
    /* --------------------- */

    render(gl, canvas, viewportMain, sceneEmpty, geometries);
  })

  // Asynchronously load DICOM to display later
  imageDataPromise.then((imageData) => {

    console.log("DICOM:", imageData);
    const dimensions = imageData.dimensions;
    const volume = imageData.volume;

    const volumeTexture = createVolumeTexture(gl, volume, dimensions);

    // Remove loading screen
    geometries.pop();

    geometries.push(createVolumeGeometry(gl, volumeProgramInfo, volumeTexture, dimensions, UIData));
    geometries.push(createSphereGeometry(gl, sphereProgramInfo, UIData));

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
  // NOTE: Temporary manual solution, should be possible to make each geometry take care of its own shader
  // TODO: refactor
  const shaderName = UIData.mode == 0 ? "raytrace" : "sphere";
  const geometry = geometries[UIData.mode];

  geometry.programInfo = await createShaderProgram(gl, "fsquad", shaderName, false);

  if (geometry.uniformBlock)
  {
    const blockName = geometry.uniformBlock.info.name;
    geometry.uniformBlock.info = twgl.createUniformBlockInfo(gl, geometry.programInfo, blockName);
    
  }

  if (UIData.mode == 0 && sceneRaycast.uniformBlock)
  {
    const blockName = sceneRaycast.uniformBlock.info.name;
    sceneRaycast.uniformBlock.info = twgl.createUniformBlockInfo(gl, geometry.programInfo, blockName);
  }


  console.log("Reloaded shaders");
}

/**
 * Updates the application environment based on user input.
 */
function updateApp()
{
  if (appControls.reloadShaders)
    reloadShaders();

  // if (appControls.reloadDicom)
    // use loadDicom(folder, useCache = false); 
}

/**
 * Updates variables and object states fpr each frame throughout the render loop.
 * @param currentTime current application time in ms
 */
function update(currentTime)
{
  const timeDelta = 0.001 * (currentTime - previousTime);

  // FPS Counter
  UIData.framesPerSecond = timeDelta > 0.0 ? 1.0 / timeDelta : 0.0;

  // Shading model GUI updates
  sceneRaycast.uniforms.u_step_size = UIData.stepSize;
  sceneRaycast.uniforms.u_default_step_size = UIData.defaultStepSize;
  sceneRaycast.uniforms.u_shading_model = UIData.shadingModel;
  sceneRaycast.uniforms.u_roughness = UIData.roughness;
  sceneRaycast.uniforms.u_subsurface = UIData.subsurface;
  sceneRaycast.uniforms.u_sheen = UIData.sheen;
  sceneRaycast.uniforms.u_sheen_tint = UIData.sheenTint;

  // Light properties GUI updates
  let i = 0;
  for (const key in UIData.lights)
  {
    sceneRaycast.uniformBlock.uniforms.lights_array[i].intensity = UIData.lights[key].intensity;
    ++i;
  }
  
  // User controls
  controlCamera(mouse, keyboard, cameraControls);
  updateCamera(camera, cameraControls, viewportMain, timeDelta);
  controlApp(keyboard, appControls);
  updateApp();

  // Reset controls for next frame
  resetMouseControls(mouse);
  resetKeyboardControls(keyboard);
  resetCameraControls(cameraControls);
  resetAppControls(appControls);

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

  render(gl, canvas, viewportMain, sceneRaycast, geometries.slice(UIData.mode, UIData.mode + 1));

  requestAnimationFrame(renderLoop);
}
