import dotenv from "dotenv";

// Load environment variables first
dotenv.config();

export const config = {
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT || 5000,
};