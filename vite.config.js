import { defineConfig } from 'vite';
import getDicomFolderInfo from './src/file/dicom_server.js';

function dicomApi() {
  return {
    name: 'dicom-api',
    configureServer(server) {
      server.middlewares.use('/server/dicom', async (req, res) => {
        try {
          const url = new URL(req.url, 'http://localhost');
          const folder = url.searchParams.get('folder');
          if (folder === "")
              throw new Error("No DICOM folder name given to read file data from.");

          const result = await getDicomFolderInfo(folder);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result));
        } catch (err) {
          res.statusCode = 500;
          res.end('Error: ' + err.message);
        }
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use('/server/dicom', async (req, res) => {
        try {
          const url = new URL(req.url, 'http://localhost');
          const folder = url.searchParams.get('folder');
          if (folder === "")
              throw new Error("No DICOM folder name given to read file data from.");
            
          const result = await getDicomFolderInfo(folder);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result));
        } catch (err) {
          res.statusCode = 500;
          res.end('Error: ' + err.message);
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [dicomApi()],
});