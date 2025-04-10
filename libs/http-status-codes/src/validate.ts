import {
  isValidInformationalPhrase,
  isValidInformationalStatusCode,
} from './1xx/index.js';
import {
  isValidSuccessfulPhrase,
  isValidSuccessfulStatusCode,
} from './2xx/index.js';
import {
  isValidRedirectionPhrase,
  isValidRedirectionStatusCode,
} from './3xx/index.js';
import {
  isValidClientErrorPhrase,
  isValidClientErrorStatusCode,
} from './4xx/index.js';
import {
  isValidServerErrorPhrase,
  isValidServerErrorStatusCode,
} from './5xx/index.js';
import type { HttpStatusPhrase } from './http-status-phrase.js';
import type { HttpStatusCode } from './http-status-code.js';

export function isValidHttpStatusCode(code: unknown): code is HttpStatusCode {
  let codeNum: number | undefined;

  if (typeof code === 'number') {
    codeNum = code;
  } else if (typeof code === 'string' && !isNaN(+code)) {
    codeNum = +code;
  }

  return (
    typeof codeNum !== 'undefined' &&
    (isValidInformationalStatusCode(codeNum) ||
      isValidSuccessfulStatusCode(codeNum) ||
      isValidRedirectionStatusCode(codeNum) ||
      isValidClientErrorStatusCode(codeNum) ||
      isValidServerErrorStatusCode(codeNum))
  );
}

export function isValidHttpStatusPhrase(
  phrase: string
): phrase is HttpStatusPhrase {
  return (
    isValidInformationalPhrase(phrase) ||
    isValidSuccessfulPhrase(phrase) ||
    isValidRedirectionPhrase(phrase) ||
    isValidClientErrorPhrase(phrase) ||
    isValidServerErrorPhrase(phrase)
  );
}
