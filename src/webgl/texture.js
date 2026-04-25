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
 * @param {*} channels number of channels to use for interleaved textures [1, 4]
 * @returns WebGL 3D texture object
 */
export function createVolumeTexture(gl, volume, dimensions, channels)
{
    const volumeTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_3D, volumeTexture);

    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);

    let internalFormat;
    let format;
    switch(channels)
    {
      case 1:
        internalFormat = gl.R16F;
        format = gl.RED;
        break;
      case 2:
        internalFormat = gl.RG16F;
        format = gl.RG;
        break;
      case 3:
        internalFormat = gl.RGB16F;
        format = gl.RGB;
        break;
      case 4:
        internalFormat = gl.RGBA16F;
        format = gl.RGBA;
        break;
      default:
        throw new Error("Volume texture: Invalid number of color channels.");
    }

    // ERROR: GL_INVALID_OPERATION: glGenerateMipmap: Texture format does not support mipmap generation.
    // gl.generateMipmap(gl.TEXTURE_3D);

    // gl.UNPACK_ALIGNMENT specifies the alignment requirements
    // for the start of each pixel row in memory. 1 == byte alignment
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

    gl.texImage3D(
      gl.TEXTURE_3D,
      0,
      internalFormat,                 // internalFormat
      dimensions.cols,
      dimensions.rows,
      dimensions.depth,
      0,
      format,                  // format
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
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4); // reset to default value

    return volumeTexture;
}

/**
 * 
 * @param {*} gl WebGL rendering context
 * @param {*} images array of six images, one for each cube side
 * @param {*} dimensions dimensions of a single image
 */
export function createCubeMapTexture(gl, images, dimensions)
{
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);

  const faces = [
    gl.TEXTURE_CUBE_MAP_POSITIVE_X,
    gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
    gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
    gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
    gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
    gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
  ];

  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

  for (let i = 0 ; i < faces.length; ++i)
  {
    gl.texImage2D(
      faces[i], 
      0,
      gl.RGBA,
      dimensions.width,
      dimensions.height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      images[i]
    );
  }

  gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);

  gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);

  return texture;
}
