export type SourcePosition = {
  line: number;
  column: number;
  offset: number;
};

export type SourceLocation = {
  path: string;
  position: SourcePosition;
};

export abstract class LocMapper {
  protected constructor(
    protected readonly text: string,
    protected readonly path: string,
  ) {}

  abstract positionForOperationId(
    operationId: string,
  ): SourcePosition | undefined;

  locationForOperationId(operationId: string): SourceLocation | undefined {
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
