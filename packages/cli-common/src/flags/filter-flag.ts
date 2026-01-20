import { Errors, Flags } from '@oclif/core';
import {
  authorization,
  type HttpFilterExpression,
  method,
  origin,
  path,
  port,
  protocol,
  requestHeader,
  requestMediaType,
  responseHeader,
  responseMediaType,
  statusCode,
} from '@thymian/core';

const filterRegexp = /^(.*):(.*)$/;

function toNumberOrThrow(value: string): number {
  const code = Number(value);
  if (isNaN(code)) {
    throw new Errors.CLIError(
      `Invalid status code: ${value}. Must be a number.`,
    );
  }

  return code;
}

export const filters = {
  method,
  statusCode: (value) => statusCode(toNumberOrThrow(value)),
  responseHeader,
  requestHeader,
  path,
  port: (value) => port(toNumberOrThrow(value)),
  protocol: (value) => {
    if (value !== 'http' && value !== 'https') {
      throw new Errors.CLIError(
        `Protocol must be either 'http' or 'https', got: ${value}`,
      );
    }

    return protocol(value);
  },
  origin,
  authorization: (value) => {
    if (value === 'true') {
      return authorization(true);
    }
    if (value === 'false') {
      return authorization(false);
    }
    throw new Errors.CLIError(
      `Authorization must be either 'true' or 'false', got: ${value}`,
    );
  },
  responseMediaType,
  requestMediaType,
} satisfies Record<string, (value: string) => HttpFilterExpression>;

type AvailableFilter = keyof typeof filters;

const availableFilters = Object.keys(filters) as AvailableFilter[];

function isAvailableFilter(name: string): name is AvailableFilter {
  return availableFilters.includes(name as AvailableFilter);
}

export function parseFilterExpression(input: string): HttpFilterExpression {
  if (!filterRegexp.test(input)) {
    throw new Errors.CLIError(
      `Invalid filter: ${input}. Use format <filter>:<value>.`,
    );
  }

  const [filter, ...values] = input.split(':');

  if (typeof filter === 'undefined') {
    throw new Errors.CLIError(`Filter cannot be undefined.`);
  }

  if (!isAvailableFilter(filter)) {
    throw new Errors.CLIError(
      `Unknown filter: ${filter}. Available filters: ${availableFilters.join(', ')}.`,
    );
  }

  return filters[filter](values.join(':'));
}

export const filterFlag = Flags.custom<HttpFilterExpression>({
  description:
    'Filter transactions by properties. Use multiple times for AND. Available filters: ' +
    availableFilters.join(''),
  multiple: true,
  helpValue: 'filter:value',
  charAliases: ['f'],
  helpGroup: 'BASE',
  parse: async (input) => parseFilterExpression(input),
});
