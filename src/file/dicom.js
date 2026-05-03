'use strict'

/**
 * FUNCTIONALITY OVERVIEW
 * 
 * NOTE: The code in this file seems to be no longer supported
 * by the cornerstone libraries. It works but only partially.
 * No metadata are loaded (default value always selected).
 * 
 * ----------------------
 */

import * as cornerstone from 'cornerstone-core';
import cornerstoneWADOImageLoader from 'cornerstone-wado-image-loader';
import dicomParser from 'dicom-parser';
import { getCache, setCache } from './cache';

/* CONSTANTS */

// Cache variables
const DATABASE_NAME = "dicomCache";
const DATABASE_VERSION = 1;
const KEY_TYPE = "folderName";
const STORE_NAME = "imageData";

/**/

// Wire externals
cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
cornerstoneWADOImageLoader.external.dicomParser = dicomParser;

// true for compressed DICOM, false for uncompressed
cornerstoneWADOImageLoader.configure({ useWebWorkers: false });

// For compressed syntaxes, copy worker+codec files to public/ and initialize:
// NOTE: Didn't do that as I didn't find the files
// cornerstoneWADOImageLoader.webWorkerManager.initialize({
//   webWorkerPath: '/cornerstone/cornerstoneWADOImageLoaderWebWorker.min.js',
//   taskConfiguration: {
//     decodeTask: {
//       codecsPath: '/cornerstone/cornerstoneWADOImageLoaderCodecs.min.js',
//     },
//   },
// });



/**
 * Asks server for list of files
 * @param {*} folderName direct name of the folder containing DICOM data
 * @returns a json-type object containing DICOM folder metadata and file names
 */
async function fetchDicomFileNames(folderName)
{
  const listRes = await fetch(`/server/dicom/?folder=${encodeURIComponent(folderName)}`);
  if (!listRes.ok) 
    throw new Error(`List HTTP ${listRes.status}`);

  return await listRes.json();
}

/**
 * Helper function: loads imageIds in batches (limits network/CPU concurrency)
 * @param {string[]} imageIds array of image identifiers to load
 * @param {number} batchSize number of images to load concurrently (default: 6)
 * @param {function} onProgress callback function called after each batch with (loaded, total) parameters
 * @returns {Promise<Array>} array of loaded cornerstone image objects
 */ 
async function loadInBatches(imageIds, batchSize = 6, onProgress) 
{
  const images = [];
  let loaded = 0;

  for (let i = 0; i < imageIds.length; i += batchSize) 
  {
    const batch = imageIds.slice(i, i + batchSize).map(id => cornerstone.loadAndCacheImage(id));
    const results = await Promise.all(batch);
    images.push(...results);
    loaded += results.length;
    onProgress?.(loaded, imageIds.length);

    // Yield to the UI thread so rendering stays smooth
    await new Promise(r => setTimeout(r, 0));
  }
  return images;
}

/**
 * Loads all DICOM images from the provided image identifiers
 * @param {string[]} imageIds array of cornerstone image identifiers to load
 * @returns {Promise<Array>} array of loaded cornerstone image objects
 */
async function loadImages(imageIds)
{
  // Not using batches:
  // const images = [];
  // for (const id of imageIds) {
  //   const img = await cornerstone.loadAndCacheImage(id);
  //   images.push(img);
  // }

  const batchSize = 6;
  const onProgress = function(n, total) {
    console.debug(`Loaded ${n}/${total}`)
  };
  
  const images = await loadInBatches(imageIds, batchSize, onProgress);
  
  if (images.length === 0) 
    throw new Error('No images loaded');

  return images;
}

// TODO: docs
function sortSlicesByPosition(imageIds, images) {
    const pairs = imageIds.map((id, i) => {
        const dataset = images[i].data;
        const ipp = dataset?.string('x00200032');
        const z = ipp ? parseFloat(ipp.split('\\')[2]) : i;
        return { id, image: images[i], z };
    });
    pairs.sort((a, b) => a.z - b.z);
    return {
        imageIds: pairs.map(p => p.id),
        images:   pairs.map(p => p.image),
    };
}

/**
 * Extracts the dimensions of the image volume from the loaded images
 * @param {Array} images array of loaded cornerstone image objects
 * @returns {{rows: number, cols: number, depth: number}} object containing the volume dimensions
 */
function getDataDimensions(images)
{
  return { 
    rows: images[0].rows, 
    cols: images[0].columns,
    depth: images.length,
  };
}

/**
 * Extracts pixel metadata from DICOM images including bit depth and signedness
 * @param {Array} images array of loaded cornerstone image objects
 * @param {string[]} imageIds array of cornerstone image identifiers
 * @returns {{bitsAllocated: number, pixelRepresentation: number}} object containing bits allocated and pixel representation (0=unsigned, 1=signed)
 */
