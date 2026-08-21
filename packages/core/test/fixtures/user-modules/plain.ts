// Fixture: the ordinary TypeScript case. Interfaces and annotations are erasable syntax, so this
// is the one shape native Node type stripping could also have handled.
interface Marker {
  readonly value: string;
}

const marker: Marker = { value: 'plain-ts' };

export default marker.value;
