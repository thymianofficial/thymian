export type SourcePosition = {
  line: number;
  column: number;
  offset: number;
};

export abstract class LocMapper {
  protected constructor(
    protected readonly text: string,
    protected readonly path: string,
  ) {}

  abstract positionForOperationId(
    operationId: string,
  ): SourcePosition | undefined;

  locationForOperationId(operationId: string): string | undefined {
    const pos = this.positionForOperationId(operationId);

    return pos ? `${this.path}:${pos.line}:${pos.column}` : undefined;
  }
}
