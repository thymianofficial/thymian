// A .d.ts file whose contents are valid TypeScript exporting a rule — it
// must be declined as a declaration file regardless of contents, never
// loaded, and never reported as "does not use default export".
declare const rule: {
  meta: {
    name: 'declaration-rule';
    severity: 'error';
    type: [];
    tags: [];
    options: Record<string, never>;
  };
};

export default rule;
