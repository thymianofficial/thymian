export function hasOwnProperty<
  T extends Record<PropertyKey, unknown>,
  K extends PropertyKey
>(obj: T, key: K): obj is T & Record<K, unknown> {
  return Object.hasOwn(obj, key);
}
