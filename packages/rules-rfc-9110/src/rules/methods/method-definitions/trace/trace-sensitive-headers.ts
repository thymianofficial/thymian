// Header field names that are likely to carry sensitive data. Shared by the two
// TRACE security rules so the list cannot drift between them: a client MUST NOT
// generate these in a TRACE request, and the final recipient SHOULD NOT echo
// them back in the reflected response content.
export const sensitiveHeaders = [
  'authorization',
  'proxy-authorization',
  'cookie',
  'x-api-key',
];
