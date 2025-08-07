import { join } from 'node:path';

import type { ThymianHttpTransaction } from '@thymian/core';

export function createPathForTransaction(
  transaction: ThymianHttpTransaction
): string {
  const paths: string[] = [];

  paths.push(transaction.thymianReq.method.toLowerCase());

  paths.push(
    ...transaction.thymianReq.path
      .split('/')
      .map((part) =>
        /^\{.*}$/.test(part) ? '_' + part.substring(1, part.length - 1) : part
      )
  );

  if (transaction.thymianReq.mediaType) {
    paths.push(transaction.thymianReq.mediaType.replaceAll('/', '__'));
  }

  paths.push(transaction.thymianRes.statusCode.toString());

  if (transaction.thymianRes.mediaType) {
    paths.push(transaction.thymianRes.mediaType.replaceAll('/', '__'));
  }

  return join(...paths);
}
