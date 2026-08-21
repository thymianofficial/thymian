// Fixture: a declaration file whose extension is upper-case throughout. Pins the precedence — this
// is refused for containing no runtime code, which stays true whatever its casing, and must NOT be
// reported as a casing mistake (#690).
declare const upperDeclMarker: string;

export default upperDeclMarker;
