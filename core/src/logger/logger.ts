export interface Logger {
  name: string;
  debug(msg: string): void;
  info(msg: string): void;
  error(msg: string): void;
  out(output: unknown): void;
  child(name: string): Logger;
}
