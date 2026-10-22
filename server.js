import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { config } from './server/config.js';
import { apiRouter } from './server/routes/api.js';
import { openaiRouter } from './server/routes/openai.js';
import { proxiesRouter } from './server/routes/proxies.js';
import { closeAllClients } from './server/services/sse.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Security & Core Middleware
app.use(cors());
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Mount Application Routes
app.use(apiRouter);
app.use('/openai', openaiRouter);
app.use(proxiesRouter);

// Static File Serving
// Prioritizes Vite production bundle (dist/) when available, falling back to public/ or root
const staticDir = fs.existsSync(config.paths.dist)
  ? config.paths.dist
  : (fs.existsSync(config.paths.public) ? config.paths.public : config.paths.root);

app.use(express.static(staticDir, {
  setHeaders: (res, filepath) => {
    if (filepath.endsWith('.mjs')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

// Also serve public/ if dist is active so direct asset requests succeed
if (fs.existsSync(config.paths.dist) && fs.existsSync(config.paths.public)) {
  app.use(express.static(config.paths.public));
}

// 404 Not Found Handler for unmatched routes
app.use((req, res) => {
  if (req.accepts('json')) {
    return res.status(404).json({
      error: 'Not Found',
      path: req.originalUrl || req.url,
      message: 'The requested endpoint does not exist. See GET /api/status for available endpoints.'
    });
  }
  res.status(404).send('Not Found');
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err.stack || err.message);
  res.status(500).json({ error: { message: err.message || 'Internal server error' } });
});

// Start Server (only when not running inside a serverless platform like Vercel)
let server;
if (!process.env.VERCEL) {
  server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`TalkingHead service running at http://localhost:${config.port}`);
  });
}

// Graceful Shutdown
function handleShutdown(signal) {
  console.log(`\n[Server] Received ${signal}, closing gracefully...`);
  closeAllClients();
  if (server) {
    server.close(() => {
      console.log('[Server] Server closed cleanly.');
      process.exit(0);
    });
  }
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

export default app;
