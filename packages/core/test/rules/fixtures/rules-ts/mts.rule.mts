// Fixture: explicit ESM TypeScript extension.
import { constant, httpRule } from '@thymian/core';

interface Marker {
  readonly name: string;
}

const marker: Marker = { name: 'mts-ts' };

export default httpRule(marker.name)
  .severity('error')
  .type('test', 'analytics')
  .rule((ctx) => ctx.validateCommonHttpTransactions(constant(true)))
  .done();
