'use strict'

import { promises as fs } from 'node:fs';
import path from 'node:path';

const dataPath = './public/data/';
const urlBase = '/data/'

/**
 * 
 * @param {*} folderPath relative path to the folder containing DICOM data
 * @returns an array of file names that have the .dcm suffix
 */
async function readDicomFileNames(folderPath)
{
  const entries = await fs.readdir(folderPath, { withFileTypes: true });

  const files = entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.dcm'))
    .map((e) => e.name)
    .sort();

    return files;
}

/**
 * 
 * @param {*} folderName direct name of the folder containing DICOM data
 * @returns an URL path to the target folder usable by the client-side code base when fetching.
 */
function createFolderURL(folderName) 
{
  return`${urlBase}${folderName}`.replace(/\\/g, '/');
}

/**
 * Function exposed to the server
 * @param {*} folderName direct name of the folder containing DICOM data
 * @returns `folderInfo` - contains folder name, file count, array of file names, folder path string for client-side access.
 */
export default async function getDicomFolderInfo(folderName)
{
  const folderPath = path.join(dataPath, folderName); 

  const files = await readDicomFileNames(folderPath);

  const folderURL = createFolderURL(folderName);

  return {
    folder: folderName,
    fileCount: files.length,
    files,
    folderURL,
  };
}
