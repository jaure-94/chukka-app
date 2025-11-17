import type { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import cookieParser from 'cookie-parser';
import { registerRoutes } from '../server/routes.js';
import { serveStatic } from '../server/vite.js';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Initialize routes (cache the initialized app)
let appInitialized = false;

async function initializeApp() {
  if (appInitialized) return;
  
  // Register routes (we ignore the Server return value for Vercel)
  await registerRoutes(app);
  
  // Serve static files in production
  serveStatic(app);
  
  appInitialized = true;
}

// Vercel serverless function handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Initialize app with error handling
    try {
      await initializeApp();
    } catch (initError) {
      console.error('Failed to initialize app:', initError);
      return res.status(500).json({ 
        error: 'Initialization failed',
        message: initError instanceof Error ? initError.message : 'Unknown error',
        details: process.env.NODE_ENV === 'development' ? String(initError) : undefined
      });
    }
    
    // Convert Vercel request/response to Express-compatible format
    return new Promise<void>((resolve) => {
      try {
        // Create Express-compatible request/response objects
        const expressReq = Object.assign(req, {
          protocol: req.headers['x-forwarded-proto'] || 'https',
          secure: req.headers['x-forwarded-proto'] === 'https',
          ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '',
          ips: [],
          subdomains: [],
          hostname: req.headers.host?.split(':')[0] || '',
        }) as any;
        
        const expressRes = Object.assign(res, {
          locals: {},
        }) as any;
        
        // Set up response completion handlers
        const originalEnd = res.end.bind(res);
        res.end = function(chunk?: any, encoding?: any, cb?: any) {
          originalEnd(chunk, encoding, cb);
          resolve();
          return res;
        };
        
        // Handle the request with Express
        app(expressReq, expressRes, (err?: any) => {
          if (err) {
            console.error('Express error:', err);
            console.error('Error stack:', err?.stack);
            if (!res.headersSent) {
              res.status(500).json({ 
                message: 'Internal server error',
                error: err?.message || 'Unknown error'
              });
            }
            resolve();
          } else if (!res.headersSent) {
            res.status(404).json({ message: 'Not found' });
            resolve();
          }
        });
      } catch (error) {
        console.error('Handler error:', error);
        if (!res.headersSent) {
          res.status(500).json({ 
            message: 'Handler error',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
        resolve();
      }
    });
  } catch (error) {
    console.error('Top-level handler error:', error);
    if (!res.headersSent) {
      return res.status(500).json({ 
        message: 'Server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

