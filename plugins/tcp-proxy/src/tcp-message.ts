import type {
  ErrorName,
  ThymianActionName,
  ThymianErrorEvent,
  ThymianEvent,
  ThymianEventName,
  ThymianResponseEvent,
} from '@thymian/core';

export type InitializationMessage = {
  type: 'init';
  payload: {
    name: string;
    actions: {
      listensOn: string[];
    };
    events: {
      listensOn: string[];
    };
  };
};

export type TcpErrorMessage = {
  type: 'error';
  payload: ThymianErrorEvent<ErrorName>;
};

export type TcpEventMessage = {
  type: 'event';
  payload: ThymianEvent<ThymianEventName>;
};

export type TcpResponseMessage = {
  type: 'response';
  payload: ThymianResponseEvent<ThymianActionName>;
};

export type TcpMessage =
  | TcpErrorMessage
  | TcpEventMessage
  | InitializationMessage
  | TcpResponseMessage;
