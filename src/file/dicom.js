'use strict'

const dataPath = '../../public/data';

// load the file dropped on the element and then call parseByteArray with a
// Uint8Array containing the files contents
function loadFile(file)
{
  var reader = new FileReader();
  reader.onload = function(file) {
    var arrayBuffer = reader.result;
    // Here we have the file data as an ArrayBuffer.  dicomParser requires as input a
    // Uint8Array so we create that here
    var byteArray = new Uint8Array(arrayBuffer);
    parseByteArray(byteArray);
  }
  reader.readAsArrayBuffer(file);

  return reader.result;
}

export default async function parseDicomFolder(dataFolder)
{
  console.log(dicomParser);
  const fs = require('fs');
  const dicomData = fs.readFileSync(dataPath + dataFolder + '/IM-0003-0001.dcm');
  // const rawFile = loadFile(dataPath + dataFolder + "IM-0003-0001");
  // const result = dicomParser.parseDicom(rawFile);

  // console.log(result);

}