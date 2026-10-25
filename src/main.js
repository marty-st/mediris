'use strict';

import loadDicom from './file/dicom.js';
import { blurVolume, euclideanDistanceTransform, interleaveVolumeArrays, resampleVolumePET } from './algo/image.js';
import { initDebugGUI, initGUIData, resetGUIState } from './ui/gui.js';
import { initUI, control, resetControls } from './ui/manager.js';
import { initGLCanvas, initGLContext, initGLStates, setOutputResolution } from './webgl/init.js';
import createShaderProgram from './webgl/program.js';
import { createSceneEmpty, createSceneRaycast } from './webgl/scene.js';
import render from './webgl/render.js';
import { create2DTexture, createVolumeTexture, createFramebufferTexture, createFramebuffer } from './webgl/texture.js';
import { createVolumeGeometry, createFullScreenGeometry } from './webgl/geometry.js';
import { initCamera } from './webgl/camera.js';
import { loadImage } from './file/image.js';
import { initAppData } from './app/data.js';
import { updateApp, updateAppPostFrame } from './app/manager.js';

/* CONSTANTS */

const CACHE = true;
const NO_CACHE = false;

/**/

/* GLOBAL VARIABLES */

// Application data
const appData = initAppData();

let sceneEmpty = undefined;
let idleGeometries = undefined;
let raytraceShellFrameBuffer = undefined;
let raytracePETFrameBuffer = undefined;
let raytraceBoneFrameBuffer = undefined;
let shadeShellFrameBuffer = undefined;
let shadePETFrameBuffer = undefined;
let shadeBoneFrameBuffer = undefined;
let blendFrameBuffer = undefined;

// Wrapper object for the UI controls & GUI, managed by the UI manager
let UI = undefined;

// Shader program file names
const loadingScreenShaderNames = { vert: "fsquad", frag: "fstexture" };
const idleShaderNames = { vert: "fsquad", frag: "fstexture" };
const raytraceShaderNames = { vert: "fsquad", frag: "raytrace" };
const shadeShaderNames = { vert: "fsquad", frag: "shade" };
const blendShaderNames = { vert: "fsquad", frag: "blend" };

