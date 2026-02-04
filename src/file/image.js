'use strict'

/* GLOBAL VARIABLES */

const imagePath = '/textures/';

/**/

/**
 * Asynchronously loads an image.
 * @param {*} imageFileName name of the image file, must include suffix.
 * @returns Promise of the loaded image
 * NOTE: Images are cached by the browser automatically, hence no use of custom caching.
 */
// Inspired by:
// https://www.youtube.com/watch?v=0nZn5YPNf5k
export default async function loadImage(imageFileName)
{
  const image = new Image();
  // image.addEventListener('load', () => resolve(image));
  image.src = imagePath + imageFileName;

  return image;
}
