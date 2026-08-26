// Public subpath entry — `@thymian/core/user-module` — exposing ONLY the
// resolver/loader entry points for cross-package consumers (the CLI plugin
// loader in @thymian/common-cli is the second consumer of this seam; the rule
// loader inside @thymian/core imports it directly by relative path).
//
// The `unloadableReason` / `miscasedExtension` predicates are deliberately NOT
// re-exported here: they stay intra-package. The main barrel (`./index.ts`)
// exposes none of the seam at all, so this dedicated subpath is the sanctioned
// way to give a second package the loader without hand-copying it.
export {
  isLocalSpecifier,
  loadUserModule,
  resolveUserModule,
  type UserModuleResolution,
} from './load-user-module.js';
