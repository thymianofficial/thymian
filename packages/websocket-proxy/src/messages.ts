import type { ThymianActionName, ThymianEventName } from '@thymian/core';

export type RegisterMessage = {
  type: 'register';
  name: string;
  token?: string;
  onActions?: ThymianActionName[];
  onEvents?: ThymianEventName[];
};

export type ReadyMessage = { type: 'ready' };

export type EmitMessage = {
  type: 'emit';
  name: ThymianEventName;
  payload: unknown;
};

export type EmitActionMessage = {
  type: 'emitAction';
  id: string; // client-generated id for correlation
  name: ThymianActionName;
  payload: unknown;
  options?: { strategy?: 'first' | 'collect' | 'deep-merge'; timeout?: number };
};

export type ActionReplyMessage = {
  type: 'actionReply';
  correlationId: string;
  name: ThymianActionName;
  payload: unknown;
};

export type ActionErrorMessage = {
  type: 'actionError';
  correlationId: string;
  name: ThymianActionName;
  error: { name?: string; message: string; options?: Record<string, unknown> };
};

export type ClientToServerMessage =
  | RegisterMessage
  | ReadyMessage
  | EmitMessage
  | EmitActionMessage
  | ActionReplyMessage
  | ActionErrorMessage;

export type RegisterAckMessage = {
  type: 'register-ack';
  ok: boolean;
  config?: Record<PropertyKey, unknown>;
  reason?: string;
};

export type ServerActionMessage = {
  type: 'action';
  id: string;
  name: ThymianActionName;
  payload: unknown;
};

export type ServerEventMessage = {
  type: 'event';
  name: ThymianEventName;
  payload: unknown;
};

export type EmitActionResultMessage = {
  type: 'emitActionResult';
  correlationId: string;
  name: ThymianActionName;
  payload?: unknown;
};

export type EmitActionErrorMessage = {
  type: 'emitActionError';
  correlationId: string;
  name: ThymianActionName;
  error: { name?: string; message?: string };
};

export type ServerToClientMessage =
  | RegisterAckMessage
  | ServerActionMessage
  | ServerEventMessage
  | EmitActionResultMessage
  | EmitActionErrorMessage;
