import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import app from './app.js';

const PORT = process.env.PORT || 8080;

// Resolve directories for static files (Frontend builds)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In a unified container build (e.g. Docker/Cloud Run), the Next.js static
// export lives here and gets served alongside the API. Not used when
// deploying frontend and backend as separate Vercel projects.
const clientBuildPath = path.join(__dirname, '../../frontend/out');
app.use(express.static(clientBuildPath));

// Fallback all non-API paths to serve the Next.js single-page app index.html
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});

// Run server (local dev / Docker only — Vercel uses backend/api/index.js instead)
app.listen(PORT, () => {
  console.log(`FanCompass AI Server is running on port ${PORT}`);
  console.log(`Database adapter loaded in: ${process.env.FIREBASE_SERVICE_ACCOUNT ? 'Firestore mode' : 'Local In-Memory fallback'}`);
});
