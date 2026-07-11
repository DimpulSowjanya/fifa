import app from '../src/app.js';

// Vercel wraps this exported Express app as a serverless function.
// All requests to the backend Vercel project (any path) are routed here
// via backend/vercel.json, and Express's own /api router inside app.js
// handles the actual routing.
export default app;
