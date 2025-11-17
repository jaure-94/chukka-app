import dotenv from "dotenv";

// Load environment variables from .env.local only in development
// In production (Vercel), environment variables are provided via process.env
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: '.env.local' });
}

export const config = {
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT || 5000,
};