import type { HttpResponse } from '../../http.js';
import type { ThymianBaseNode } from './node.js';

export interface SampleHttpResponse extends ThymianBaseNode {
  type: 'sample-http-response';
  sample: HttpResponse;
}
