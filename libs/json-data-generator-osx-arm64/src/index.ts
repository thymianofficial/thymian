import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export class JsonDataServer {
  private initialized = false;
  private readonly signal: AbortSignal;
  private readonly port;

  constructor(signal: AbortSignal, port = 44444) {
    if (port > 65535) {
      throw new Error('Port must be less than 65535');
    }

    this.port = port;
    this.signal = signal;
  }

  init(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const cliPath = path.resolve(__dirname, '../bin/thymian');

        const child = spawn(cliPath, [`--port=${this.port}`], {
          signal: this.signal,
        });

        child.stdout?.on('data', (data) => {
          const str = data.toString();

          if (str.includes('Thymian JSON Data Generator started.')) {
            this.initialized = true;
            resolve();
          } else if (str.includes('Thymian JSON Data Generator stopped.')) {
            reject('Thymian JSON Data Generator stopped.');
          }
        });

        child.on('error', (err) => {
          reject(err);
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  async request<T = unknown>(schema: Record<PropertyKey, unknown>): Promise<T> {
    if (!this.initialized) {
      await this.init();
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const response = await fetch(`http://localhost:${this.port}/generate`, {
      method: 'POST',
      body: JSON.stringify(schema),
    });

    return await response.json();
  }
}
