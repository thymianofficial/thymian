import { ajv, type JSONSchemaType } from '@thymian/core';

import type {
  ActionErrorMessage,
  ActionReplyMessage,
  ClientToServerMessage,
  EmitActionMessage,
  EmitMessage,
  ReadyMessage,
  RegisterMessage,
} from './messages.js';

export const registerMessageSchema: JSONSchemaType<RegisterMessage> = {
  type: 'object',
  properties: {
    type: {
      const: 'register',
      type: 'string',
      nullable: false,
    },
    name: {
      type: 'string',
      nullable: false,
    },
    token: {
      type: 'string',
      nullable: true,
    },
    onActions: {
      type: 'array',
      nullable: true,
      items: {
        type: 'string',
      },
    },
    onEvents: {
      type: 'array',
      nullable: true,
      items: {
        type: 'string',
      },
    },
  },
  required: ['type', 'name'],
  additionalProperties: false,
};

export const readyMessageSchema: JSONSchemaType<ReadyMessage> = {
  type: 'object',
  properties: {
    type: {
      const: 'ready',
      type: 'string',
      nullable: false,
    },
  },
  required: ['type'],
  additionalProperties: false,
};

export const emitActionMessageSchema: JSONSchemaType<EmitActionMessage> = {
  type: 'object',
  properties: {
    type: {
      type: 'string',
      const: 'emitAction',
      nullable: false,
    },
    name: {
      type: 'string',
      nullable: false,
    },
    id: {
      type: 'string',
      nullable: false,
    },
    payload: {} as { nullable: true; type: never[] },
    options: {
      type: 'object',
      nullable: true,
      properties: {
        strategy: {
          type: 'string',
          enum: ['collect', 'first', 'deep-merge'],
          nullable: true,
        },
        timeout: {
          type: 'integer',
          nullable: true,
        },
      },
    },
  },
  required: ['type', 'name', 'id'],
  additionalProperties: false,
};

export const emitMessageSchema: JSONSchemaType<EmitMessage> = {
  type: 'object',
  properties: {
    type: {
      type: 'string',
      const: 'emit',
      nullable: false,
    },
    name: {
      type: 'string',
      nullable: false,
    },
    payload: {} as { nullable: true; type: never[] },
  },
  required: ['type', 'name'],
  additionalProperties: false,
};

export const actionReplyMessageSchema: JSONSchemaType<ActionReplyMessage> = {
  type: 'object',
  properties: {
    type: {
      type: 'string',
      const: 'actionReply',
      nullable: false,
    },
    correlationId: {
      type: 'string',
      nullable: false,
    },
    name: {
      type: 'string',
      nullable: false,
    },
    payload: {} as { nullable: true; type: never[] },
  },
  required: ['type', 'correlationId', 'name'],
  additionalProperties: false,
};

export const actionErrorMessageSchema: JSONSchemaType<ActionErrorMessage> = {
  type: 'object',
  properties: {
    type: {
      type: 'string',
      const: 'actionError',
      nullable: false,
    },
    correlationId: {
      type: 'string',
      nullable: false,
    },
    name: {
      type: 'string',
      nullable: false,
    },
    error: {
      type: 'object',
      nullable: false,
      properties: {
        name: {
          type: 'string',
          nullable: true,
        },
        message: {
          type: 'string',
          nullable: false,
        },
        options: {
          type: 'object',
          nullable: true,
        },
      },
      required: ['message'],
      additionalProperties: false,
    },
  },
  required: ['type', 'correlationId', 'name', 'error'],
  additionalProperties: false,
};

export const clientToServerMessageSchema: JSONSchemaType<ClientToServerMessage> =
  {
    oneOf: [
      registerMessageSchema,
      readyMessageSchema,
      emitMessageSchema,
      emitActionMessageSchema,
      actionReplyMessageSchema,
      actionErrorMessageSchema,
    ],
  };

const validate = ajv.compile(clientToServerMessageSchema);

export function isClientToServerMessage(
  msg: Record<PropertyKey, unknown>,
): msg is ClientToServerMessage {
  return validate(msg);
}
