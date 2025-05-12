import type { HttpRequest } from '../request.js';
import type { RequestGenerator } from './request-generator.js';

export const generate200Request: RequestGenerator = ({ response, request }) => {
  return {
    protocol: 'http',
  } as HttpRequest;
};
