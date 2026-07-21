'use strict';

import { endBenchmark, startBenchmark } from "../app/log";
import { getCache, setCache } from "../file/cache";

/* CONSTANTS */

// Cache variables
const DATABASE_NAME_CT_PET = "resampledVolumePETCache";
const DATABASE_VERSION = 1;
const KEY_TYPE_CT_PET = "folderName";
const STORE_NAME_CT_PET = "resampledVolumePET";

const DATABASE_NAME_EDT = "DistanceTransformCache";
const KEY_TYPE_EDT = "name";
const STORE_NAME_EDT = "DistanceTransform";

// Numerical limits
const INT32_MAX = ~(1 << 31);

/**/

/**
 * Manages a stride when foreign code accesses the array from the outside.
 * This allows the foreign code to use consecutive indexes without having
 * knowledge about the stride.
 */
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
 * Resamples source volume to match target volume's grid.
 * @param {TypedArray} volumeCT - target grid (higher res)
 * @param {TypedArray} volumePET - source grid (lower res)
 * @param {{cols, rows, layers}} dimCT - CT dimensions
 * @param {{cols, rows, layers}} dimPET - PET dimensions
 * @param {Array} originCT CT origin vector
 * @param {Array} originPET PET origin vector
 * @param {{x, y, z}} spacingCT - CT pixel/voxel spacing in mm
 * @param {{x, y, z}} spacingPET - PET pixel/voxel spacing in mm
 * @param {string} folderNames concatenated names of CT and PET folders
 * @param {boolean} useCache boolean determining whether to load and/or store interleaved data from client-side browser cache
 * @param {typeof TypedArray} Typed - desired output type
 * @returns {TypedArray} resampled volume
 */
export async function resampleVolumePET(
  volumeCT, volumePET,
  dimCT, dimPET,
  originCT, originPET,
  spacingCT, spacingPET,
  folderNames,
  useCache = false,
  Typed = Float32Array
)
{
  const start = startBenchmark("RESAMPLE CT PET");

  if (useCache)
  {
    const cache = await getCache(DATABASE_NAME_CT_PET, STORE_NAME_CT_PET, KEY_TYPE_CT_PET, folderNames, DATABASE_VERSION);
    if (cache)
    {
      endBenchmark("RESAMPLE CT PET", start, true);
      return cache;
    }
  }

  const layerSize = dimCT.rows * dimCT.cols;
  const totalVoxels = layerSize * dimCT.layers;
  const resampledPET = new Typed(totalVoxels);

  for (let z = 0; z < dimCT.layers; z++)
  {
    for (let y = 0; y < dimCT.cols; y++)
    {
      for (let x = 0; x < dimCT.rows; x++)
      {
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

        resampledPET[ctIdx] = petValue;
      }
    }
  }

  await setCache(DATABASE_NAME_CT_PET, STORE_NAME_CT_PET, KEY_TYPE_CT_PET, folderNames, resampledPET, DATABASE_VERSION);

  endBenchmark("RESAMPLE CT PET", start);

  return resampledPET;
}

/**
 * Samples a volume at the nearest voxel to the provided continuous coordinates.
 * Out-of-bounds coordinates return 0 so the caller can treat the sample as empty.
 * @param {TypedArray} volume - Flat 3D volume data stored in row-major order.
 * @param {{rows: number, cols: number, layers: number}} dim - Volume dimensions.
 * @param {number} fx - Continuous x coordinate in voxel space.
 * @param {number} fy - Continuous y coordinate in voxel space.
 * @param {number} fz - Continuous z coordinate in voxel space.
 * @returns {number} Sampled value at the nearest voxel or 0 when outside the volume.
 */
function nearestNeigborSample(volume, dim, fx, fy, fz)
{
  const x = Math.round(fx), y = Math.round(fy), z = Math.round(fz);
  if (x < 0 || x >= dim.cols || y < 0 || y >= dim.rows || z < 0 || z >= dim.layers)
    return 0;
  return volume[z * dim.rows * dim.cols + y * dim.cols + x];
}

