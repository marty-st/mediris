import { defineConfig } from 'vite';
import readDicomFileNames from './src/file/dicom.js';

function dicomApi() {
  return {
    name: 'dicom-api',
    configureServer(server) {
      server.middlewares.use('/server/dicom', async (req, res) => {
        try {
          const url = new URL(req.url, 'http://localhost');
          // Hardcoded folder name
          const folder = url.searchParams.get('folder') || 'CT WB w-contrast 5.0 B30s';
          const result = await readDicomFileNames(folder);
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
          // Hardcoded folder name
          const folder = url.searchParams.get('folder') || 'CT WB w-contrast 5.0 B30s';
          const result = await readDicomFileNames(folder);
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