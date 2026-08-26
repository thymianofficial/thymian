import baseConfig from '../../eslint.config.mjs';

/**
 * The lint half of closing the unguarded-user-value class (story 575.9).
 *
 * `src/hooks/user-value.ts` explains the whole mechanism; the short version is
 * that a value which came out of a user's hook file can throw on any operation,
 * and three review rounds each guarded the instances they found and left the
 * next one to be found by the round after. TypeScript closes most of it — the
 * opaque `UserValue` type has no readable members and cannot be narrowed by
 * `instanceof` — but it cannot close two things:
 *
 * - a cast, `(value as { kind: string }).kind`, which is how the *type* half is
 *   escaped;
 * - the globals that accept an unconstrained value and still throw. Those are a
 *   short, closed list, and every one of them has produced a defect here:
 *   `Array.isArray` throws on a revoked Proxy (round 3), `String` runs three
 *   user-written coercion hooks (round 2), `Object.keys` runs an `ownKeys` trap
 *   (round 1), and `JSON.stringify` walks whatever `toJSON` and `get` traps it
 *   finds (round 2).
 *
 * What these rules actually buy, stated honestly because the first version of
 * this comment overstated it and a review measured the gap: they close the
 * *shapes below*, which is every shape that had produced a defect plus every one
 * a probe found reachable. They do **not** make an unguarded read impossible.
 * A syntactic rule cannot: moving the read into a helper, or splitting
 * `(v as T).k` across two statements, escapes any selector list. What the rules
 * do is remove every shape that is shorter or more natural than calling
 * `user-value.ts`, so the guarded path is the path of least resistance and the
 * escape hatches are all deliberate, visible and greppable.
 *
 * They are syntactic because this repo configures no type-aware linting; that is
 * why the opaque `UserValue` type exists alongside them rather than instead of
 * them. Together the type stops the reads and the rules stop the shortcuts.
 */
const guardedUserValueReads = [
  {
    selector:
      "CallExpression[callee.object.name='Array'][callee.property.name='isArray']",
    message:
      "Array.isArray throws on a revoked Proxy. Use isArrayValue() from './user-value.js' and report the failed read.",
  },
  {
    selector: "CallExpression[callee.name='String']",
    message:
      "String() runs Symbol.toPrimitive, toString and valueOf — all user code. Use safeString() from './user-value.js'.",
  },
  {
    selector:
      "CallExpression[callee.object.name='Object'][callee.property.name=/^(keys|values|entries|fromEntries|assign|getOwnPropertyNames|getOwnPropertyDescriptor|getOwnPropertyDescriptors|getOwnPropertySymbols|getPrototypeOf|hasOwn|groupBy)$/]",
    message:
      "Enumerating a user value runs its ownKeys and getOwnPropertyDescriptor traps. Use ownKeys() from './user-value.js'.",
  },
  {
    selector:
      "CallExpression[callee.object.name='JSON'][callee.property.name='stringify']",
    message:
      "JSON.stringify throws on a circular structure and runs any toJSON it walks into. Use safeJson() from './user-value.js'.",
  },
  {
    selector: "MemberExpression[object.type='TSAsExpression']",
    message:
      "Casting and then reading is how a user value escapes the UserValue type. Use readProperty()/readProperties()/readIndex() from './user-value.js'.",
  },
  {
    // `${value}` is the idiomatic alternative to the banned `String(value)` and
    // runs exactly the same three coercion hooks — but a blanket ban on
    // interpolation is unusable in a module that builds every diagnostic from
    // template literals, and no syntactic rule can tell a user value from a file
    // key. So the ban is on the one shape that *gets* a user value into an
    // interpolation: `raw()`, which is the only exit from the opaque type.
    // `${raw(v)}` is banned; `${safeString(raw(v))}` is the way through.
    selector: "TemplateLiteral > CallExpression[callee.name='raw']",
    message:
      "Interpolating a raw user value runs Symbol.toPrimitive, toString and valueOf. Wrap it: `${safeString(raw(value))}`.",
  },
  {
    selector: "CallExpression[callee.name='Number']",
    message:
      "Number() runs Symbol.toPrimitive, the same user code String() does. Use asFiniteNumber() from './user-value.js'.",
  },
  {
    selector: "CallExpression[callee.object.name='Reflect']",
    message:
      "Reflect.* runs the corresponding proxy trap directly. Use the guarded readers in './user-value.js'.",
  },
  {
    // Spreading a **cast** runs whatever `Symbol.iterator` the value carries;
    // spreading a `UserValue` directly is already a type error. `new Set(x)`
    // iterates `x` during construction, so a raw user value handed to one is
    // banned by the `raw()`-argument rule below rather than exempted here.
    selector: "ArrayExpression > SpreadElement[argument.type='TSAsExpression']",
    message:
      "Spreading a cast runs Symbol.iterator, which is user code. Read by index with readIndex() from './user-value.js'.",
  },
  {
    // The one place `raw()` is genuinely dangerous as an *argument*: every one
    // of these iterates or walks what it is given.
    selector:
      "CallExpression[callee.object.name='Array'][callee.property.name='from'] CallExpression[callee.name='raw'], NewExpression[callee.name=/^(Set|Map|WeakSet|WeakMap)$/] CallExpression[callee.name='raw'], CallExpression[callee.name='structuredClone'] CallExpression[callee.name='raw'], CallExpression[callee.object.name='Object'][callee.property.name=/^(freeze|seal|preventExtensions|isFrozen|isSealed|isExtensible)$/] CallExpression[callee.name='raw']",
    message:
      "Iterating or cloning a raw user value runs its Symbol.iterator or every getter it has. Read what you need with './user-value.js'.",
  },
  {
    selector: 'ObjectPattern > RestElement',
    message:
      "Rest destructuring runs the ownKeys trap and a get trap per key. Use ownKeys()/readProperty() from './user-value.js'.",
  },
  {
    selector: 'ForInStatement',
    message:
      "for…in runs the ownKeys trap. Use ownKeys() from './user-value.js'.",
  },
  {
    selector: "BinaryExpression[operator='in']",
    message:
      "`in` runs the has trap — the same shape as the banned instanceof, on the same node type. Use readProperty()/ownKeys() from './user-value.js'.",
  },
  {
    // Not a blanket ban: `for (const x of value)` where `value` is a `UserValue`
    // is already a **type** error, because the opaque type has no
    // `Symbol.iterator`. A cast is the escape, so a cast is what is banned.
    selector: "ForOfStatement[right.type='TSAsExpression']",
    message:
      "for…of over a cast runs Symbol.iterator, which is user code. Read by index with readIndex() from './user-value.js'.",
  },
  {
    selector:
      "VariableDeclarator[id.type='ArrayPattern'][init.type='TSAsExpression']",
    message:
      "Array destructuring a cast runs Symbol.iterator. Read by index with readIndex() from './user-value.js'.",
  },
  {
    selector: 'UnaryExpression[operator="+"]',
    message:
      "Unary + runs Symbol.toPrimitive, the same user code Number() does. Use asFiniteNumber() from './user-value.js'.",
  },
  {
    // Awaiting a value adopts it when it is thenable, which calls a `then` the
    // user wrote — and if that `then` never settles, the scan never returns.
    // Awaiting a *call* is fine: its result is something this module produced.
    selector: "AwaitExpression[argument.type!='CallExpression']",
    message:
      'Awaiting a value adopts it if it is thenable, running a user-written then(). Await a call whose result you control.',
  },
];

