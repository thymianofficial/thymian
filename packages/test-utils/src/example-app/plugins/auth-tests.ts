import type { FastifyInstance } from 'fastify';

/**
 * Authentication testing endpoints for RFC 9110 Section 11 compliance
 *
 * This plugin provides test endpoints to validate HTTP authentication rules:
 * - Rule 1: Parameter name uniqueness
 * - Rule 2: 401 responses must include WWW-Authenticate
 * - Rule 4: Invalid credentials should return 401
 * - Rule 6: Realm parameter must use quoted-string syntax
 * - Rule 7: WWW-Authenticate may appear in non-401 responses
 *
 * Each endpoint tests specific valid or invalid authentication scenarios.
 */
export default async function authTests(fastify: FastifyInstance) {
  // ==========================================================================
  // Rule 2: 401 Response Must Include WWW-Authenticate
  // RFC 9110 Section 11.6.1
  // ==========================================================================

  /**
   * ✅ VALID: 401 with proper WWW-Authenticate header
   * Tests: Rule 2 - valid case
   */
  fastify.get('/valid-401', async (_request, reply) => {
    return reply
      .status(401)
      .header('www-authenticate', 'Basic realm="test"')
      .send({ error: 'Unauthorized' });
  });

  /**
   * ❌ INVALID: 401 without WWW-Authenticate header
   * Tests: Rule 2 - violation (MUST include header)
   */
  fastify.get('/invalid-401-missing-header', async (_request, reply) => {
    return reply.status(401).send({ error: 'Unauthorized' });
  });

  /**
   * ❌ INVALID: 401 with empty WWW-Authenticate header
   * Tests: Rule 2 - violation (must contain at least one challenge)
   */
  fastify.get('/invalid-401-empty-header', async (_request, reply) => {
    return reply
      .status(401)
      .header('www-authenticate', '')
      .send({ error: 'Unauthorized' });
  });

  // ==========================================================================
  // Rule 6: Realm Parameter Must Use Quoted-String Syntax
  // RFC 9110 Section 11.5
  // ==========================================================================

  /**
   * ✅ VALID: WWW-Authenticate with quoted realm parameter
   * Tests: Rule 6 - valid case (MUST use quoted-string syntax)
   */
  fastify.get('/valid-realm-quoted', async (_request, reply) => {
    return reply
      .status(401)
      .header('www-authenticate', 'Basic realm="protected area"')
      .send({ error: 'Unauthorized' });
  });

  /**
   * ❌ INVALID: WWW-Authenticate with unquoted realm parameter
   * Tests: Rule 6 - violation (token syntax instead of quoted-string)
   */
  fastify.get('/invalid-realm-unquoted', async (_request, reply) => {
    return reply
      .status(401)
      .header('www-authenticate', 'Basic realm=test')
      .send({ error: 'Unauthorized' });
  });

  // ==========================================================================
  // Rule 1: Authentication Parameter Name Must Occur Once Per Challenge
  // RFC 9110 Section 11.2
  // ==========================================================================

  /**
   * ❌ INVALID: WWW-Authenticate with duplicate parameter names
   * Tests: Rule 1 - violation (realm appears twice)
   */
  fastify.get('/invalid-duplicate-params', async (_request, reply) => {
    return reply
      .status(401)
      .header(
        'www-authenticate',
        'Digest realm="test", realm="other", nonce="abc123"',
      )
      .send({ error: 'Unauthorized' });
  });

  /**
   * ❌ INVALID: WWW-Authenticate with duplicate parameters (case-insensitive)
   * Tests: Rule 1 - violation (realm and REALM are the same parameter)
   */
  fastify.get('/invalid-duplicate-params-case', async (_request, reply) => {
    return reply
      .status(401)
      .header(
        'www-authenticate',
        'Digest realm="test", REALM="other", nonce="abc123"',
      )
      .send({ error: 'Unauthorized' });
  });

  // ==========================================================================
  // Rule 7: Server May Send WWW-Authenticate in Non-401 Responses
  // RFC 9110 Section 11.6.1
  // ==========================================================================

  /**
   * ℹ️ INFORMATIONAL: 200 response with WWW-Authenticate header
   * Tests: Rule 7 - valid use case (indicating credentials might affect response)
   */
  fastify.get('/valid-200-with-www-auth', async (_request, reply) => {
    return reply
      .status(200)
      .header('www-authenticate', 'Bearer realm="optional"')
      .send({ message: 'Public content, but authenticated users get more' });
  });

  /**
   * ℹ️ INFORMATIONAL: 403 response with WWW-Authenticate header
   * Tests: Rule 7 - valid use case (insufficient permissions, but auth possible)
   */
  fastify.get('/valid-403-with-www-auth', async (_request, reply) => {
    return reply
      .status(403)
      .header('www-authenticate', 'Basic realm="upgrade"')
      .send({ error: 'Forbidden - insufficient permissions' });
  });

  // ==========================================================================
  // Rule 4: Server Should Send 401 for Invalid Credentials
  // RFC 9110 Section 11.4
  // ==========================================================================

  /**
   * ⚠️ WARNING: Returns 403 instead of 401 for invalid credentials
   * Tests: Rule 4 - warning case (SHOULD send 401, not 403)
   */
  fastify.get('/invalid-403-instead-401', async (request, reply) => {
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      // No credentials provided - return 403 instead of 401 (warning)
      return reply.status(403).send({ error: 'Forbidden' });
    }

    // Invalid credentials - still return 403 instead of 401 (warning)
    return reply.status(403).send({ error: 'Forbidden' });
  });

  /**
   * ✅ VALID: Protected endpoint with proper authentication flow
   * Tests: Rules 2 & 4 - valid case
   * - Without auth: returns 401 + WWW-Authenticate
   * - With invalid auth: returns 401 + WWW-Authenticate
   * - With valid auth (matthyk:qupaya): returns 200 OK
   */
  fastify.get('/protected', async (request, reply) => {
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      // No credentials - return 401 with WWW-Authenticate
      return reply
        .status(401)
        .header('www-authenticate', 'Basic realm="protected"')
        .send({ error: 'Unauthorized - credentials required' });
    }

    // Parse Basic auth
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials || '', 'base64').toString(
      'ascii',
    );
    const [username, password] = credentials.split(':');

    // Check credentials (using the same creds as the app-level basic auth)
    if (username === 'matthyk' && password === 'qupaya') {
      return reply.status(200).send({
        message: 'Access granted',
        user: username,
      });
    }

    // Invalid credentials - return 401 with WWW-Authenticate
    return reply
      .status(401)
      .header('www-authenticate', 'Basic realm="protected"')
      .send({ error: 'Unauthorized - invalid credentials' });
  });

  /**
   * ✅ VALID: Multiple WWW-Authenticate challenges
   * Tests: Rule 2 - multiple challenges are allowed
   */
  fastify.get('/valid-multiple-challenges', async (_request, reply) => {
    return reply
      .status(401)
      .header('www-authenticate', 'Basic realm="test"')
      .header('www-authenticate', 'Bearer realm="api"')
      .send({ error: 'Unauthorized' });
  });
}

export const autoPrefix = '/auth-tests';
