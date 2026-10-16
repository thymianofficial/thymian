// §8.3, "Clear Text": what a cookie a browser keeps says about the channel it
// was set over. Both checks judge only a cookie a browser keeps: one it
// ignores in §5.6, on receipt or at a §5.7 step sets no cookie, and the rule
// on why reports it; a line that clears its cookie keeps none either.
//
// A Secure cookie set over plain http is §5.7 step 13's, which a browser
// ignores, so neither check reports it: what is left over plain http is a
// cookie without Secure, which the browser stores and sends back over plain
// http as well.

import {
  type CookieExchangeCheck,
  TRANSPORT_NOT_JUDGED,
} from './exchange-contexts.js';
import { type ReceivedCookie, removesCookie } from './set-cookie.js';
import {
  type CookieExchange,
  ignoredInStorage,
  isSecureConnection,
  isSecureOnly,
} from './storage-model.js';

function keptByBrowser(
  cookie: ReceivedCookie,
  exchange: CookieExchange,
): boolean {
  return (
    !removesCookie(cookie) && ignoredInStorage(cookie, exchange) === undefined
  );
}

// A cookie a browser keeps from a response over plain http. `advice` is the
// sentence that tells the server what to do instead.
//
// Where the transport is not judged, a cookie without Secure leaves the rule
// undecided: over plain http it is this check's, over https it is not. A
// Secure one is never this check's, whichever the scheme is.
export function cookieKeptOverPlainHttp(advice: string): CookieExchangeCheck {
  return (cookie, exchange) => {
    if (!keptByBrowser(cookie, exchange)) {
      return undefined;
    }
    if (!exchange.transportJudged) {
      return isSecureOnly(cookie) ? undefined : TRANSPORT_NOT_JUDGED;
    }
    return isSecureConnection(exchange.origin)
      ? undefined
      : `The cookie "${cookie.name}" is set over plain http: its name and value travel in clear text, a browser keeps it and sends it back over plain http, and anyone on the network can read or alter it on the way (§8.3). ${advice}`;
  };
}

// A cookie without Secure that a browser keeps from a response over https.
//
// Where the transport is not judged, a cookie without Secure leaves the rule
// undecided: over https it is this check's, over plain http it is
// `cookieKeptOverPlainHttp`'s.
export function cookieWithoutSecureOverHttps(): CookieExchangeCheck {
  return (cookie, exchange) => {
    if (isSecureOnly(cookie) || !keptByBrowser(cookie, exchange)) {
      return undefined;
    }
    if (!exchange.transportJudged) {
      return TRANSPORT_NOT_JUDGED;
    }
    return isSecureConnection(exchange.origin)
      ? `The cookie "${cookie.name}" is set over https without the Secure attribute, so a browser also sends it over plain http: an active attacker who sends the browser to an http URL of this host reads it there, and the protection https gives it is largely moot (§8.3). Add the Secure attribute.`
      : undefined;
  };
}
