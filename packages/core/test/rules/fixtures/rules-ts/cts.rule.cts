// Fixture: explicit CommonJS TypeScript extension, using `export default` — the shape this seam
// supports. `module.exports =` in a `.cts` file is a documented limitation of the seam (jiti's
// interop cannot tell it apart from a named-only module), not a bug in this loader.
import { constant, httpRule } from '@thymian/core';

interface Marker {
  readonly name: string;
}

const marker: Marker = { name: 'cts-ts' };

export default httpRule(marker.name)
  .severity('error')
  .type('test', 'analytics')
  .rule((ctx) => ctx.validateCommonHttpTransactions(constant(true)))
  .done();
