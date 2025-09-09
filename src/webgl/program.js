'use strict'

import * as twgl from 'twgl.js';

import fetchShaderTexts from '../file/shader.js';

// Relative path to the shader folder
const shaderPath = '../../public/shaders/';

/**
 * 
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
 * 
 * @param {*} gl WebGL context
 * @param {*} vertexShaderName Name of file containing the vertex shader
 * @param {*} fragmentShaderName Name of file containing the fragment shader
 * @returns `programInfo` object, containing the program, uniform setters, and attribute setters
 * @description The names of shader files do not have to contain the file suffix, however, `.vert` and `.frag` 
 * suffixes are assumed automatically.
 * 
 * `fragmentShaderName` does NOT have to be specified if it shares its name with the vertex shader.
 */
export default async function createShaderProgram(gl, vertexShaderName, fragmentShaderName)
{
  const { 
    vertexShaderNameParsed, 
    fragmentShaderNameParsed 
  } = parseShaderNames(vertexShaderName, fragmentShaderName);

  const { 
    vertexShaderText, 
    fragmentShaderText 
  } = await fetchShaderTexts(shaderPath + vertexShaderNameParsed, shaderPath + fragmentShaderNameParsed);

  const programInfo = twgl.createProgramInfo(gl, [vertexShaderText, fragmentShaderText] );

  return programInfo;
}
