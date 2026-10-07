# Context Map

The index of this project's package contexts. The project glossary is
[`CONTEXT.md`](./CONTEXT.md); above it sits the workspace's shared glossary, which neither
this file nor anything below it may redefine.

Read from the outside in: workspace `CONTEXT.md` → this project's `CONTEXT.md` → the package
context, if the package you are in has one.

## Contexts

- [Sampler](./packages/plugin-sampler/CONTEXT.md) (`packages/plugin-sampler`): the vocabulary
  of authoring hooks — what a hook is, how it is aimed, and what a transaction earned once it
  ran.

No other package has one yet, and most will not need one. A package earns a context when it
introduces vocabulary a user or a neighbouring package has to name and the project glossary
does not already carry. Until then, the project `CONTEXT.md` is the whole answer.

## Relationships

- **plugin-sampler → core**: the sampler answers `core.request.sample`, and reaches the
  dispatcher through `core.request.dispatch`. `Selector` rendering is core's
  (`packages/core/src/selector/`), which is why the term is defined in the project glossary
  rather than here — see
  [ADR-0022](./docs/arc42/adr/0022-selector-is-the-transaction-label.md), which makes the
  selector the transaction's label application-wide.
- **plugin-sampler → plugin-http-tester**: the hook lifecycle is the tester's. The sampler
  listens on `http-testing.beforeRequest`, `http-testing.afterResponse` and
  `http-testing.authorize` and runs the user's hooks in response; it does not own the run.
  So a `Hook` is package vocabulary while the run it shapes is not.
