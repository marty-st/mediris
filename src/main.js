'use strict'

import * as twgl from 'twgl.js';
import { Pane } from 'tweakpane.js';
import fetchShaderTexts from './file/shader.js';

/** @type {HTMLCanvasElement} */    // for VSCode to know that canvas is an HTML Canvas Element
let canvas = undefined;             // HTML <canvas> element 
let gl = undefined;                 // WebGL rendering context element
let program = undefined;            // Shader program 
let triangleVAO = undefined;
let bufferInfo = undefined;
let programInfo = undefined;

const shaderPath = '../../public/shaders/';
const pane = new Pane();

window.onload = async function init(){
  /* --------------------- */
  /* --UI INITIALIZATION-- */
  /* --------------------- */
  const PARAMS = {
    factor: 123,
    title: 'hello',
    color: '#ff0055',
  };

  pane.addBinding(PARAMS, 'factor');
  pane.addBinding(PARAMS, 'title');
  pane.addBinding(PARAMS, 'color');

  /* --------------------- */
  /* CANVAS INITIALIZATION */
  /* --------------------- */
  
  // get canvas element from HTML
  canvas = document.getElementById('webgl-canvas');
  if (!canvas) {
    alert('Cannot find WebGL canvas :(')
  }
  
  // create webgl rendering context
  gl = canvas.getContext('webgl2');
  if (!gl) {
    alert('WebGL2 is not supported!')
  }
  
  // set output resolution and viewport size 
  const pixelRatio = window.devicePixelRatio || 1;
  canvas.width = pixelRatio * canvas.clientWidth;
  canvas.height = pixelRatio * canvas.clientHeight;
  
  gl.clearColor(0.25,0.25,0.25,1.0); 
  
  /* --------------------- */
  /* SHADER INITIALIZATION */
  /* --------------------- */
  
  const { vertexShaderText, fragmentShaderText } = await fetchShaderTexts(shaderPath + 'basic.vert', shaderPath + 'basic.frag');

  program = gl.createProgram();

  const vertexShader = gl.createShader(gl.VERTEX_SHADER); 
  gl.shaderSource(vertexShader, vertexShaderText); 
  gl.compileShader(vertexShader); 
  gl.attachShader(program, vertexShader); 

  const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fragmentShader, fragmentShaderText);
  gl.compileShader(fragmentShader);
  gl.attachShader(program, fragmentShader);

  gl.linkProgram(program);

  programInfo = twgl.createProgramInfo(gl, [vertexShaderText, fragmentShaderText] );
  program = programInfo.program;

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.log(gl.getShaderInfoLog(vertexShader));
    console.log(gl.getShaderInfoLog(fragmentShader));
  }

  /* --------------------- */
  /* -DATA INITIALIZATION- */
  /* --------------------- */
  const bufferData = new Float32Array([
    -0.5,0,
    0,0.866,
    0.3,0,
  ])

  triangleVAO = gl.createVertexArray();
  gl.bindVertexArray(triangleVAO);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, bufferData, gl.STATIC_DRAW);

  const aPositionLoc = gl.getAttribLocation(program, "aPosition");

  gl.enableVertexAttribArray(aPositionLoc);

  gl.vertexAttribPointer(aPositionLoc, 2, gl.FLOAT, false, 2*4, 0);

  gl.bindVertexArray(null);

  let arrays = {
    position: { numComponents: 3, data: bufferData, },
  };

  // bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays);

  render();
}

function render() {
  gl.useProgram(program);
  
  gl.viewport(0, 0, canvas.width, canvas.height);

  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.bindVertexArray(triangleVAO);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  // twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo);
  // twgl.drawBufferInfo(gl, bufferInfo);
}
