'use strict'

import * as twgl from 'twgl.js';
import fetchShaderTexts from '../file/shader.js';

/* GLOBAL VARIABLES */

// Relative path to the shader folder
const shaderPath = '/shaders/';

/**/

/**
 * Adds suffixes '.vert' and '.frag' to provided file names if they're not already present.
 * Sets fragment shader name equal to the vertex shader if it is not provided, i.e. `undefined`.
 * @param {*} vertexShaderName Name of file containing the vertex shader
 * @param {*} fragmentShaderName Name of file containing the fragment shader
 * @returns `{ vertexShaderNameParsed, fragmentShaderNameParsed}` - an object
 * containing shader file names with their respective suffixes
 */
function parseShaderNames(vertexShaderName, fragmentShaderName)
{
  if (fragmentShaderName === undefined)
    fragmentShaderName = vertexShaderName;

  let vertexShaderNameParsed = vertexShaderName.includes('.') ? vertexShaderName : vertexShaderName + ".vert";
  let fragmentShaderNameParsed = fragmentShaderName.includes('.') ? fragmentShaderName : fragmentShaderName + ".frag";

  return { vertexShaderNameParsed, fragmentShaderNameParsed };
}

/**
 * Creates a linked shader program from provided text file names and returns it in a wrapper object used by twgl.js.
 * @param {*} gl WebGL context
 * @param {*} vertexShaderName Name of file containing the vertex shader
 * @param {*} fragmentShaderName Name of file containing the fragment shader
 * @param {*} useCache boolean determining whether to load and/or store text data from client-side browser cache 
 * @returns `programInfo` object, containing the program, uniform setters, and attribute setters
 * @description The names of shader files do not have to contain the file suffix, however, `.vert` and `.frag` 
 * suffixes are assumed automatically.
 * 
 * Additionaly `fragmentShaderName` does NOT need to be specified if it shares its name with the vertex shader.
 */
export default async function createShaderProgram(gl, vertexShaderName, fragmentShaderName, useCache = false)
{
  const { 
    vertexShaderNameParsed, 
    fragmentShaderNameParsed 
  } = parseShaderNames(vertexShaderName, fragmentShaderName);

  const { 
    vertexShaderText, 
    fragmentShaderText 
  } = await fetchShaderTexts(shaderPath + vertexShaderNameParsed, shaderPath + fragmentShaderNameParsed, useCache);

  const programInfo = twgl.createProgramInfo(gl, [vertexShaderText, fragmentShaderText] );

  return programInfo;
}
