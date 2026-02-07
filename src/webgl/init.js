'use strict'

import * as twgl from 'twgl.js';

/**
 * Initializes WebGL canvas.
 * @returns `canvas` - HTML element
 */
export function initGLCanvas()
{
  let canvas = document.getElementById('webgl-canvas');

  if (!canvas)
    alert('Cannot find WebGL canvas :(')

  return canvas;
}

/**
 * Initializes WebGL2 context.
 * @param {*} canvas HTML canvas element
 * @returns `gl` - WebGL rendering context
 */
export function initGLContext(canvas)
{
  let gl = canvas.getContext('webgl2');

  if (!gl) 
    alert('WebGL2 is not supported!')

  return gl;
}

/**
 * Sets the output resolution (resolution of the drawing buffer), accounts for resolution scaling
 * @param {*} canvas HTML canvas element
 */
export function setOutputResolution(canvas)
{
  const pixelRatio = window.devicePixelRatio || 1;
  canvas.width = pixelRatio * canvas.clientWidth;
  canvas.height = pixelRatio * canvas.clientHeight;
}

/**
 * Initializes global WebGL states related to drawing
 * @param {*} gl WebGL rendering context
 */
export function initGLStates(gl)
{
  gl.clearColor(0.25,0.25,0.25,1.0);
  gl.enable(gl.SCISSOR_TEST);

  twgl.setDefaults({
      attribPrefix: "i_",
    }
  );
}
