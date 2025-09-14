'use strict'

import { promises as fs } from 'node:fs';
import path from 'node:path';

const dataPath = './public/data/';

/**
 * 
 * @param {*} relativeFolder 
 * @returns 
 */
export default async function getDicomFolderInfo(relativeFolder)
{
  const folderInfo = await readDicomFileNames(relativeFolder);
  // console.log("DICOM folder info: ", folderInfo);
  return folderInfo;
}

/**
 * 
 * @param {*} relativeFolder 
 * @returns 
 */
async function readDicomFileNames(relativeFolder = "") 
{
  const targetFolder = path.join(dataPath, relativeFolder);
  const entries = await fs.readdir(targetFolder, { withFileTypes: true });

  const files = entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.dcm'))
    .map((e) => e.name)
    .sort();

  // const subdirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);

  const webBase = `/data/${relativeFolder}`.replace(/\\/g, '/');

  return {
    folder: relativeFolder,
    fileCount: files.length,
    files,
    webBase,
    // subdirs,
  };
}
