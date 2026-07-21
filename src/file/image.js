'use strict';

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
export async function loadImage(imageFileName)
{
  const image = new Image();
  // image.addEventListener('load', () => resolve(image));
  image.src = imagePath + imageFileName;

  return image;
}

export async function loadImagesCubeMap(imageFolderName, format)
{
  // NOTE: order of the faces was established by trial and error
  // The reason why it works with this order (and not rt, lf, up, dn, bk, ft)
  // is unknown to me
  const suffixes = ["ft", "bk", "up", "dn", "rt", "lf"];
  let images = [];

  await suffixes.forEach(async suffix =>
  {
    images.push(await loadImage(imageFolderName + "/" + imageFolderName + "_" + suffix + "." + format));
  });

  return images;
}
