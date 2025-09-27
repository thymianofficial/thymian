// sample request -> sample response
import type { ThymianBaseEdge } from './edge.js';

export interface SampleHttpTransaction extends ThymianBaseEdge {
  type: 'sample-http-transaction';
}
