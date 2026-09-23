import type { Outcome } from "./types";

export class ScaffoldNotImplementedError extends Error {
  readonly code = "NOT_IMPLEMENTED" as const;
  constructor(module: string) {
    super(`${module}: модуль ещё не реализован в нулевом этапе.`);
    this.name = "ScaffoldNotImplementedError";
  }
}

export function notImplemented<T>(module: string): Outcome<T> {
  return { ok: false, error: { code: "NOT_IMPLEMENTED", message: new ScaffoldNotImplementedError(module).message } };
}