export default [
  ...baseConfig,
  {
    // The hook discovery path: everything that reads a value produced by a
    // user's hook file.
    files: ['src/hooks/**/*.ts'],
    ignores: [
      // The one module allowed to perform these operations — that is its whole
      // purpose, and each one there is inside a `try`.
      'src/hooks/user-value.ts',
      // Not on the discovery path: it walks an OpenAPI description the plugin
      // already parsed, not a value a user's hook file produced. Owned by story
      // 575.3; excluded here so this rule cannot force an edit to another
      // story's file. Revisit when that lane lands.
      'src/hooks/generate-request-types.ts',
    ],
    rules: {
      'no-restricted-syntax': ['error', ...guardedUserValueReads],
    },
  },
  {
    // Two more shapes, and only for the scan itself.
    //
    // Both survived the probe that the five rules above were checked with — a
    // deliberate violation of each shape, confirmed rejected, then reverted —
    // and neither is closed by the `UserValue` type:
    //
    // - `value instanceof Error` narrows `UserValue` to `UserValue & Error`, so
    //   `value.message` then type-checks while still running a getter the user
    //   wrote. That is round 3's `messageOf` finding exactly, and it is the one
    //   hole the opaque type does not cover.
    // - `{ ...value }` reads own enumerable properties, so it runs `ownKeys` and
    //   a `get` per key. Object spread compiles for any type.
    //
    // Narrower than the block above on purpose. Both shapes have legitimate uses
    // on the **execution** path — `hook-runner.ts` catches `SkipError`/`FailError`
    // from a user callback, `create-hook-utils.ts` merges caller options — where
    // a throw costs one request rather than destroying a whole scan. That is a
    // different contract, so it gets a different rule rather than an exemption
    // inside this one.
    files: ['src/hooks/load-user-hooks.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...guardedUserValueReads,
        {
          selector: "BinaryExpression[operator='instanceof']",
          message:
            'instanceof narrows a UserValue into something readable, which is how a throwing `message` getter type-checks. Use the typed accessors in ./user-value.js.',
        },
        {
          selector: 'ObjectExpression > SpreadElement',
          message:
            'Spreading a user value runs its ownKeys trap and a get trap per key. Build the object whole, or use readProperties() from ./user-value.js.',
        },
      ],
    },
  },
  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          ignoredFiles: ['{projectRoot}/eslint.config.{js,cjs,mjs}'],
          ignoredDependencies: ['vitest', 'tslib'],
        },
      ],
    },
    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },
];
