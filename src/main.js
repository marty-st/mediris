'use strict'

import loadDicom from './file/dicom.js';
import { initDebugUI } from './ui/init.js';
import { initGLCanvas, initGLContext, initGLStates, setOutputResolution } from './webgl/init.js';
import createShaderProgram from './webgl/program.js';
import render from './webgl/render.js';
import { createVolumeTexture } from './webgl/texture.js';
import { createTriangleGeometry, createSliceGeometry, createVolumeGeometry } from './webgl/geometry.js';
import { initCamera } from './webgl/camera.js';

/* --------------------- */
/* --GLOBAL VARIABLES--- */
/* --------------------- */

/** @type {HTMLCanvasElement} */    // for VSCode to know that canvas is an HTML Canvas Element
let canvas = undefined;             // HTML <canvas> element 
let gl = undefined;                 // WebGL rendering context element
let pane = undefined;               // Tweakpane rendering window
let geometries = [];                // array of rendered objects

// Mediator object between Tweakpane and the rest of the application
let UIData = {
  slice: 1,
};

/* --------------------- */
/* ----FILE LOADING----- */
/* --------------------- */

// Load DICOM during module load
const imageDataPromise = loadDicom('CT WB w-contrast 5.0 B30s');

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

  const triangleProgramInfo = await createShaderProgram(gl, "basic");
  const sliceProgramInfo = await createShaderProgram(gl, "fsquad", "slice_texture");
  const volumeProgramInfo = await createShaderProgram(gl, "fsquad", "raytrace");

  /* --------------------- */
  /* -DATA INITIALIZATION- */
  /* --------------------- */

  const camera = initCamera(canvas);
  
  geometries.push(createTriangleGeometry(gl, triangleProgramInfo));
  
  /* --------------------- */
  /* -----RENDER LOAD----- */
  /* --------------------- */

  render(gl, canvas, geometries);

  // Asynchronously load DICOM to display later
  imageDataPromise.then((imageData) => {

    console.log("DICOM:", imageData);
    const dimensions = imageData.dimensions;
    const volume = imageData.volume;

    const volumeTexture = createVolumeTexture(gl, volume, dimensions);

    geometries.push(createSliceGeometry(gl, sliceProgramInfo, volumeTexture, dimensions, UIData));
    geometries.push(createVolumeGeometry(gl, volumeProgramInfo, volumeTexture, dimensions, UIData, camera));

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
function update()
{
  geometries[1].uniforms.u_slice_number = UIData.slice;
}

/**
 * Main render loop called via requestAnimationFrame(). 
 * Actual rendering is forwarded to the main render() function
 */
export function renderLoop()
{
  update();
  render(gl, canvas, geometries);
  requestAnimationFrame(renderLoop);
}
