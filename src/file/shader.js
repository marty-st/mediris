'use strict'

import { getCache, setCache } from './cache';

// Name of the database used for caching
const DATABASE_NAME = "shaderTextCache";
//
const DATABASE_VERSION = 1;
//
const KEY_TYPE = "shaderPaths";
// 
const STORE_NAME = "text";

/**
 * Code by: 
 * David Banks
 * from:
 * https://medium.com/@banksysan_10088/webgl-external-glsl-files-dd7cf85f9ee9
 * 
 * Fetch the fragment and vertex shader text from external files.
 * @param vertexShaderPath
 * @param fragmentShaderPath
 * @param {*} useCache boolean determining whether to load and/or store text data from client-side browser cache 
 * @returns {Promise<{vertexShaderText: string | null, fragmentShaderText: string | null}>}
 */
export default async function fetchShaderTexts(vertexShaderPath, fragmentShaderPath, useCache) {
  if (useCache)
  {
    const cache = await getCache(DATABASE_NAME, KEY_TYPE, vertexShaderPath + fragmentShaderPath, STORE_NAME);
    if (cache)
      return cache;
  }

  const shaderTexts = {
    vertexShaderText: null,
    fragmentShaderText: null,
  };

  let errors = [];
  await Promise.all([
    fetch(vertexShaderPath)
      .catch((e) => {
          errors.push(e);
        })
      .then(async (response) => {
        if (response.status === 200) {
          shaderTexts.vertexShaderText = await response.text();
        } else {
          errors.push(
            `Non-200 response for ${vertexShaderPath}.  ${response.status}:  ${response.statusText}`
          );
        }
      }),

    fetch(fragmentShaderPath)
      .catch((e) => errors.push(e))
      .then(async (response) => {
        if (response.status === 200) {
          shaderTexts.fragmentShaderText = await response.text();
        } else {
          errors.push(
            `Non-200 response for ${fragmentShaderPath}.  ${response.status}:  ${response.statusText}`
          );
        }
      }),
  ]);

  if (errors.length !== 0) {
    throw new Error(
      `Failed to fetch shader(s):\n${JSON.stringify(errors, (key, value) => {
        if (value?.constructor.name === 'Error') {
          return {
            name: value.name,
            message: value.message,
            stack: value.stack,
            cause: value.cause,
          };
        }
        return value;
      }, 2)}`
    );
  }

  await setCache(DATABASE_NAME, DATABASE_VERSION, KEY_TYPE, vertexShaderPath + fragmentShaderPath, STORE_NAME, shaderTexts);
  
  return shaderTexts;
}

// Simple alternative:
// async function loadShader(url) {
//   const response = await fetch(url);
//   return await response.text();
// }

// async function initShaders(vertexShaderPath, fragmentShaderPath) {
//   vsSource = await loadShader(vertexShaderPath);
//   fsSource = await loadShader(fragmentShaderPath);
// }
