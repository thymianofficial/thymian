import type {
  ThymianActionEvent,
  ThymianActionName,
  ThymianResponseEvent,
} from './actions.js';
import type { ThymianEvent, ThymianEventName } from './events.js';

export function isEventWithName<Name extends ThymianEventName>(
  name: Name
): (
  event: ThymianEvent<ThymianEventName> | ThymianActionEvent<ThymianActionName>
) => event is ThymianEvent<Name> {
  return function (
    event:
      | ThymianEvent<ThymianEventName>
      | ThymianActionEvent<ThymianActionName>
  ): event is ThymianEvent<Name> {
    return event.name === name && !Object.hasOwn(event, 'correlationId');
  };
}

export function isActionEventWithName<Name extends ThymianActionName>(
  name: Name
): (
  event: ThymianEvent<ThymianEventName> | ThymianActionEvent<ThymianActionName>
) => event is ThymianActionEvent<Name> {
  return function (
    event:
      | ThymianEvent<ThymianEventName>
      | ThymianActionEvent<ThymianActionName>
  ): event is ThymianActionEvent<Name> {
    return event.name === name && Object.hasOwn(event, 'correlationId');
  };
}

export function isResponseOf<Name extends ThymianActionName>(
  name: Name,
  cid: string
): (
  event: ThymianResponseEvent<ThymianActionName>
) => event is ThymianResponseEvent<Name> {
  return function (
    event: ThymianResponseEvent<ThymianActionName>
  ): event is ThymianResponseEvent<Name> {
    return event.name === name && event.correlationId === cid;
  };
}
