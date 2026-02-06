'use strict'

/**
 * Creates a WebGL RGBA 2D texture from a browser-loaded image.
 * @param {*} gl WebGL rendering context
 * @param {*} image Image object stored in the browser
 * @param {*} dimensions dimensions of the provided image
 * @returns WebGL 2D texture object
 */
export function create2DTexture(gl, image, dimensions)
{
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    dimensions.width,
    dimensions.height,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    image
  );

  return texture;
}

/**
 * Creates a WebGL 3D texture from DICOM volume data.
 * @param {*} gl WebGL rendering context
 * @param {*} volume volume data loaded from a DICOM file
 * @param {*} dimensions dimensions of provided volume
 * @returns WebGL 3D texture object
 */
export function createVolumeTexture(gl, volume, dimensions)
{
    const volumeTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_3D, volumeTexture);

    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);

    // ERROR: GL_INVALID_OPERATION: glGenerateMipmap: Texture format does not support mipmap generation.
    // gl.generateMipmap(gl.TEXTURE_3D);

    // gl.UNPACK_ALIGNMENT specifies the alignment requirements
    // for the start of each pixel row in memory. 1 == byte alignment
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

    gl.texImage3D(
      gl.TEXTURE_3D,
      0,
      gl.R16F,                 // internalFormat
      dimensions.cols,
      dimensions.rows,
      dimensions.depth,
      0,
      gl.RED,                  // format
      gl.FLOAT,                // type
      volume
    );
    
    // Also possible to use this (with gl.NEAREST):
    // gl.texImage3D(
    //   gl.TEXTURE_3D,
    //   0,
    //   gl.R16UI,             // internalFormat
    //   dimensions.cols,
    //   dimensions.rows,
    //   dimensions.depth,
    //   0,
    //   gl.RED_INTEGER,       // format
    //   gl.UNSIGNED_SHORT,    // type
    //   volume
    // );

    gl.bindTexture(gl.TEXTURE_3D, null);

    return volumeTexture;
}
