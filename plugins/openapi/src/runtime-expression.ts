export type HeaderReference = `header.${string}`;
export type QueryReference = `query.${string}`;
export type PathReference = `path.${string}`;
export type JsonPointer = `${'/'}${string}`;
export type BodyReference = `body${`#${JsonPointer}` | ''}`;
export type Source =
  | HeaderReference
  | QueryReference
  | PathReference
  | BodyReference;

export type RunExpression =
  | `$url`
  | `$method`
  | `$statusCode`
  | `$request.${Source}`
  | `$response.${Source}`;