/**
 * Samples a volume using trilinear interpolation from the eight surrounding voxels.
 * Coordinates are clamped to the valid voxel range before interpolation.
 * @param {TypedArray} volume - Flat 3D volume data stored in row-major order.
 * @param {{rows: number, cols: number, layers: number}} dims - Volume dimensions.
 * @param {number} fx - Continuous x coordinate in voxel space.
 * @param {number} fy - Continuous y coordinate in voxel space.
 * @param {number} fz - Continuous z coordinate in voxel space.
 * @returns {number} Interpolated sample value.
 */
function trilinearSample(volume, dims, fx, fy, fz)
{
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
    c000 * (1 - tx) * (1 - ty) * (1 - tz)
    + c100 * tx * (1 - ty) * (1 - tz)
    + c010 * (1 - tx) * ty * (1 - tz)
    + c110 * tx * ty * (1 - tz)
    + c001 * (1 - tx) * (1 - ty) * tz
    + c101 * tx * (1 - ty) * tz
    + c011 * (1 - tx) * ty * tz
    + c111 * tx * ty * tz
  );
}

/**
 * Computes the four Catmull-Rom interpolation weights for a fractional offset.
 * @param {number} t - Fractional distance from the lower grid coordinate.
 * @returns {number[]} Array of weights for the four neighboring samples.
 */
function cubicWeight(t)
{
  // Catmull-Rom basis
  const t2 = t * t, t3 = t2 * t;
  return [
    -0.5 * t3 + 1.0 * t2 - 0.5 * t,
    1.5 * t3 - 2.5 * t2 + 1.0,
    -1.5 * t3 + 2.0 * t2 + 0.5 * t,
    0.5 * t3 - 0.5 * t2,
  ];
}

// NOTE: Takes VERY long
/**
 * Samples a volume using Catmull-Rom tricubic interpolation over a 4x4x4 neighborhood.
 * This is slower than trilinear interpolation but produces smoother results.
 * @param {TypedArray} volume - Flat 3D volume data stored in row-major order.
 * @param {{rows: number, cols: number, layers: number}} dims - Volume dimensions.
 * @param {number} fx - Continuous x coordinate in voxel space.
 * @param {number} fy - Continuous y coordinate in voxel space.
 * @param {number} fz - Continuous z coordinate in voxel space.
 * @returns {number} Interpolated sample value.
 */
function tricubicSample(volume, dims, fx, fy, fz)
{
  const clamp = (v, max) => Math.max(0, Math.min(max - 1, v));
  const idx = (x, y, z) => clamp(x, dims.rows) + dims.rows * (clamp(y, dims.cols) + dims.cols * clamp(z, dims.layers));

  const x0 = Math.floor(fx), y0 = Math.floor(fy), z0 = Math.floor(fz);
  const wx = cubicWeight(fx - x0);
  const wy = cubicWeight(fy - y0);
  const wz = cubicWeight(fz - z0);

  let result = 0;
  for (let dk = 0; dk < 4; dk++)
  {
    for (let dj = 0; dj < 4; dj++)
    {
      for (let di = 0; di < 4; di++)
      {
        result += volume[idx(x0 + di - 1, y0 + dj - 1, z0 + dk - 1)]
                  * wx[di] * wy[dj] * wz[dk];
      }
    }
  }
  return result;
}

/**
 * Computes Euclidean Distance Transform within a volume to a given threshold value.
 * @param {*} name volume data name
 * @param {*} volume volume data array
 * @param {*} dimensions volume dimensions
 * @param {*} threshold value to which the distance is computed
 * @param {*} useCache boolean determining whether to load and/or store computed data from client-side browser cache
 * @returns array of computed distance transform for each voxel of the volume
 */