function getPixelMetaData(images, imageIds)
{
  // Enable metadata provider so metaData.get works
  // TODO: Throws error Uncaught (in promise) TypeError: providers[i].provider is not a function
  // cornerstone.metaData.addProvider(
  //   cornerstoneWADOImageLoader.wadouri.metaDataProvider,
  //   9999
  // );

  // const bitsAllocated = cornerstone.metaData.get('bitsAllocated', imageIds[0]) ?? 16;
  // console.log("bit allocated", bitsAllocated);
  // const pixelRepresentation = cornerstone.metaData.get('pixelRepresentation', imageIds[0]) ?? 0; // 0=unsigned,1=signed
  // console.log("pixel representation", pixelRepresentation);

  // Prefer metadata; otherwise infer from pixel data type
  let bitsAllocated = cornerstone.metaData.get?.('bitsAllocated', imageIds[0]);
  let pixelRepresentation = cornerstone.metaData.get?.('pixelRepresentation', imageIds[0]);
  if (bitsAllocated == null || pixelRepresentation == null) {
    const pd0 = images[0].getPixelData();
    bitsAllocated = (pd0?.BYTES_PER_ELEMENT || 1) * 8;
    pixelRepresentation =
      pd0 instanceof Int8Array || pd0 instanceof Int16Array || pd0 instanceof Int32Array ? 1 : 0;
  }

  return { bitsAllocated, pixelRepresentation };
}

/**
 * Determines the appropriate TypedArray constructor for storing volume pixel data
 * @param {number} bitsAllocated number of bits allocated per pixel (8, 16, or 32)
 * @param {number} pixelRepresentation 0 for unsigned, 1 for signed pixel values
 * @returns {typeof Float32Array} TypedArray constructor for the volume data
 */
function defineVolumeArrayType(bitsAllocated, pixelRepresentation)
{
  // Data are typed as float for hardware-supported interpolation on the GPU
  // Otherwise Uint16Array is enough
  return Float32Array;
  
  // return bitsAllocated === 8 ? Uint8Array
  //   : bitsAllocated === 16 ? (pixelRepresentation === 1 ? Int16Array : Uint16Array)
  //   : bitsAllocated === 32 ? (pixelRepresentation === 1 ? Int32Array : Uint32Array)
  //   : Uint8Array;
}

/**
 * Gathers pixel data for 3D texture into a single volume object
 * @param {Array} images array of loaded cornerstone image objects
 * @param {{rows: number, cols: number, depth: number}} dimensions object containing the volume dimensions
 * @param {number} sliceSize number of pixels per slice (rows * cols)
 * @param {typeof Float32Array} Typed TypedArray constructor for the volume data
 * @returns {Float32Array} flattened volume array containing all slice pixel data
 */
function createVolume(images, dimensions, sliceSize, Typed)
{
  const volume = new Typed(sliceSize * dimensions.depth);

  for (let z = 0; z < dimensions.depth; ++z) 
  {
    const slicePixelData = images[z].getPixelData(); // Typed array

    if (slicePixelData.length !== sliceSize) 
      throw new Error(`Unexpected pixels in slice ${z}: ${slicePixelData.length} != ${sliceSize}`);

    volume.set(slicePixelData, z * sliceSize);
  }

  return volume;
}

/**
 * Extracts voxel spacing information from DICOM metadata
 * @param {string[]} imageIds array of cornerstone image identifiers
 * @param {{rows: number, cols: number, depth: number}} dimensions object containing the volume dimensions
 * @returns {{px: number, py: number, pz: number}} object with pixel/slice spacing values in mm
 */
function getPixelSpacing(imageIds, dimensions)
{
  const plane = cornerstone.metaData.get('imagePlaneModule', imageIds[0]) || {};

  return {
    px: plane.columnPixelSpacing ?? 1, // dx
    py: plane.rowPixelSpacing ?? 1,    // dy
    pz: (dimensions.depth > 1 ? Math.abs(
      (cornerstone.metaData.get('imagePositionPatient', imageIds[1])?.[2] ?? 0) -
      (cornerstone.metaData.get('imagePositionPatient', imageIds[0])?.[2] ?? 0)
    ) : (cornerstone.metaData.get('sliceThickness', imageIds[0]) ?? 1)) || 1, // dz
  };
}

/**
 * Parses Image Position Patient and Image Orientation Patient
 * directly from the DICOM dataset via dicomParser as a fallback.
 * 
 * Tags:
 *   (0020,0032) Image Position Patient  → origin of this slice
 *   (0020,0037) Image Orientation Patient → row (3) + col (3) direction cosines
 */
// TODO: docs
function getGeometryFromDataset(dataset) {
    // dicomParser: backslash-separated decimal strings
    const ipp = dataset.string('x00200032'); // "x\y\z"
    const iop = dataset.string('x00200037'); // "rx\ry\rz\cx\cy\cz"

    const origin = ipp
        ? ipp.split('\\').map(Number)
        : [0, 0, 0];

    const cosines = iop
        ? iop.split('\\').map(Number)
        : [1, 0, 0,  0, 1, 0];  // identity fallback

    return {
        origin: origin,          // [x, y, z] in mm
        row:    cosines.slice(0, 3),  // [rx, ry, rz]
        col:    cosines.slice(3, 6),  // [cx, cy, cz]
    };
}

