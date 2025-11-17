import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";
import { config } from "./config";

neonConfig.webSocketConstructor = ws;

if (!config.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Create pool with better error handling and retry configuration
export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Add error handling for the pool
pool.on('error', (err: unknown) => {
  if (err instanceof Error) {
    console.error('Database pool error:', err);
  } else {
    console.error('Database pool error:', JSON.stringify(err));
  }
  // Don't crash the application, just log the error
});


// Add connection retry logic
let dbInstance: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!dbInstance) {
    dbInstance = drizzle({ client: pool, schema });
  }
  return dbInstance;
}

// Wrapper function for database operations with retry logic
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Check if it's a connection error that we should retry
      if (
        error instanceof Error &&
        (error.message.includes('terminating connection') ||
         error.message.includes('connection terminated') ||
         error.message.includes('server closed the connection') ||
         error.message.includes('Connection terminated'))
      ) {
        console.warn(`Database operation failed (attempt ${attempt}/${maxRetries}):`, error.message);

        if (attempt < maxRetries) {
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, delay * attempt));
          continue;
        }
      }

      // If it's not a connection error or we've exhausted retries, throw immediately
      throw error;
    }
  }

  throw lastError!;
}

export const db = getDb();
