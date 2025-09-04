export type SqlFragment = {
  sql: string;
  params: unknown[];
};

export const parenthesize = (expr: string): string => `(${expr})`;
