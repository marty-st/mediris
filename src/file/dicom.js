'use strict'

import * as cornerstone from 'cornerstone-core';
import cornerstoneWADOImageLoader from 'cornerstone-wado-image-loader';
import dicomParser from 'dicom-parser';

// Wire externals
cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
cornerstoneWADOImageLoader.external.dicomParser = dicomParser;

// true for compressed DICOM, false for uncompressed
cornerstoneWADOImageLoader.configure({ useWebWorkers: true });

// For compressed syntaxes, copy worker+codec files to public/ and initialize:
// NOTE: Didn't do that as I didn't find the files
cornerstoneWADOImageLoader.webWorkerManager.initialize({
  webWorkerPath: '/cornerstone/cornerstoneWADOImageLoaderWebWorker.min.js',
  taskConfiguration: {
    decodeTask: {
      codecsPath: '/cornerstone/cornerstoneWADOImageLoaderCodecs.min.js',
    },
  },
});

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
 * @param {*} relativeFolder 
 * @returns 
 */
export default async function fetchDicom(relativeFolder = 'CT WB w-contrast 5.0 B30s') {
  // Ask server for list of files and a web base path
  const listRes = await fetch(`/server/dicom`);
  if (!listRes.ok) throw new Error(`List HTTP ${listRes.status}`);
  const list = await listRes.json();

  const urls = list.files.map(f => `${list.webBase}/${encodeURIComponent(f)}`);
  const imageIds = urls.map(u => `wadouri:${u}`);
  
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

  const rows = images[0].rows;
  const cols = images[0].columns;
  const depth = images.length;

  // Enable metadata provider so metaData.get works
  // TODO: Throws error Uncaught (in promise) TypeError: providers[i].provider is not a function
  // cornerstone.metaData.addProvider(
  //   cornerstoneWADOImageLoader.wadouri.metaDataProvider,
  //   9999
  // );

  const bitsAllocated = cornerstone.metaData.get('bitsAllocated', imageIds[0]) ?? 16;
  const pixelRepresentation = cornerstone.metaData.get('pixelRepresentation', imageIds[0]) ?? 0; // 0=unsigned,1=signed

  const Typed =
    bitsAllocated === 8 ? Uint8Array
    : bitsAllocated === 16 ? (pixelRepresentation === 1 ? Int16Array : Uint16Array)
    : bitsAllocated === 32 ? (pixelRepresentation === 1 ? Int32Array : Uint32Array)
    : Uint8Array;

  const sliceSize = rows * cols;

  // pixel data for 3D texture
  const volume = new Typed(sliceSize * depth);

  for (let z = 0; z < depth; z++) {
    const pd = images[z].getPixelData(); // Typed array
    if (pd.length !== sliceSize) {
      throw new Error(`Unexpected pixels in slice ${z}: ${pd.length} != ${sliceSize}`);
    }
    volume.set(pd, z * sliceSize);
  }

  // Optional spacing/geometry
  const plane = cornerstone.metaData.get('imagePlaneModule', imageIds[0]) || {};
  const spacing = [
    plane.columnPixelSpacing ?? 1, // dx
    plane.rowPixelSpacing ?? 1,    // dy
    (depth > 1 ? Math.abs(
      (cornerstone.metaData.get('imagePositionPatient', imageIds[1])?.[2] ?? 0) -
      (cornerstone.metaData.get('imagePositionPatient', imageIds[0])?.[2] ?? 0)
    ) : (cornerstone.metaData.get('sliceThickness', imageIds[0]) ?? 1)) || 1, // dz
  ];

  return {
    dimensions: {
      rows,
      cols,
      depth,
    },
    bitsAllocated,
    pixelRepresentation,
    spacing,
    imageIds,
    volume,
  };
}
