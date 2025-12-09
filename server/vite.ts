import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { type Server } from "http";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  // Lazy-load Vite dependencies only in development
  const { createServer: createViteServer, createLogger } = await import("vite");
  const viteConfig = await import("../vite.config.js");
  const { nanoid } = await import("nanoid");
  
  const viteLogger = createLogger();
  
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    // Allow access from local network (for mobile device testing)
    // In production, this is not used as Vite is only for development
    // Using 'all' allows connections from any host on the local network
    allowedHosts: "all",
  };

  const vite = await createViteServer({
    ...viteConfig.default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        __dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      const { nanoid } = await import("nanoid");
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  // On Vercel, static files are served from dist/public (configured in vercel.json)
  // For serverless functions, we need to find the correct path
  // Try multiple possible locations
  const possiblePaths = [
    path.resolve(process.cwd(), "dist", "public"), // Vercel build output
    path.resolve(__dirname, "..", "..", "dist", "public"), // From compiled server location
    path.resolve(__dirname, "public"), // Legacy location
  ];

  let distPath: string | null = null;
  for (const possiblePath of possiblePaths) {
    if (fs.existsSync(possiblePath)) {
      distPath = possiblePath;
      break;
    }
  }

  if (!distPath) {
    // On Vercel, static files are handled by the platform, so we can skip this
    // Only log a warning instead of throwing an error
    console.warn("Static files directory not found. On Vercel, static files are served automatically.");
    return;
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist (for SPA routing)
  app.use("*", (_req, res) => {
    const indexPath = path.resolve(distPath!, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).json({ message: "Not found" });
    }
  });
}
