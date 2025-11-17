import type { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import cookieParser from 'cookie-parser';
import { registerRoutes } from '../server/routes';
import { serveStatic } from '../server/vite';

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
  await initializeApp();
  
  // Convert Vercel request/response to Express-compatible format
  return new Promise<void>((resolve) => {
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
        if (!res.headersSent) {
          res.status(500).json({ message: 'Internal server error' });
        }
        resolve();
      } else if (!res.headersSent) {
        res.status(404).json({ message: 'Not found' });
        resolve();
      }
    });
  });
}

