'use strict'

import { getCache, setCache } from "../file/cache";

/* CONSTANTS */

// Cache variables
const DATABASE_NAME = "interleavedVolumeCache";
const DATABASE_VERSION = 1;
const KEY_TYPE = "folderName";
const STORE_NAME = "interleavedVolume";

// Numerical limits
const INT32_MAX = ~(1 << 31);

/**/

class StridedArrayView 
{
  constructor(typedArray, start, end, stride)
  {
    this.array = typedArray;
    this.start = start;
    this.stride = stride;
    this.length = Math.max(0, Math.ceil((end - start) / stride));
  }

  // virtual index
  at(index)
  {
    if (index < 0 || index >= this.length) 
      return undefined;
    return this.array[this.start + index * this.stride];
  }

  // access the original array using the virtual index
  set(index, value)
  {
    if (index >= 0 && index < this.length) 
      this.array[this.start + index * this.stride] = value;
  }

  // set multiple values from another array into the original array
  setAll(items)
  {
    for (let i = 0; i < items.length; ++i)
      this.set(i, items[i]);
  }
}

/**
 * Resamples source volume to match target volume's grid, then interleaves.
 * @param {TypedArray} volumeCT - target grid (higher res)
 * @param {TypedArray} volumePET - source grid (lower res)
 * @param {{cols, rows, layers}} dimCT - CT dimensions
 * @param {{cols, rows, layers}} dimPET - PET dimensions
 * @param {Array} originCT
 * @param {Array} originPET
 * @param {{x, y, z}} spacingCT - CT pixel/voxel spacing in mm
 * @param {{x, y, z}} spacingPET - PET pixel/voxel spacing in mm
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

  const layerSize = dimCT.rows * dimCT.cols;
  const totalVoxels = layerSize * dimCT.layers;
  const interleaved = new Typed(totalVoxels * 2);

  for (let z = 0; z < dimCT.layers; z++) {
    for (let y = 0; y < dimCT.cols; y++) {
      for (let x = 0; x < dimCT.rows; x++) {
        const ctIdx = z * layerSize + y * dimCT.cols + x;

        // NOTE: origin.z values are dropped as they are too large and (I assume)
        // the value would be put outside of the volume. 
        // Example: originCT.z = -1541, originPET.z = -775.964.

        // Physical position of this CT voxel
        const physX = originCT.x + x * spacingCT.x;
        const physY = originCT.y + y * spacingCT.y;
        const physZ = z * spacingCT.z;

        // Corresponding index in PET grid
        const petX = (physX - originPET.x) / spacingPET.x;
        const petY = (physY - originPET.y) / spacingPET.y;
        const petZ = (dimPET.layers - 1) - physZ / spacingPET.z;

        // Interpolation (nearest-neighbor for speed)
        const petValue = tricubicSample(volumePET, dimPET, petX, petY, petZ);

        const outIdx = ctIdx * 2;
        interleaved[outIdx] = volumeCT[ctIdx]; // R = CT
        interleaved[outIdx + 1] = petValue;    // G = PET
      }
    }
  }

  await setCache(DATABASE_NAME, STORE_NAME, KEY_TYPE, folderNames, interleaved, DATABASE_VERSION);

  return interleaved;
}

// TODO: docs
function nearestNeigborSample(volume, dim, fx, fy, fz) {
  const x = Math.round(fx), y = Math.round(fy), z = Math.round(fz);
  if (x < 0 || x >= dim.cols || y < 0 || y >= dim.rows || z < 0 || z >= dim.layers)
    return 0;
  return volume[z * dim.rows * dim.cols + y * dim.cols + x];
}

// --- Trilinear interpolation in a flat 3D array ---
// TODO: docs
function trilinearSample(volume, dims, fx, fy, fz) {

    // Clamp to valid range
    fx = Math.max(0, Math.min(dims.rows - 1.001, fx));
    fy = Math.max(0, Math.min(dims.cols - 1.001, fy));
    fz = Math.max(0, Math.min(dims.layers - 1.001, fz));

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
    const idx = (x, y, z) => clamp(x,dims.rows) + dims.rows * (clamp(y,dims.cols) + dims.cols * clamp(z,dims.layers));

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

export async function euclideanDistanceTransform(volume, dimensions, spacing, threshold) 
{
  const {rows: width, cols: height, layers: depth} = dimensions;
  const widthHeight = width * height
  const volumeSize = widthHeight * depth;

  const distanceTransform = new Float32Array(volumeSize).map((value, index) => value = volume[index] > threshold ? 0 : INT32_MAX);

  // x
  for (let z = 0; z < depth; ++z)
  {
    for (let y = 0; y < height; ++y)
    {
      const startIndex = z * widthHeight + y * width;
      const row = new StridedArrayView(distanceTransform, startIndex, startIndex + width, 1);
      row.setAll(DT(row, spacing.x));
    }
  }

  // y
  for (let z = 0; z < depth; ++z)
  {
    for (let x = 0; x < width; ++x)
    {
      const startIndex = z * widthHeight + x;
      const column = new StridedArrayView(distanceTransform, startIndex, startIndex + height * width, width);
      column.setAll(DT(column, spacing.y));
    }
  }

  // z
  for (let y = 0; y < height; ++y)
  {
    for (let x = 0; x < width; ++x)
    {
      const startIndex = y * width + x;
      const layer = new StridedArrayView(distanceTransform, startIndex, startIndex + depth * widthHeight, widthHeight);
      layer.setAll(DT(layer, spacing.z));
    }
  }

  return distanceTransform;
}

/**
 * 
 * @param { StridedArrayView } f array representing a 1D function
 * @param {Number} spacing spacing between samples of `f`
 * @returns {TypedArray} distance transform for the given function `f`
 */
function DT(f, spacing) 
{
  const n = f.length;
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  const sq = spacing * spacing;

  let k = 0;
  v[0] = 0;
  z[0] = -Infinity;
  z[1] = Infinity;

  for (let q = 1; q < n; ++q)
  {
    const v_k = v[k];
    let s = ((f.at(q) + q * q * sq) - (f.at(v_k) + v_k * v_k * sq)) / (2 * sq * (q - v_k));
    while (s <= z[k]) 
    {
      --k;
      const v_k = v[k];
      s = ((f.at(q) + q * q * sq) - (f.at(v_k) + v_k * v_k * sq)) / (2 * sq * (q - v_k));
    }

    ++k;
    v[k] = q;
    z[k] = s;
    z[k + 1] = Infinity;
  }

  // NOTE: Float has 24 mantissa bits -> integers are exact up to 2^24 = 16,777,216;
  // so squared distances will be correct up to volume dimension of 2048^3 (max sq. distance ~12.6M).
  // However, if s (sample spacing) is a decimal value, subsequent calculations will have a small
  // floating point error.
  const Df = new Float32Array(n); 
  k = 0;

  for (let q = 0; q < n; ++q)
  {
    while (z[k + 1] < q)
      ++k;
    
    let v_k = v[k];
    let temp = (q - v_k) * spacing;
    Df[q] = temp * temp + f.at(v_k);
  }

  return Df;
}

export function interleaveVolumeAndEDT(volume, edt)
{
  const interleaved = new Float32Array(volume.length + edt.length);

  let outIdx = 0;
  for (let i = 0; i < edt.length; ++i)
  {
    const volumeIdx = 2 * i;
    interleaved[outIdx++] = volume[volumeIdx];
    interleaved[outIdx++] = volume[volumeIdx + 1];
    interleaved[outIdx++] = edt[i];
  }

  return interleaved;
}
