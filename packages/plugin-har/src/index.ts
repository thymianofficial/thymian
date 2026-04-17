import type {
  CapturedTransaction,
  HttpParticipantRole,
  Logger,
  ThymianPlugin,
} from '@thymian/core';

import { loadTransactionsFromHar } from './load-transactions.js';

/** 50 MB — covers typical browser DevTools HAR exports. */
const DEFAULT_MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export type HarPluginOptions = {
  /**
   * Maximum allowed HAR file size in bytes.
   * Files exceeding this limit cause a `ThymianBaseError` to be thrown.
   * @default 52_428_800 (50 MB)
   */
  maxFileSize?: number;

  /**
   * The HTTP participant role to assign to requests loaded from HAR files.
   * This determines which RFC rules apply to the client side of the loaded traffic.
   * @default 'user-agent'
   */
  clientRole?: HttpParticipantRole;

  /**
   * The HTTP participant role to assign to responses loaded from HAR files.
   * This determines which RFC rules apply to the server side of the loaded traffic.
   * @default 'origin server'
   */
  serverRole?: HttpParticipantRole;
};

export function createHarPlugin(
  pluginName = '@thymian/plugin-har',
): ThymianPlugin<HarPluginOptions> {
  return {
    name: pluginName,
    version: '0.x',
    options: {
      type: 'object',
      nullable: true,
      properties: {
        maxFileSize: { type: 'number', nullable: true },
        clientRole: {
          type: 'string',
          nullable: true,
          default: 'user-agent',
          enum: [
            'intermediary',
            'proxy',
            'gateway',
            'tunnel',
            'origin server',
            'server',
            'client',
            'user-agent',
            'cache',
          ],
        },
        serverRole: {
          type: 'string',
          nullable: true,
          default: 'origin server',
          enum: [
            'intermediary',
            'proxy',
            'gateway',
            'tunnel',
            'origin server',
            'server',
            'client',
            'user-agent',
            'cache',
          ],
        },
      },
      additionalProperties: false,
    },
    actions: {
      listensOn: ['core.traffic.load'],
    },
    async plugin(emitter, logger: Logger, options) {
      const maxFileSize = options.maxFileSize ?? DEFAULT_MAX_FILE_SIZE_BYTES;
      const clientRole: HttpParticipantRole =
        options.clientRole ?? 'user-agent';
      const serverRole: HttpParticipantRole =
        options.serverRole ?? 'origin server';

      emitter.onAction('core.traffic.load', async (input, ctx) => {
        const harInputs = input.inputs.filter((i) => i.type === 'har');

        if (harInputs.length === 0) {
          logger.info('No HAR inputs found, skipping HAR processing.');
          return ctx.reply({ transactions: [] });
        }

        const allTransactions: CapturedTransaction[] = [];

        for (const harInput of harInputs) {
          logger.info(
            `Loading traffic from HAR file: ${String(harInput.location)}`,
          );

          const transactions = await loadTransactionsFromHar(
            String(harInput.location),
            logger,
            options.cwd,
            maxFileSize,
            clientRole,
            serverRole,
          );

          // Avoid spread (`allTransactions.push(...transactions)`) because
          // large HAR files can contain thousands of entries, which would
          // exceed the JavaScript call-stack size limit.
          for (const t of transactions) {
            allTransactions.push(t);
          }
        }

        ctx.reply({ transactions: allTransactions });
      });
    },
  };
}

export const harPlugin = createHarPlugin();

export default harPlugin;