// FILE PRELOAD
// Load DICOM during module load
const folderNameCT = 'CT WB w-contrast 5.0 B30s';
const folderNamePET = 'PET WB';
const imageDataCTPromise = loadDicom(folderNameCT, CACHE);
const imageDataPETPromise = loadDicom(folderNamePET, CACHE);
// Load images for texture use
const loadingScreenImagePromise = loadImage('loading.png');

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
  const idleShaderProgramInfo = await createShaderProgram(gl, idleShaderNames.vert, idleShaderNames.frag, NO_CACHE);
  const raytraceProgramInfo = await createShaderProgram(gl, raytraceShaderNames.vert, raytraceShaderNames.frag, NO_CACHE);
  const shadeProgramInfo = await createShaderProgram(gl, shadeShaderNames.vert, shadeShaderNames.frag, NO_CACHE);
  const blendProgramInfo = await createShaderProgram(gl, blendShaderNames.vert, blendShaderNames.frag, NO_CACHE);

  /* --------------------- */
  /* DATA INITIALIZATION - */
  /* --------------------- */

  appData.context = { canvas, gl, pane };

  appData.environment.viewport = {
    leftX: 0,
    bottomY: 0,
    width: canvas.width,
    height: canvas.height,
  };

  appData.environment.camera = initCamera(appData.environment.viewport);

  sceneEmpty = createSceneEmpty();
  const sceneRaycast = createSceneRaycast(appData.settings.uniforms, appData.environment);
  appData.environment.scene = sceneRaycast;

  loadingScreenImagePromise.then(loadingScreenImage =>
  {
    const loadingScreenTexture = create2DTexture(gl, loadingScreenImage, { width: 1920, height: 1080 });

    const loadingScreenGeometry = createFullScreenGeometry(
      gl,
      loadingScreenProgramInfo,
      loadingScreenShaderNames,
      loadingScreenTexture
    );

    /* --------------------- */
    /* RENDER LOAD SCREEN -- */
    /* --------------------- */

    render(gl, canvas, appData.environment.viewport, sceneEmpty, [loadingScreenGeometry]);
  });

  const blendTexture = createFramebufferTexture(gl, { width: canvas.width, height: canvas.height }, "rgba");
  const colorTextureShell = createFramebufferTexture(gl, { width: canvas.width, height: canvas.height }, "rgba");
  const colorTexturePET = createFramebufferTexture(gl, { width: canvas.width, height: canvas.height }, "rgba");
  const colorTextureBone = createFramebufferTexture(gl, { width: canvas.width, height: canvas.height }, "rgba");
  const depthTexture = createFramebufferTexture(gl, { width: canvas.width, height: canvas.height }, "depth");
  const samplePointTextureShell = createFramebufferTexture(gl, { width: canvas.width, height: canvas.height }, "float");
  const samplePointTexturePET = createFramebufferTexture(gl, { width: canvas.width, height: canvas.height }, "float");
  const samplePointTextureBone = createFramebufferTexture(gl, { width: canvas.width, height: canvas.height }, "float");
  const heatmapTextureShell = createFramebufferTexture(gl, { width: canvas.width, height: canvas.height }, "rgba");
  const heatmapTexturePET = createFramebufferTexture(gl, { width: canvas.width, height: canvas.height }, "rgba");
  const heatmapTextureBone = createFramebufferTexture(gl, { width: canvas.width, height: canvas.height }, "rgba");

  raytraceShellFrameBuffer = createFramebuffer(gl, { color: [samplePointTextureShell, heatmapTextureShell], depth: depthTexture });
  raytracePETFrameBuffer = createFramebuffer(gl, { color: [samplePointTexturePET, heatmapTexturePET], depth: depthTexture });
  raytraceBoneFrameBuffer = createFramebuffer(gl, { color: [samplePointTextureBone, heatmapTextureBone], depth: depthTexture });
  shadeShellFrameBuffer = createFramebuffer(gl, { color: [colorTextureShell], depth: depthTexture });
  shadePETFrameBuffer = createFramebuffer(gl, { color: [colorTexturePET], depth: depthTexture });
  shadeBoneFrameBuffer = createFramebuffer(gl, { color: [colorTextureBone], depth: depthTexture });
  blendFrameBuffer = createFramebuffer(gl, { color: [blendTexture], depth: depthTexture });

  idleGeometries = [
    createFullScreenGeometry(
      gl,
      idleShaderProgramInfo,
      idleShaderNames,
      blendTexture
    ),
    createFullScreenGeometry(
      gl,
      idleShaderProgramInfo,
      idleShaderNames,
      heatmapTextureShell
    ),
    createFullScreenGeometry(
      gl,
      idleShaderProgramInfo,
      idleShaderNames,
      heatmapTexturePET
    ),
    createFullScreenGeometry(
      gl,
      idleShaderProgramInfo,
      idleShaderNames,
      heatmapTextureBone
    ),
  ];

  // Asynchronously load DICOM to display later
  Promise.all([imageDataCTPromise, imageDataPETPromise]).then(async ([imageDataCT, imageDataPET]) =>
  {
    // NOTE: Consider using Web Workers
    // See: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers

    const blurredVolumeCTPromise = blurVolume(
      imageDataCT.name,
      imageDataCT.volume,
      imageDataCT.dimensions,
      10,
      CACHE
    );

    const resampledVolumePETPromise = resampleVolumePET(
      imageDataPET.volume,
      imageDataCT.dimensions,
      imageDataPET.dimensions,
      imageDataCT.origin,
      imageDataPET.origin,
      imageDataCT.spacing,
      imageDataPET.spacing,
      folderNameCT + folderNamePET,
      CACHE,
      Uint16Array
    );

    const squaredEuclideanDistanceToNonAirCTPromise =
      blurredVolumeCTPromise
        .then(blurredVolumeCT => euclideanDistanceTransform(
          imageDataCT.name + " shell",
          blurredVolumeCT,
          imageDataCT.dimensions,
          appData.environment.volumeMedia.bodyShell.transferFunction.interval.min,
          CACHE
        ));

    const squaredEuclideanDistanceToNonAirPETPromise =
      resampledVolumePETPromise
        .then(resampledVolumePET => euclideanDistanceTransform(
          imageDataPET.name,
          resampledVolumePET,
          imageDataCT.dimensions,
          appData.environment.volumeMedia.pet.transferFunction.interval.min,
          CACHE
        ));
    const squaredEuclideanDistanceToBonePromise =
      blurredVolumeCTPromise
        .then(blurredVolumeCT => euclideanDistanceTransform(
          imageDataCT.name + " bone",
          blurredVolumeCT,
          imageDataCT.dimensions,
          appData.environment.volumeMedia.bone.transferFunction.interval.min,
          CACHE
        ));

    const [
      blurredVolumeCT,
      resampledVolumePET,
      squaredEuclideanDistanceToNonAirCT,
      squaredEuclideanDistanceToNonAirPET,
      squaredEuclideanDistanceToBone,
    ] = await Promise.all([
      blurredVolumeCTPromise,
      resampledVolumePETPromise,
      squaredEuclideanDistanceToNonAirCTPromise,
      squaredEuclideanDistanceToNonAirPETPromise,
      squaredEuclideanDistanceToBonePromise,
    ]);

    const interleavedVolumesCT = interleaveVolumeArrays(
      blurredVolumeCT,
      squaredEuclideanDistanceToNonAirCT
    );

    const interleavedVolumesPET = interleaveVolumeArrays(
      resampledVolumePET,
      squaredEuclideanDistanceToNonAirPET
    );

    const interleavedVolumesBone = interleaveVolumeArrays(
      blurredVolumeCT,
      squaredEuclideanDistanceToBone
    );

    const volumeTextureShell = createVolumeTexture(gl, interleavedVolumesCT, imageDataCT.dimensions, 2);
    const volumeTexturePET = createVolumeTexture(gl, interleavedVolumesPET, imageDataCT.dimensions, 2);
    const volumeTextureBone = createVolumeTexture(gl, interleavedVolumesBone, imageDataCT.dimensions, 2);

    appData.environment.scene.geometries.push(createVolumeGeometry(
      gl,
      {
        raytraceShell: {
          shaderProgramInfo: raytraceProgramInfo,
          shaderFileNames: raytraceShaderNames,
          frameBuffer: raytraceShellFrameBuffer,
          textureUniforms: { volumeTextureShell, samplePointTexturePET },
        },
        raytracePET: {
          shaderProgramInfo: raytraceProgramInfo,
          shaderFileNames: raytraceShaderNames,
          frameBuffer: raytracePETFrameBuffer,
          textureUniforms: { volumeTexturePET },
        },
        raytraceBone: {
          shaderProgramInfo: raytraceProgramInfo,
          shaderFileNames: raytraceShaderNames,
          frameBuffer: raytraceBoneFrameBuffer,
          textureUniforms: { volumeTextureBone, samplePointTexturePET },
        },
        shadeShell: {
          shaderProgramInfo: shadeProgramInfo,
          shaderFileNames: shadeShaderNames,
          frameBuffer: shadeShellFrameBuffer,
          textureUniforms: { volumeTextureShell, samplePointTextureShell },
        },
        shadePET: {
          shaderProgramInfo: shadeProgramInfo,
          shaderFileNames: shadeShaderNames,
          frameBuffer: shadePETFrameBuffer,
          textureUniforms: { volumeTexturePET, samplePointTexturePET },
        },
        shadeBone: {
          shaderProgramInfo: shadeProgramInfo,
          shaderFileNames: shadeShaderNames,
          frameBuffer: shadeBoneFrameBuffer,
          textureUniforms: { volumeTextureBone, samplePointTextureBone },
        },
        blend: {
          shaderProgramInfo: blendProgramInfo,
          shaderFileNames: blendShaderNames,
          frameBuffer: blendFrameBuffer,
          textureUniforms: { colorTextureShell, colorTexturePET, colorTextureBone },
        },
      },
      appData.environment.volumeMedia
    ));

    /* --------------------- */
    /* RENDER LOOP --------- */
    /* --------------------- */

    // start render loop with the volume geometry loaded
    console.log("Render Loop Ready.");
    this.requestAnimationFrame(renderLoop);
  });
};

/**
 * Updates variables and object states for each frame throughout the render loop.
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

  time.previous = time.current;
}

/**
 * Updates (resets) object states after a frame has been rendered to prepare for a new frame.
 * Some rendering relies on pre-reset states.
 */
function updatePostFrame()
{
  resetControls(UI);
  resetGUIState(UI.GUIData);
  updateAppPostFrame(appData);
}

/**
 * Main render loop called via requestAnimationFrame().
 * Actual rendering is forwarded to the main render() function.
 * @param {*} currentTime current application time in ms
 */
function renderLoop(currentTime)
{
  update(currentTime);

  const context = appData.context;
  const environment = appData.environment;

  // Prepare idle framebuffer - fully render the scene
  if (!environment.state.idleRender)
  {
    render(context.gl, context.canvas, environment.viewport, environment.scene, environment.scene.geometries);
  }

  // Idle render
  const output = appData.settings.uniforms.debug.u_output.value;
  render(context.gl, context.canvas, environment.viewport, sceneEmpty, idleGeometries.slice(output, output + 1));

  // State reset
  updatePostFrame();

  requestAnimationFrame(renderLoop);
}
