'use strict'

/**
 * NOTE: The code in this file seems to be no longer supported
 * by the cornerstone libraries. It works but only partially.
 * No metadata are loaded (default value always selected).
 * 
 * TODO: docs
 */

import * as cornerstone from 'cornerstone-core';
import cornerstoneWADOImageLoader from 'cornerstone-wado-image-loader';
import dicomParser from 'dicom-parser';
import { getCache, setCache } from './cache';

// Name of the Dicom database used for caching
const DATABASE_NAME = "dicomCache";
//
const DATABASE_VERSION = 1;
//
const KEY_TYPE = "folderName";
// 
const STORE_NAME = "imageData";

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
 * Ask server for list of files
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
 * @param {*} imageIds 
 * @param {*} batchSize 
 * @param {*} onProgress 
 * @returns 
 */ 
async function loadInBatches(imageIds, batchSize = 6, onProgress) {
  const images = [];
  let loaded = 0;

  for (let i = 0; i < imageIds.length; i += batchSize) {
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
 * 
 * @param {*} imageIds 
 * @returns 
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

/**
 * 
 * @param {*} images 
 * @returns 
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
 * 
 * @param {*} images 
 * @param {*} imageIds 
 * @returns 
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
 * 
 * @param {*} bitsAllocated 
 * @param {*} pixelRepresentation 
 * @returns 
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
 * @param {*} images 
 * @param {*} dimensions 
 * @param {*} sliceSize 
 * @param {*} Typed 
 * @returns 
 */
function createVolume(images, dimensions, sliceSize, Typed)
{
  const volume = new Typed(sliceSize * dimensions.depth);

  for (let z = 0; z < dimensions.depth; z++) {
    const slicePixelData = images[z].getPixelData(); // Typed array

    if (slicePixelData.length !== sliceSize) {
      throw new Error(`Unexpected pixels in slice ${z}: ${slicePixelData.length} != ${sliceSize}`);
    }
    volume.set(slicePixelData, z * sliceSize);
  }

  return volume;
}

/**
 * 
 * @param {*} imageIds 
 * @param {*} dimensions 
 * @returns 
 */
function getPixelSpacing(imageIds, dimensions)
{
  const plane = cornerstone.metaData.get('imagePlaneModule', imageIds[0]) || {};

  return [
    plane.columnPixelSpacing ?? 1, // dx
    plane.rowPixelSpacing ?? 1,    // dy
    (dimensions.depth > 1 ? Math.abs(
      (cornerstone.metaData.get('imagePositionPatient', imageIds[1])?.[2] ?? 0) -
      (cornerstone.metaData.get('imagePositionPatient', imageIds[0])?.[2] ?? 0)
    ) : (cornerstone.metaData.get('sliceThickness', imageIds[0]) ?? 1)) || 1, // dz
  ];
}

/**
 * 
 * @param {*} imageIds 
 * @param {*} images 
 * @returns an object containing DICOM slices metadata and pixel volume
 */
function getImageData(imageIds, images)
{
  const dimensions = getDataDimensions(images);

  const { bitsAllocated, pixelRepresentation } = getPixelMetaData(images, imageIds);

  const Typed = defineVolumeArrayType(bitsAllocated, pixelRepresentation);

  const sliceSize = dimensions.rows * dimensions.cols;

  const volume = createVolume(images, dimensions, sliceSize, Typed);

  // const { min, max } = getPixelDataRange(volume);

  // Optional spacing/geometry
  const spacing = getPixelSpacing(imageIds, dimensions);

  return {
    dimensions,
    bitsAllocated,
    pixelRepresentation,
    spacing,
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

  for (let i = 0; i < volume.length; ++i){
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
 * Fetches DICOM file names from a server, loads them into memory and returns their
 * relevant content
 * @param {*} folderName direct name of the folder containing DICOM data
 * @returns an object containing DICOM slices metadata and pixel volume 
 */
export default async function loadDicom(folderName, useCache) {

  if (useCache)
  {
    const cache = await getCache(DATABASE_NAME, KEY_TYPE, folderName, STORE_NAME);
    if (cache)
      return cache;
  }

  const list = await fetchDicomFileNames(folderName);
  // folderURL is a web base path
  const urls = list.files.map(f => `${list.folderURL}/${encodeURIComponent(f)}`);
  const imageIds = urls.map(u => `wadouri:${u}`);

  const images = await loadImages(imageIds);

  const imageData = getImageData(imageIds, images);

  await setCache(DATABASE_NAME, DATABASE_VERSION, KEY_TYPE, folderName, STORE_NAME, imageData);

  return imageData;
}
