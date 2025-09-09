'use strict'

import * as twgl from 'twgl.js';

import { initDebugUI } from './ui/init.js';
import { initGLCanvas, initGLContext, initGLStates, setOutputResolution } from './webgl/init.js';
import createShaderProgram from './webgl/program.js';
import render from './webgl/render.js';

/** @type {HTMLCanvasElement} */    // for VSCode to know that canvas is an HTML Canvas Element
let canvas = undefined;             // HTML <canvas> element 
let gl = undefined;                 // WebGL rendering context element
let pane = undefined;               // Tweakpane rendering window

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

  /* --------------------- */
  /* -----RENDER LOOP----- */
  /* --------------------- */

  render(gl, canvas, geometries);
}
