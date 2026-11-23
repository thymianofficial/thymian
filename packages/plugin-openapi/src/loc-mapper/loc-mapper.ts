import type {
  ThymianFormatLocation,
  ThymianFormatPosition,
} from '@thymian/core';

export interface LocMapper {
  /**
   * The location of the operation `method` under `paths[pathTemplate]`,
   * following the path item's `$ref`s into the files that hold it.
   */
  locationForOperation(
    pathTemplate: string,
    method: string,
  ): ThymianFormatLocation | undefined;
}

/**
 * One parsed file, as the format adapters (YAML, JSON) expose it.
 * A pointer is a list of already unescaped JSON pointer segments.
 */
export interface LocDocument {
  /** The plain value at `pointer`, or `undefined` if there is none. */
  valueAt(pointer: readonly string[]): unknown;

  /** The position of the key that `pointer`'s last segment names. */
  keyPositionAt(pointer: readonly string[]): ThymianFormatPosition | undefined;
}
