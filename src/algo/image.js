'use strict'

import { getCache, setCache } from "../file/cache";

/* CONSTANTS */

// Cache variables
const DATABASE_NAME = "interleavedVolumeCache";
const DATABASE_VERSION = 1;
const KEY_TYPE = "folderName";
const STORE_NAME = "interleavedVolume";

/**/

/**
 * Resamples source volume to match target volume's grid, then interleaves.
 * @param {TypedArray} volumeCT - target grid (higher res)
 * @param {TypedArray} volumePET - source grid (lower res)
 * @param {{cols, rows, depth}} dimCT - CT dimensions
 * @param {{cols, rows, depth}} dimPET - PET dimensions
 * @param {Array} originCT
 * @param {Array} originPET
 * @param {{px, py, pz}} spacingCT - CT pixel/voxel spacing in mm
 * @param {{px, py, pz}} spacingPET - PET pixel/voxel spacing in mm
 * @param {string} folderNames
 * @param {boolean} useCache
 * @param {typeof TypedArray} Typed - desired output type
 * @returns {TypedArray} interleaved volume (CT + PET per voxel)
 */
export async function interleaveVolumesWithResample(
  volumeCT, volumePET,
  dimCT, dimPET, 
  originCT, originPET,
  spacingCT, spacingPET,
  folderNames,
  useCache = false,
  Typed = Float32Array
) 
{
  if (useCache)
  {
    const cache = await getCache(DATABASE_NAME, STORE_NAME, KEY_TYPE, folderNames, DATABASE_VERSION);
    if (cache)
      return cache;
  }

  const totalVoxels = dimCT.cols * dimCT.rows * dimCT.depth;
  const interleaved = new Typed(totalVoxels * 2);

  for (let z = 0; z < dimCT.depth; z++) {
    for (let y = 0; y < dimCT.rows; y++) {
      for (let x = 0; x < dimCT.cols; x++) {
        const ctIdx = z * dimCT.rows * dimCT.cols + y * dimCT.cols + x;

        // Physical position of this CT voxel
        const physX = originCT[0] + x * spacingCT.px;
        const physY = originCT[1] + y * spacingCT.py;
        const physZ = z * spacingCT.pz;

        // Corresponding index in PET grid
        const petX = (physX - originPET[0]) / spacingPET.px;
        const petY = (physY - originPET[1]) / spacingPET.py;
        const petZ = (dimPET.depth - 1) - physZ / spacingPET.pz;

        // Trilinear interpolation (or nearest-neighbor for speed)
        const petValue = tricubicSample(volumePET, dimPET, petX, petY, petZ);

        const outIdx = ctIdx * 2;
        interleaved[outIdx]     = volumeCT[ctIdx]; // R = CT
        interleaved[outIdx + 1] = petValue;        // G = PET
      }
    }
  }

  await setCache(DATABASE_NAME, STORE_NAME, KEY_TYPE, folderNames, interleaved, DATABASE_VERSION);

  return interleaved;
}

// TODO: docs
function nearestNeigborSample(volume, dim, fx, fy, fz) {
  const x = Math.round(fx), y = Math.round(fy), z = Math.round(fz);
  if (x < 0 || x >= dim.cols || y < 0 || y >= dim.rows || z < 0 || z >= dim.depth)
    return 0;
  return volume[z * dim.rows * dim.cols + y * dim.cols + x];
}

// --- Trilinear interpolation in a flat 3D array ---
// TODO: docs
function trilinearSample(volume, dims, fx, fy, fz) {

    // Clamp to valid range
    fx = Math.max(0, Math.min(dims.rows - 1.001, fx));
    fy = Math.max(0, Math.min(dims.cols - 1.001, fy));
    fz = Math.max(0, Math.min(dims.depth - 1.001, fz));

    const x0 = Math.floor(fx), x1 = x0 + 1;
    const y0 = Math.floor(fy), y1 = y0 + 1;
    const z0 = Math.floor(fz), z1 = z0 + 1;

    const tx = fx - x0, ty = fy - y0, tz = fz - z0;

    const idx = (x, y, z) => x + dims.rows * (y + dims.cols * z);

    // Sample 8 corners
    const c000 = volume[idx(x0, y0, z0)];
    const c100 = volume[idx(x1, y0, z0)];
    const c010 = volume[idx(x0, y1, z0)];
    const c110 = volume[idx(x1, y1, z0)];
    const c001 = volume[idx(x0, y0, z1)];
    const c101 = volume[idx(x1, y0, z1)];
    const c011 = volume[idx(x0, y1, z1)];
    const c111 = volume[idx(x1, y1, z1)];

    // Trilinear blend
    return (
        c000 * (1-tx)*(1-ty)*(1-tz) +
        c100 *    tx *(1-ty)*(1-tz) +
        c010 * (1-tx)*   ty *(1-tz) +
        c110 *    tx *   ty *(1-tz) +
        c001 * (1-tx)*(1-ty)*   tz  +
        c101 *    tx *(1-ty)*   tz  +
        c011 * (1-tx)*   ty *   tz  +
        c111 *    tx *   ty *   tz
    );
}

// TODO: docs
function cubicWeight(t) {
    // Catmull-Rom basis
    const t2 = t * t, t3 = t2 * t;
    return [
        -0.5*t3 + 1.0*t2 - 0.5*t,
         1.5*t3 - 2.5*t2 + 1.0,
        -1.5*t3 + 2.0*t2 + 0.5*t,
         0.5*t3 - 0.5*t2
    ];
}

// NOTE: Takes VERY long
// TODO: docs
function tricubicSample(volume, dims, fx, fy, fz) {
    const clamp = (v, max) => Math.max(0, Math.min(max - 1, v));
    const idx = (x, y, z) => clamp(x,dims.rows) + dims.rows * (clamp(y,dims.cols) + dims.cols * clamp(z,dims.depth));

    const x0 = Math.floor(fx), y0 = Math.floor(fy), z0 = Math.floor(fz);
    const wx = cubicWeight(fx - x0);
    const wy = cubicWeight(fy - y0);
    const wz = cubicWeight(fz - z0);

    let result = 0;
    for (let dk = 0; dk < 4; dk++) {
        for (let dj = 0; dj < 4; dj++) {
            for (let di = 0; di < 4; di++) {
                result += volume[idx(x0+di-1, y0+dj-1, z0+dk-1)]
                        * wx[di] * wy[dj] * wz[dk];
            }
        }
    }
    return result;
}
