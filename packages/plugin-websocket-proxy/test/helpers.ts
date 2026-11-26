import { WebSocket } from 'ws';

export function waitForOpen(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    const onOpen = () => {
      cleanup();
      resolve();
    };
    const onError = (err: unknown) => {
      cleanup();
      reject(err);
    };
    const cleanup = () => {
      ws.off('open', onOpen);
      ws.off('error', onError);
    };
    ws.on('open', onOpen);
    ws.on('error', onError);
  });
}

export function nextMessage<T = unknown>(ws: WebSocket): Promise<T> {
  return new Promise((resolve, reject) => {
    const onMessage = (raw: unknown) => {
      cleanup();
      try {
        const parsed = JSON.parse(raw.toString());
        resolve(parsed as T);
      } catch (e) {
        reject(e);
      }
    };
    const onError = (err: unknown) => {
      cleanup();
      reject(err);
    };
    const cleanup = () => {
      ws.off('message', onMessage);
      ws.off('error', onError);
    };
    ws.on('message', onMessage);
    ws.on('error', onError);
  });
}

export function waitForClose(
  ws: WebSocket,
): Promise<{ code: number; reason: string }> {
  return new Promise((resolve) => {
    ws.on('close', (code, reasonBuf) => {
      const reason = reasonBuf?.toString?.() ?? '';
      resolve({ code, reason });
    });
  });
}

/**
 * Resolves with the HTTP status code the server answered the upgrade request
 * with, if it refused to open a WebSocket.
 */
export function waitForRejectedUpgrade(ws: WebSocket): Promise<number> {
  return new Promise((resolve, reject) => {
    ws.on('unexpected-response', (_req, res) => {
      res.resume();
      resolve(res.statusCode ?? 0);
    });
    ws.on('open', () =>
      reject(new Error('Expected the upgrade to be rejected.')),
    );
    ws.on('error', reject);
  });
}

/**
 * Opens a connection, retrying while the server is not listening yet. Needed
 * by tests that connect while `thymian.ready()` is still starting the server.
 */
export async function openWithRetry(
  url: string,
  options: { headers?: Record<string, string> } = {},
  retries = 100,
): Promise<WebSocket> {
  for (let attempt = 0; ; attempt++) {
    const ws = new WebSocket(url, options);

    try {
      await waitForOpen(ws);
      return ws;
    } catch (err) {
      const refused = (err as { code?: string }).code === 'ECONNREFUSED';

      if (!refused || attempt >= retries) {
        throw err;
      }

      await new Promise((r) => setTimeout(r, 10));
    }
  }
}
