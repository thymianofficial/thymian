// AC3 fixture: named-only exports, no `default` at all. Must be rejected —
// no default may be synthesised from these named exports.
export const plugin = async () => undefined;
export const name = 'named-only-plugin';
export const version = '*';