/**
 * Extracts origin and orientation for the first slice.
 * Tries cornerstone's imagePlaneModule first, falls back to dicomParser.
 * 
 * @param {string[]} imageIds
 * @param {Array} images - loaded cornerstone image objects (image.data is the dicomParser dataset)
 */
// TODO: docs
function getVolumeGeometry(imageIds, images) {
    // --- Try cornerstone metadata provider first ---
    const plane = cornerstone.metaData.get('imagePlaneModule', imageIds[0]);

    if (plane?.imagePositionPatient && plane?.rowCosines && plane?.columnCosines) {
        // Cornerstone may return {x,y,z} objects or plain arrays depending on version
        const toArr = v => Array.isArray(v) ? v : [v.x, v.y, v.z];
        return {
            origin: toArr(plane.imagePositionPatient),
            row:    toArr(plane.rowCosines),
            col:    toArr(plane.columnCosines),
        };
    }

    // --- Fallback: read directly from dicomParser dataset ---
    // images[0].data is the raw parsed dicom dataset from cornerstone-wado-image-loader
    const dataset = images[0].data;
    if (dataset) {
        return getGeometryFromDataset(dataset);
    }

    // Last resort: identity (will misregister but won't crash)
    console.warn('Could not extract DICOM geometry — using identity transform');
    return {
        origin: [0, 0, 0],
        row:    [1, 0, 0],
        col:    [0, 1, 0],
    };
}

/**
 * Processes loaded DICOM images and extracts all relevant data for 3D rendering
 * @param {string[]} imageIds array of cornerstone image identifiers
 * @param {Array} images array of loaded cornerstone image objects
 * @returns {{dimensions: {rows: number, cols: number, depth: number}, 
 *            bitsAllocated: number, pixelRepresentation: number, spacing: {px: number, py: number, pz: number}, 
 *            origin: Array, row: int[], col: int[], imageIds: string[], volume: Float32Array}} object containing DICOM slices metadata and pixel volume
 */
function getImageData(imageIds, images)
{
  const dimensions = getDataDimensions(images);

  const { bitsAllocated, pixelRepresentation } = getPixelMetaData(images, imageIds);

  const Typed = defineVolumeArrayType(bitsAllocated, pixelRepresentation);

  const sliceSize = dimensions.rows * dimensions.cols;

  const volume = createVolume(images, dimensions, sliceSize, Typed);

  // const { min, max } = getPixelDataRange(volume);

  const spacing = getPixelSpacing(imageIds, dimensions);

  const { origin, row, col } = getVolumeGeometry(imageIds, images);

  return {
    dimensions,
    bitsAllocated,
    pixelRepresentation,
    spacing,
    origin,
    row,
    col,
    imageIds,
    volume,
  };
}

/**
 * Finds the min and max value in the volume array
 * @param {*} volume volume pixel data array
 * @returns min and max value from the volume array
 */
function getPixelDataRange(volume)
{
  let min = volume[0];
  let max = volume[0];

  for (let i = 0; i < volume.length; ++i)
  {
    const element = volume[i];
    if (element !== NaN)
    {
      min = Math.min(min, element);
      max = Math.max(max, element);
    }
  };

  // console.log("min in volume", min);
  // console.log("max in volume", max);

  return { min, max };
}

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
  const DATABASE_NAME = "interleavedVolumeCache";
  const DATABASE_VERSION = 1;
  const KEY_TYPE = "folderName";
  const STORE_NAME = "interleavedVolume";
  if (useCache)
  {
    const cache = await getCache(DATABASE_NAME, STORE_NAME, KEY_TYPE, folderNames, DATABASE_VERSION);
    if (cache)
    {
      console.log("using cache");
      return cache;
    }
  }

  const totalVoxels = dimCT.cols * dimCT.rows * dimCT.depth;
  const interleaved = new Typed(totalVoxels * 2);

  console.log("running for loopp");

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
function sampleVolume(volume, dim, fx, fy, fz) {
  // Nearest-neighbor (fast)
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

/**
 * Fetches DICOM file names from a server, loads them into memory and returns their
 * relevant content.
 * @param {*} folderName direct name of the folder containing DICOM data
 * @param {*} useCache boolean determining whether to load and/or store image data from client-side browser cache 
 * @returns an object containing DICOM slices metadata and pixel volume 
 */
export async function loadDicom(folderName, useCache = false) 
{
  if (useCache)
  {
    const cache = await getCache(DATABASE_NAME, STORE_NAME, KEY_TYPE, folderName, DATABASE_VERSION);
    if (cache)
      return cache;
  }

  const list = await fetchDicomFileNames(folderName);
  // folderURL is a web base path
  const urls = list.files.map(f => `${list.folderURL}/${encodeURIComponent(f)}`);
  const imageIds = urls.map(u => `wadouri:${u}`);

  const images = await loadImages(imageIds);

  sortSlicesByPosition(imageIds, images);

  const imageData = getImageData(imageIds, images);

  await setCache(DATABASE_NAME, STORE_NAME, KEY_TYPE, folderName, imageData, DATABASE_VERSION);

  return imageData;
}
