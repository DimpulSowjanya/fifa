// Base URL of the FanCompass backend API.
// Set NEXT_PUBLIC_API_URL in Vercel project settings (frontend project) to your
// deployed backend URL, e.g. https://fancompass-backend.vercel.app
// Falls back to localhost for local development.
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
