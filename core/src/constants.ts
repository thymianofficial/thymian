import {
  CookieSerializationStyleBuilder,
  HeaderSerializationStyleBuilder,
  PathSerializationStyleBuilder,
  QuerySerializationStyleBuilder,
} from './format/index.js';

export const DEFAULT_HEADER_SERIALIZATION_STYLE =
  new HeaderSerializationStyleBuilder().build();

export const DEFAULT_QUERY_SERIALIZATION_STYLE =
  new QuerySerializationStyleBuilder().build();

export const DEFAULT_PATH_SERIALIZATION_STYLE =
  new PathSerializationStyleBuilder().build();

export const DEFAULT_COOKIE_SERIALIZATION_STYLE =
  new CookieSerializationStyleBuilder().build();
