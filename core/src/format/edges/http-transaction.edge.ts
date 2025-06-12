// request -> response
import type { ThymianBaseEdge } from './edge.js';

export interface HttpTransaction extends ThymianBaseEdge {
  type: 'http-transaction';
}
