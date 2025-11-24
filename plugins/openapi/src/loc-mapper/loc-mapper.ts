import type {
  ThymianFormatLocation,
  ThymianFormatPosition,
} from '@thymian/core';

export abstract class LocMapper {
  protected constructor(
    protected readonly text: string,
    protected readonly path: string,
  ) {}

  abstract positionForOperationId(
    operationId: string,
  ): ThymianFormatPosition | undefined;

  locationForOperationId(
    operationId: string,
  ): ThymianFormatLocation | undefined {
    const pos = this.positionForOperationId(operationId);

    return pos
      ? {
          path: this.path,
          position: {
            line: pos.line,
            column: pos.column,
            offset: pos.offset,
          },
        }
      : undefined;
  }
}
