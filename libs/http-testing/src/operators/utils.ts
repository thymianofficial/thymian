import { isRecord } from '../utils.js';

export function hasOwnProperty<
  T extends Record<PropertyKey, unknown>,
  K extends PropertyKey
>(obj: T, key: K): obj is T & Record<K, unknown> {
  return Object.hasOwn(obj, key);
}

export function hasThymianReqId(
  value: unknown
): value is Record<PropertyKey, unknown> & { thymianReqId: string } {
  return isRecord(value) && 'thymianReqId' in value;
}

export function hasThymianResId(
  value: unknown
): value is Record<PropertyKey, unknown> & { thymianResId: string } {
  return isRecord(value) && 'thymianResId' in value;
}
