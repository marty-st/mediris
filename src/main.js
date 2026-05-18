'use strict'

import loadDicom from './file/dicom.js';
import { euclideanDistanceTransform, interleaveVolumeAndEDT, interleaveVolumesWithResample } from './algo/image.js'
import { initDebugGUI, initGUIData } from './ui/gui.js';
import { initUI, control, resetControls } from './ui/manager.js';
import { initGLCanvas, initGLContext, initGLStates, setOutputResolution } from './webgl/init.js';
import createShaderProgram from './webgl/program.js';
import { createSceneEmpty, createSceneRaycast } from './webgl/scene.js';
import render from './webgl/render.js';
import { create2DTexture, createCubeMapTexture, createVolumeTexture } from './webgl/texture.js';
import { createVolumeGeometry, createFullScreenGeometry } from './webgl/geometry.js';
import { initCamera } from './webgl/camera.js';
import { loadImage, loadImagesCubeMap } from './file/image.js';
import { initAppData } from './app/data.js';
import { updateApp } from './app/manager.js';

/* CONSTANTS */

const CACHE = true;
const NO_CACHE = false;

/**/

/* GLOBAL VARIABLES */

// Application data
const appData = initAppData();

// Wrapper object for the UI controls & GUI, managed by the UI manager
let UI = undefined;

// Shader program file names
const loadingScreenShaderNames = {vert: "fsquad", frag: "fstexture"};
const mainShaderNames = {vert: "fsquad", frag: "raytrace"};

// FILE PRELOAD
// Load DICOM during module load
const folderNameCT = 'CT WB w-contrast 5.0 B30s';
const folderNamePET = 'PET WB';
const imageDataCTPromise = loadDicom(folderNameCT, CACHE);
const imageDataPETPromise = loadDicom(folderNamePET, CACHE);
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
  Promise.all([imageDataCTPromise, imageDataPETPromise]).then(async([imageDataCT, imageDataPET]) => {
    const dimensions = imageDataCT.dimensions;

    const squaredEuclideanDistanceToNonAir = await euclideanDistanceTransform(imageDataCT.volume, imageDataCT.dimensions, imageDataCT.spacing, 50);

    const interleavedVolumes = await interleaveVolumesWithResample(
      imageDataCT.volume, 
      imageDataPET.volume, 
      imageDataCT.dimensions, 
      imageDataPET.dimensions,
      imageDataCT.origin,
      imageDataPET.origin,
      imageDataCT.spacing,
      imageDataPET.spacing,
      folderNameCT + folderNamePET,
      CACHE,
      Float32Array
    )

    console.log(squaredEuclideanDistanceToNonAir);

    const interleavedData = interleaveVolumeAndEDT(interleavedVolumes, squaredEuclideanDistanceToNonAir);

    const volumeTexture = createVolumeTexture(gl, interleavedData, dimensions, 3);

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
