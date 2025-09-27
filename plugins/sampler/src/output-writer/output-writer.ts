import type { HttpRequestSample } from '../http-request-sample.js';

export interface OutputWriter {
  writeSample(sample: HttpRequestSample): Promise<string>;
  writeAssetFor(
    buffer: Buffer,
    ext: string,
    sample: HttpRequestSample,
  ): Promise<string>;
}
