// Real-Time Server-Sent Events (SSE) Manager for TalkingHead
export const sseClients = new Set();

/**
 * Broadcast an event payload to all connected TalkingHead avatar browser sessions.
 * @param {string} type - Event type: 'speak', 'gesture', 'mood', 'camera', 'setMode', 'stop'
 * @param {object} payload - Additional event parameters
 * @returns {number} Count of successfully notified clients
 */
export function broadcastEvent(type, payload = {}) {
  const message = `data: ${JSON.stringify({ type, ...payload, timestamp: Date.now() })}\n\n`;
  let notified = 0;

  for (const client of sseClients) {
    try {
      if (client.res.writableEnded || client.res.destroyed) {
        sseClients.delete(client);
        continue;
      }
      client.res.write(message);
      notified++;
    } catch {
      sseClients.delete(client);
    }
  }
  return notified;
}

/**
 * Register a new incoming SSE client response stream.
 * @param {object} req - Express request
 * @param {object} res - Express response
 */
export function handleSSEConnection(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  if (res.flushHeaders) res.flushHeaders();

  const clientId = Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);
  const client = { id: clientId, res };
  sseClients.add(client);

  console.log(`[Service] Avatar client connected (${clientId}). Active: ${sseClients.size}`);
  res.write(`data: ${JSON.stringify({ type: 'connected', clientId, activeClients: sseClients.size })}\n\n`);

  const heartbeat = setInterval(() => {
    try {
      if (res.writableEnded || res.destroyed) {
        clearInterval(heartbeat);
        sseClients.delete(client);
        return;
      }
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
      sseClients.delete(client);
    }
  }, 25000);

  const cleanup = () => {
    clearInterval(heartbeat);
    sseClients.delete(client);
    console.log(`[Service] Avatar client disconnected (${clientId}). Active: ${sseClients.size}`);
  };

  req.on('close', cleanup);
  req.on('error', cleanup);
  res.on('error', cleanup);
}

/**
 * Gracefully close all open SSE streams on server shutdown.
 */
export function closeAllClients() {
  for (const client of sseClients) {
    try { client.res.end(); } catch {}
  }
  sseClients.clear();
}
