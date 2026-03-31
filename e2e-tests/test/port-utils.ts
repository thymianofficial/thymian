import { type AddressInfo, createServer } from 'node:net';

export function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();

    server.once('error', (error: Error) => {
      server.close(() => reject(error));
    });

    server.listen(0, () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() =>
          reject(new Error('Unable to determine server address')),
        );
        return;
      }
      const { port } = address as AddressInfo;
      server.close(() => resolve(port));
    });
  });
}
