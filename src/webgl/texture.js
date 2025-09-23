'use strict'

/**
 * Creates a 3D texture from DICOM volume data
 * @param {*} gl WebGL rendering context
 * @param {*} volume volume data loaded from a DICOM file
 * @param {*} dimensions dimensions of provided volume
 * @returns WebGL 3D texture object
 */
export function createVolumeTexture(gl, volume, dimensions)
{
    const volumeTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_3D, volumeTexture);

    // gl.NEAREST as we have integer values in the volume
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);

    // gl.UNPACK_ALIGNMENT specifies the alignment requirements
    // for the start of each pixel row in memory. 1 == byte alignment
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

    // IMPORTANT: Choose formats based on bit depth and signedness 
    // hardcoded: unsigned 16bit
    gl.texImage3D(
      gl.TEXTURE_3D,
      0,
      gl.R16UI,             // internalFormat
      dimensions.cols,
      dimensions.rows,
      dimensions.depth,
      0,
      gl.RED_INTEGER,       // format
      gl.UNSIGNED_SHORT,    // type
      volume
    );

    return volumeTexture;
}
