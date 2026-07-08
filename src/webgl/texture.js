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
      dimensions.rows,
      dimensions.cols,
      dimensions.layers,
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
    //   dimensions.rows,
    //   dimensions.cols,
    //   dimensions.layers,
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
 * Creates a WebGL cubemap texture from 6 given squared images.
 * @param {*} gl WebGL rendering context
 * @param {*} images array of six images, one for each cube side
 * @param {*} dimensions dimensions of a single image
 * @returns WebGL cubemap texture object
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

/**
 * Creates a WebGL depth texture for custom framebuffer use.
 * @param {*} gl WebGL rendering context
 * @param {*} dimensions screen dimensions
 * @returns WebGL depth texture object
 */
function createDepthTexture(gl, dimensions)
{
  const depthTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, depthTexture);

  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.DEPTH_COMPONENT24,
    dimensions.width,
    dimensions.height,
    0,
    gl.DEPTH_COMPONENT,
    gl.UNSIGNED_INT,
    null
  );

  gl.bindTexture(gl.TEXTURE_2D, null);

  return depthTexture;
}

/**
 * Creates a WebGL texture used for custom framebuffer use.
 * @param {*} gl WebGL rendering context
 * @param {*} dimensions screen dimensions
 * @param {*} type type of texture to be created [rgba, depth, stencil, ...]
 * @returns WebGL texture object
 */
export function createFramebufferTexture(gl, dimensions, type)
{
  switch(type)
  {
    case "rgba":
      return create2DTexture(gl, null, dimensions);
    case "depth":
      return createDepthTexture(gl, dimensions);
    default:
      console.error("invalid frambebuffer texture type");
  }
}

/**
 * Creates a custom framebuffer.
 * @param {*} gl WebGL rendering context
 * @param {{color: Array, depth, stencil}} attachments texture attachments 
 * @returns custom framebuffer
 */
export function createFramebuffer(gl, attachments)
{
  const frameBuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);

  for (let i = 0; i < attachments.color.length; ++i)
  {
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, attachments.color[i], 0);
  }
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, attachments.depth, 0); 

  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  console.log("[FRAMEBUFFER STATUS]", status == 36053 ? "complete" : "incomplete " + status);

  gl.drawBuffers([gl.COLOR_ATTACHMENT0]);

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  return frameBuffer;
}
