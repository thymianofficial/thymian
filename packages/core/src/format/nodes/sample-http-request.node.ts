import type { HttpRequest } from '../../http.js';
import type { ThymianBaseNode } from './node.js';

export interface SampleHttpRequest extends ThymianBaseNode {
  type: 'sample-http-request';
  sample: HttpRequest;
}
