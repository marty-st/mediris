'use strict'

const texturePath = '/textures/';
/**
 * Asynchronously loads an image
 * @param {*} textureFileName name of the texture file, must include suffix.
 * @returns Promise of the loaded image
 */
// Inspired by:
// https://www.youtube.com/watch?v=0nZn5YPNf5k
export default async function loadImage(textureFileName)
{
  const image = new Image();
  // image.addEventListener('load', () => resolve(image));
  image.src = texturePath + textureFileName;

  return image;
}
