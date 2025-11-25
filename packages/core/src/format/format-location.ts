export type ThymianFormatPosition = {
  line: number;
  column: number;
  offset: number;
};

export type ThymianFormatLocation = (
  | {
      path: string;
    }
  | { uri: string }
) & {
  position?: ThymianFormatPosition;
};
