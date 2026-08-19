// Fixture: non-erasable syntax. An `enum` emits a runtime object, so type stripping can never
// support this file — it is the case that requires a real transform (jiti).
export enum Flavour {
  Thyme = 'thyme',
}

export default Flavour.Thyme;
