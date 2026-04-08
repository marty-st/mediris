'use strict'

import loadDicom from './file/dicom.js';
import { initDebugGUI, initGUIData } from './ui/gui.js';
import { initUI, control, resetControls } from './ui/manager.js';
import { initGLCanvas, initGLContext, initGLStates, setOutputResolution } from './webgl/init.js';
import createShaderProgram from './webgl/program.js';
import { createSceneEmpty, createSceneRaycast } from './webgl/scene.js';
import render from './webgl/render.js';
import { create2DTexture, createCubeMapTexture, createVolumeTexture } from './webgl/texture.js';
import { createVolumeGeometry, createLoadingScreenGeometry } from './webgl/geometry.js';
import { initCamera } from './webgl/camera.js';
import { loadImage, loadImagesCubeMap } from './file/image.js';
import { initAppData } from './app/data.js';
import { updateApp } from './app/manager.js';

/* CONSTANTS */

const CACHE = true;
const NO_CACHE = false;

/**/

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
  boneCortical: { min: -440 + C, max: 1900 + C }, // USE min: -440 for skin layer, 350 for the bone

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
      enabled: true,
    },
    fillLight: {
      position: {x: 1, y: 0.75, z: 0},
      intensity: 0.5,
      enabled: true,
    },
    backLight: {
      position: {x: 0, y: 1, z: 1},
      intensity: 0.25,
      enabled: true,
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
      u_mode: 1, // 0 = Volume Data, 1 = Debug Sphere
    },
    rayTracing: {
      u_step_size: 0.0025,
      u_gradient_delta: 0.0025,
      u_curvature_delta_multiplier: 4.0,
      u_shading_model: 0, // 0 = Stylized, 1 = Disney, 2 = Blinn-Phong, 3 = Lambert, 4 = normal, 5 = position, 6 = cubemap
    },
    shadingModel: {
      stylized: {
        u_alpha: 0.0,
        u_tau: 0.0,
        u_lambda: 0.0,
        u_mu: 0.4,
        u_chi: 0.2,
        u_beta: 0,
        u_gamma: 1,
      },
      disney: {
        // diffuse model
        u_roughness: 0.5,
        u_subsurface: 0.0,
        u_sheen: 0.0,
        u_sheen_tint: 0.5,
        // specular model
        u_specular: 0.5,
        u_specular_tint: 0.0,
        u_anisotropic: 0.0,
        u_metallic: 0.0,
        u_clearcoat: 0.0,
        u_clearcoat_gloss: 1.0,
      },
      blinnPhong: {
        u_shininess: 100.0,
      },
      lambert: {},
      normal: {},
      position: {},
      cubemap: {},
    },
  },
}

// Application data
const appData = initAppData(settings, environment, tf);

// Wrapper object for the UI controls & GUI, managed by the UI manager
let UI = undefined;

// Shader program file names
const loadingScreenShaderNames = {vert: "fsquad", frag: "fstexture"};
const mainShaderNames = {vert: "fsquad", frag: "raytrace"};

// FILE PRELOAD
// Load DICOM during module load
const imageDataPromise = loadDicom('CT WB w-contrast 5.0 B30s', CACHE);
// Load images for texture use
const loadingScreenImagePromise = loadImage('loading.png');
const cubeMapImagesPromise = loadImagesCubeMap("frozendusk", "jpg");
const lightMapImagesPromise = loadImagesCubeMap("greyscalegorilla_abstract26", "png");
const materialImagePromise = loadImage('Stylized_Water_001_basecolor.png');

/**/

// Define WebGL window initialization
window.onload = async function init()
{
  /* --------------------- */
  /* CANVAS INITIALIZATION */
  /* --------------------- */
  
  /** @type {HTMLCanvasElement} */      // for VSCode to know that canvas is an HTML Canvas Element
  const canvas = initGLCanvas();        // HTML <canvas> element 
  setOutputResolution(canvas);
  
  const gl = initGLContext(canvas);     // WebGL rendering context element
  initGLStates(gl);
  
  /* --------------------- */
  /* UI INITIALIZATION --- */
  /* --------------------- */

  const GUIData = initGUIData(appData); // Mediator object between Tweakpane and the rest of the application
  const pane = initDebugGUI(GUIData);   // Tweakpane rendering window
  UI = initUI(canvas, GUIData);

  /* --------------------- */
  /* SHADER INITIALIZATION */
  /* --------------------- */

  const loadingScreenProgramInfo = await createShaderProgram(gl, loadingScreenShaderNames.vert, loadingScreenShaderNames.frag, NO_CACHE);
  const volumeProgramInfo = await createShaderProgram(gl, mainShaderNames.vert, mainShaderNames.frag, NO_CACHE);

  /* --------------------- */
  /* DATA INITIALIZATION - */
  /* --------------------- */

  appData.context = {canvas, gl, pane};

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
  });

  let cubeMapTexture;
  cubeMapImagesPromise.then((cubeMapImages) => {
    cubeMapTexture = createCubeMapTexture(gl, cubeMapImages, { width: 512, height: 512 });
  });

  let areaLightTexture;
  lightMapImagesPromise.then((areaLightImages) => {
    areaLightTexture = createCubeMapTexture(gl, areaLightImages, { width: 1024, height: 1024 });
  });

  let materialTexture;
  materialImagePromise.then((materialImage) => {
    materialTexture = create2DTexture(gl, materialImage, { width: 4096, height: 4096 });
  });

  // Asynchronously load DICOM to display later
  imageDataPromise.then((imageData) => {

    const dimensions = imageData.dimensions;
    const volume = imageData.volume;

    const volumeTexture = createVolumeTexture(gl, volume, dimensions);

    appData.environment.scene.geometries.push(createVolumeGeometry(gl, volumeProgramInfo, mainShaderNames, volumeTexture, materialTexture, cubeMapTexture, dimensions, appData));

    /* --------------------- */
    /* RENDER LOOP --------- */
    /* --------------------- */
    
    // start render loop with the volume geometry loaded
    this.requestAnimationFrame(renderLoop);
  });
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
  UI.GUIData.framesPerSecond = time.delta > 0.0 ? 1.0 / time.delta : 0.0;
  
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

  render(appData.context.gl, appData.context.canvas, appData.environment.viewport, appData.environment.scene, appData.environment.scene.geometries);

  requestAnimationFrame(renderLoop);
}
