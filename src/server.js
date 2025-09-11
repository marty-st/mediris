'use strict'

import parseDicomFolder from "./file/dicom.js";

/**
 * Code from: https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Server-side/Node_server_without_framework
 * Modifications:
 * - STATIC_PATH is the root folder
 * - Removed need for 404.html
 * - Comment out console logging for loading resources (files)
 */

import * as fs from "node:fs";
import * as http from "node:http";
import * as path from "node:path";

const PORT = 3005;

const MIME_TYPES = {
  default: "application/octet-stream",
  html: "text/html; charset=UTF-8",
  js: "application/javascript",
  mjs: "application/javascript",
  css: "text/css",
  png: "image/png",
  jpg: "image/jpeg",
  gif: "image/gif",
  ico: "image/x-icon",
  svg: "image/svg+xml",
};

// serve from project root instead of public/ folder
const STATIC_PATH = process.cwd();

const toBool = [() => true, () => false];

const prepareFile = async (url) => {
  const paths = [STATIC_PATH, url];
  if (url.endsWith("/")) paths.push("index.html");
  const filePath = path.join(...paths);
  const pathTraversal = !filePath.startsWith(STATIC_PATH);
  const exists = await fs.promises.access(filePath).then(...toBool);
  const found = !pathTraversal && exists;

  if (!found)
    return { found: false };

  // const streamPath = found ? filePath : `${STATIC_PATH}/404.html`;
  const ext = path.extname(filePath).substring(1).toLowerCase();
  const stream = fs.createReadStream(filePath);
  return { found: true, ext, stream };
};

http
  .createServer(async (req, res) => {
    const file = await prepareFile(req.url);

    const statusCodeSuccess = 200;
    const statusCodeFail = 404;

    if (!file.found) {
      res.writeHead(statusCodeFail, { "Content-Type": "text/plain" });
      res.end(statusCodeFail + " Not Found");
      // UNCOMMENT FOR DEBUGGING FILE LOADING
      // console.log(`${req.method} ${req.url} ${statusCodeFail}`);
      return;
    }

    const mimeType = MIME_TYPES[file.ext] || MIME_TYPES.default;
    res.writeHead(statusCodeSuccess, { "Content-Type": mimeType });
    file.stream.pipe(res);
    // UNCOMMENT FOR DEBUGGING FILE LOADING
    // console.log(`${req.method} ${req.url} ${statusCodeSuccess}`);
  })
  .listen(PORT);

console.log(`Server running at http://127.0.0.1:${PORT}/`);