export async function euclideanDistanceTransform(name, volume, dimensions, threshold, useCache = false)
{
  const start = startBenchmark("COMPUTE EDT", name);

  if (useCache)
  {
    const cache = await getCache(DATABASE_NAME_EDT, STORE_NAME_EDT, KEY_TYPE_EDT, name, DATABASE_VERSION);
    if (cache)
    {
      endBenchmark("COMPUTE EDT", start, true, name);
      return cache;
    }
  }

  const { rows: width, cols: height, layers: depth } = dimensions;
  const widthHeight = width * height;
  const volumeSize = widthHeight * depth;

  const distanceTransform = new Float32Array(volumeSize).map((value, index) => value = volume[index] > threshold ? 0 : INT32_MAX);

  // x
  for (let z = 0; z < depth; ++z)
  {
    for (let y = 0; y < height; ++y)
    {
      const startIndex = z * widthHeight + y * width;
      const row = new StridedArrayView(distanceTransform, startIndex, startIndex + width, 1);
      row.setAll(DT(row));
    }
  }

  // y
  for (let z = 0; z < depth; ++z)
  {
    for (let x = 0; x < width; ++x)
    {
      const startIndex = z * widthHeight + x;
      const column = new StridedArrayView(distanceTransform, startIndex, startIndex + height * width, width);
      column.setAll(DT(column));
    }
  }

  // z
  for (let y = 0; y < height; ++y)
  {
    for (let x = 0; x < width; ++x)
    {
      const startIndex = y * width + x;
      const layer = new StridedArrayView(distanceTransform, startIndex, startIndex + depth * widthHeight, widthHeight);
      layer.setAll(DT(layer));
    }
  }

  await setCache(DATABASE_NAME_EDT, STORE_NAME_EDT, KEY_TYPE_EDT, name, distanceTransform, DATABASE_VERSION);

  endBenchmark("COMPUTE EDT", start, false, name);

  return distanceTransform;
}

/**
 * Computes Distance Transform according to the algorithm presented by
 * Felzenszwalb and Huttenlocher in Theory of Computing Volume 8 (2012).
 * @param { StridedArrayView } f array representing a 1D function
 * @returns {TypedArray} distance transform for the given function `f`
 */
function DT(f)
{
  const n = f.length;
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);

  let k = 0;
  v[0] = 0;
  z[0] = -Infinity;
  z[1] = Infinity;

  for (let q = 1; q < n; ++q)
  {
    const v_k = v[k];
    let s = ((f.at(q) + q * q) - (f.at(v_k) + v_k * v_k)) / (2 * (q - v_k));
    while (s <= z[k])
    {
      --k;
      const v_k = v[k];
      s = ((f.at(q) + q * q) - (f.at(v_k) + v_k * v_k)) / (2 * (q - v_k));
    }

    ++k;
    v[k] = q;
    z[k] = s;
    z[k + 1] = Infinity;
  }

  // NOTE: Float has 24 mantissa bits -> integers are exact up to 2^24 = 16,777,216;
  // so squared distances will be correct up to volume dimension of 2048^3 (max sq. distance ~12.6M).
  // However, if real-value sample spacing is used, subsequent calculations will have a small
  // floating point error.
  const Df = new Float32Array(n);
  k = 0;

  for (let q = 0; q < n; ++q)
  {
    while (z[k + 1] < q)
      ++k;

    let v_k = v[k];
    let temp = (q - v_k);
    Df[q] = temp * temp + f.at(v_k);
  }

  return Df;
}

/**
 * Interleaves multiple volume array into one array.
 * @param {*} volumeArrays volume arrays
 * @returns Interleaved array of volumes
 */
export function interleaveVolumeArrays(...volumeArrays)
{
  if (volumeArrays.length === 1)
    return volumeArrays[0];

  const start = startBenchmark("INTERLEAVE ARRAYS");

  let totalLength = 0;
  for (const volume of volumeArrays)
    totalLength += volume.length;

  const interleaved = new Float32Array(totalLength);

  let outIdx = 0;
  for (let i = 0; i < volumeArrays[0].length; ++i)
  {
    for (const volume of volumeArrays)
      interleaved[outIdx++] = volume[i];
  }

  endBenchmark("INTERLEAVE ARRAYS", start);

  return interleaved;
}
