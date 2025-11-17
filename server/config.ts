import dotenv from "dotenv";
import fs from "fs";

// Load environment variables from .env.local only if file exists (development)
// In production (Vercel), environment variables are provided via process.env
const envLocalPath = '.env.local';
if (fs.existsSync(envLocalPath) && process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: envLocalPath });
}

export const config = {
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT || 5000,
};

// Log environment status (without exposing secrets)
if (process.env.NODE_ENV === 'production') {
  console.log('Production mode - DATABASE_URL:', config.DATABASE_URL ? 'SET' : 'MISSING');
  console.log('Production mode - JWT_SECRET:', config.JWT_SECRET ? 'SET' : 'MISSING');
}