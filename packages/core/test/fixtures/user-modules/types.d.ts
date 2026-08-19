// Fixture: a declaration file. jiti resolves and imports this successfully as an *empty* module,
// so `resolveUserModule` must decline it outright rather than let a confusing
// "does not use default export" error reach the user.
declare const declaredMarker: string;

export default declaredMarker;
