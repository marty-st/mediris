'use strict'

import * as twgl from 'twgl.js';

import loadDicom from './file/dicom.js';
import { initDebugUI } from './ui/init.js';
import { initGLCanvas, initGLContext, initGLStates, setOutputResolution } from './webgl/init.js';
import createShaderProgram from './webgl/program.js';
import render from './webgl/render.js';

/* --------------------- */
/* --GLOBAL VARIABLES--- */
/* --------------------- */

/** @type {HTMLCanvasElement} */    // for VSCode to know that canvas is an HTML Canvas Element
let canvas = undefined;             // HTML <canvas> element 
let gl = undefined;                 // WebGL rendering context element
let pane = undefined;               // Tweakpane rendering window
let volumeTexture = null;

/* --------------------- */
/* ----FILE LOADING----- */
/* --------------------- */

// Load DICOM during module load
const imageDataPromise = loadDicom('CT WB w-contrast 5.0 B30s');

window.onload = async function init()
{
  /* --------------------- */
  /* --UI INITIALIZATION-- */
  /* --------------------- */

  pane = initDebugUI();

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

  const programInfo = await createShaderProgram(gl, "basic");

  /* --------------------- */
  /* -DATA INITIALIZATION- */
  /* --------------------- */

  const triangleArrays = {
     position: { numComponents: 2, data: [-0.5, 0, 0, 0.866, 0.3, 0], },
  };

  const triangleBufferInfo = twgl.createBufferInfoFromArrays(gl, triangleArrays);
  const triangleVAO = twgl.createVAOFromBufferInfo(gl, programInfo, triangleBufferInfo);

  const geometries = [ {bufferInfo: triangleBufferInfo, vao: triangleVAO, programInfo: programInfo} ];

  // Asynchronously load DICOM to display later
  imageDataPromise.then((imageData) => {

  console.log("DICOM:", imageData);
  const dimensions = imageData.dimensions;
  const volume = imageData.volume;

  // Example: upload 3D texture (unsigned 16-bit)
  volumeTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_3D, volumeTexture);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

  

  // Choose formats based on bit depth and signedness (example: unsigned 16)
  gl.texImage3D(
    gl.TEXTURE_3D,
    0,
    gl.R16UI,             // internalFormat
    dimensions.cols,
    dimensions.rows,
    dimensions.depth,
    0,
    gl.RED_INTEGER,       // format
    gl.UNSIGNED_SHORT,    // type
    volume
  );

  })
  
  /* --------------------- */
  /* -----RENDER LOOP----- */
  /* --------------------- */

  // TODO: render texture data
  render(gl, canvas, geometries);
}
