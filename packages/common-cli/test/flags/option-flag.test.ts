import { Errors } from '@oclif/core';
import { describe, expect, it } from 'vitest';

import {
  deepSet,
  optionFlag,
  parseOptionFlag,
  parsePropertyPath,
  type PluginOptionOverride,
} from '../../src/flags/option-flag.js';

describe('option-flag', () => {
  describe('optionFlag factory', () => {
    const flag = optionFlag();

    it('should have the correct description', () => {
      expect(flag.description).toContain('Override plugin options');
    });

    it('should allow multiple values', () => {
      expect(flag.multiple).toBe(true);
    });

    it('should use -o as char alias', () => {
      expect(flag.charAliases).toContain('o');
    });

    it('should belong to the BASE help group', () => {
      expect(flag.helpGroup).toBe('BASE');
    });

    it('should show a descriptive help value', () => {
      expect(flag.helpValue).toBe('<plugin>.<path>=<value>');
    });

    it('should expose an async parse function', () => {
      expect(flag.parse).toBeTypeOf('function');
    });

    it('should parse a valid input via the oclif parse hook', async () => {
      const result = (await flag.parse!(
        '@thymian/plugin-reporter.formatters.text.summaryOnly=true',
        {},
        {} as never,
      )) as PluginOptionOverride;

      expect(result).toEqual({
        pluginName: '@thymian/plugin-reporter',
        path: ['formatters', 'text', 'summaryOnly'],
        value: true,
      });
    });
  });

  describe('parseOptionFlag', () => {
    describe('scoped plugin names', () => {
      it('should parse a scoped plugin with a single property', () => {
        expect(parseOptionFlag('@thymian/plugin-websocket-proxy.port=8080')).toEqual({
          pluginName: '@thymian/plugin-websocket-proxy',
          path: ['port'],
          value: 8080,
        });
      });

      it('should parse a scoped plugin with deeply nested properties', () => {
        expect(
          parseOptionFlag('@thymian/plugin-reporter.formatters.text.summaryOnly=true'),
        ).toEqual({
          pluginName: '@thymian/plugin-reporter',
          path: ['formatters', 'text', 'summaryOnly'],
          value: true,
        });
      });

      it('should handle a scoped plugin with an array index', () => {
        expect(parseOptionFlag('@thymian/plugin-sampler.items[0].name=Auth')).toEqual({
          pluginName: '@thymian/plugin-sampler',
          path: ['items', 0, 'name'],
          value: 'Auth',
        });
      });

      it('should handle a different scope', () => {
        expect(parseOptionFlag('@custom/my-plugin.key=val')).toEqual({
          pluginName: '@custom/my-plugin',
          path: ['key'],
          value: 'val',
        });
      });
    });

    describe('unscoped plugin names', () => {
      it('should parse an unscoped plugin with a single property', () => {
        expect(parseOptionFlag('my-plugin.enabled=false')).toEqual({
          pluginName: 'my-plugin',
          path: ['enabled'],
          value: false,
        });
      });

      it('should parse an unscoped plugin with nested properties', () => {
        expect(parseOptionFlag('reporter.output.format=json')).toEqual({
          pluginName: 'reporter',
          path: ['output', 'format'],
          value: 'json',
        });
      });
    });

    describe('value coercion via safeParse', () => {
      it('should coerce numeric values', () => {
        expect(parseOptionFlag('p.port=3000').value).toBe(3000);
      });

      it('should coerce floating-point values', () => {
        expect(parseOptionFlag('p.ratio=0.75').value).toBe(0.75);
      });

      it('should coerce boolean true', () => {
        expect(parseOptionFlag('p.flag=true').value).toBe(true);
      });

      it('should coerce boolean false', () => {
        expect(parseOptionFlag('p.flag=false').value).toBe(false);
      });

      it('should coerce null', () => {
        expect(parseOptionFlag('p.val=null').value).toBe(null);
      });

      it('should keep non-numeric strings as strings', () => {
        expect(parseOptionFlag('p.name=hello').value).toBe('hello');
      });

      it('should handle empty value as empty string', () => {
        expect(parseOptionFlag('p.val=').value).toBe('');
      });

      it('should parse JSON array values', () => {
        expect(parseOptionFlag('p.tags=[1,2,3]').value).toEqual([1, 2, 3]);
      });

      it('should parse JSON object values', () => {
        expect(parseOptionFlag('p.meta={"a":1}').value).toEqual({ a: 1 });
      });

      it('should keep a value containing an equals sign as string', () => {
        expect(parseOptionFlag('p.query=a=b').value).toBe('a=b');
      });

      it('should keep a value with multiple equals signs as string', () => {
        expect(parseOptionFlag('p.expr=x=y=z').value).toBe('x=y=z');
      });

      it('should keep a path-like value as string', () => {
        expect(parseOptionFlag('p.file=./reports/out.txt').value).toBe(
          './reports/out.txt',
        );
      });
    });

    describe('complex path patterns', () => {
      it('should handle consecutive array indices', () => {
        expect(parseOptionFlag('plugin.matrix[0][1]=42')).toEqual({
          pluginName: 'plugin',
          path: ['matrix', 0, 1],
          value: 42,
        });
      });

      it('should handle deeply nested path with mixed dots and brackets', () => {
        expect(parseOptionFlag('plugin.a.b[2].c.d[0]=val')).toEqual({
          pluginName: 'plugin',
          path: ['a', 'b', 2, 'c', 'd', 0],
          value: 'val',
        });
      });

      it('should handle a single property on a scoped plugin', () => {
        expect(parseOptionFlag('@scope/name.x=1')).toEqual({
          pluginName: '@scope/name',
          path: ['x'],
          value: 1,
        });
      });
    });

    describe('error cases', () => {
      it('should throw when no equals sign is present', () => {
        expect(() => parseOptionFlag('@thymian/plugin-reporter.formatters')).toThrow(
          Errors.CLIError,
        );
        expect(() => parseOptionFlag('@thymian/plugin-reporter.formatters')).toThrow(
          'Expected <pluginName>.<property>=<value>',
        );
      });

      it('should throw when no property path is present (scoped)', () => {
        expect(() => parseOptionFlag('@thymian/plugin-reporter=value')).toThrow(
          Errors.CLIError,
        );
        expect(() => parseOptionFlag('@thymian/plugin-reporter=value')).toThrow(
          'Expected <pluginName>.<property>=<value>',
        );
      });

      it('should throw when no property path is present (unscoped)', () => {
        expect(() => parseOptionFlag('plugin=value')).toThrow(Errors.CLIError);
      });

      it('should throw for just an equals sign', () => {
        expect(() => parseOptionFlag('=value')).toThrow(Errors.CLIError);
      });

      it('should throw for a scope without a package name', () => {
        expect(() => parseOptionFlag('@scope=value')).toThrow(Errors.CLIError);
      });

      it('should throw for unclosed bracket in path', () => {
        expect(() => parseOptionFlag('plugin.items[0.name=x')).toThrow(
          'Unclosed bracket',
        );
      });

      it('should throw for non-integer array index', () => {
        expect(() => parseOptionFlag('plugin.items[abc]=x')).toThrow(
          'Array indices must be non-negative integers',
        );
      });

      it('should throw for negative array index', () => {
        expect(() => parseOptionFlag('plugin.items[-1]=x')).toThrow(
          'Array indices must be non-negative integers',
        );
      });

      it('should throw for floating-point array index', () => {
        expect(() => parseOptionFlag('plugin.items[1.5]=x')).toThrow(
          'Array indices must be non-negative integers',
        );
      });
    });
  });

  describe('parsePropertyPath', () => {
    it('should parse a simple dot-separated path', () => {
      expect(parsePropertyPath('a.b.c')).toEqual(['a', 'b', 'c']);
    });

    it('should parse a single segment', () => {
      expect(parsePropertyPath('port')).toEqual(['port']);
    });

    it('should parse bracket index after a key', () => {
      expect(parsePropertyPath('items[0].name')).toEqual(['items', 0, 'name']);
    });

    it('should parse consecutive brackets', () => {
      expect(parsePropertyPath('matrix[0][1]')).toEqual(['matrix', 0, 1]);
    });

    it('should parse bracket at the start', () => {
      expect(parsePropertyPath('[0].name')).toEqual([0, 'name']);
    });

    it('should parse a mixed deep path', () => {
      expect(parsePropertyPath('a.b[2].c.d[0]')).toEqual([
        'a',
        'b',
        2,
        'c',
        'd',
        0,
      ]);
    });

    it('should handle a trailing dot by ignoring it', () => {
      expect(parsePropertyPath('a.b.')).toEqual(['a', 'b']);
    });

    it('should handle a leading dot by ignoring it', () => {
      expect(parsePropertyPath('.a.b')).toEqual(['a', 'b']);
    });

    it('should return an empty array for an empty string', () => {
      expect(parsePropertyPath('')).toEqual([]);
    });

    it('should handle large array indices', () => {
      expect(parsePropertyPath('items[999]')).toEqual(['items', 999]);
    });

    it('should handle zero index', () => {
      expect(parsePropertyPath('arr[0]')).toEqual(['arr', 0]);
    });

    it('should throw for unclosed bracket', () => {
      expect(() => parsePropertyPath('items[0')).toThrow('Unclosed bracket');
    });

    it('should treat empty brackets as index 0', () => {
      expect(parsePropertyPath('items[]')).toEqual(['items', 0]);
    });

    it('should throw for non-numeric bracket content', () => {
      expect(() => parsePropertyPath('items[foo]')).toThrow(
        'Array indices must be non-negative integers',
      );
    });
  });

  describe('deepSet', () => {
    it('should set a top-level property', () => {
      const obj: Record<string, unknown> = {};
      deepSet(obj, ['port'], 8080);

      expect(obj).toEqual({ port: 8080 });
    });

    it('should set a nested property, creating intermediates', () => {
      const obj: Record<string, unknown> = {};
      deepSet(obj, ['formatters', 'text', 'summaryOnly'], true);

      expect(obj).toEqual({
        formatters: { text: { summaryOnly: true } },
      });
    });

    it('should create an array when the next segment is numeric', () => {
      const obj: Record<string, unknown> = {};
      deepSet(obj, ['items', 0, 'name'], 'Auth');

      expect(obj).toEqual({ items: [{ name: 'Auth' }] });
    });

    it('should preserve existing sibling properties', () => {
      const obj: Record<string, unknown> = {
        formatters: { text: { path: 'old.txt' } },
      };
      deepSet(obj, ['formatters', 'text', 'summaryOnly'], true);

      expect(obj).toEqual({
        formatters: { text: { path: 'old.txt', summaryOnly: true } },
      });
    });

    it('should overwrite an existing value', () => {
      const obj: Record<string, unknown> = { port: 3000 };
      deepSet(obj, ['port'], 8080);

      expect(obj).toEqual({ port: 8080 });
    });

    it('should populate array elements sequentially', () => {
      const obj: Record<string, unknown> = {};
      deepSet(obj, ['tags', 0], 'a');
      deepSet(obj, ['tags', 1], 'b');
      deepSet(obj, ['tags', 2], 'c');

      expect(obj).toEqual({ tags: ['a', 'b', 'c'] });
    });

    it('should handle sparse array indices', () => {
      const obj: Record<string, unknown> = {};
      deepSet(obj, ['items', 2], 'third');

      const items = (obj as { items: unknown[] }).items;
      expect(items[2]).toBe('third');
      expect(items).toHaveLength(3);
    });

    it('should create nested objects inside an array element', () => {
      const obj: Record<string, unknown> = {};
      deepSet(obj, ['rules', 0, 'severity'], 'error');
      deepSet(obj, ['rules', 0, 'name'], 'no-empty');

      expect(obj).toEqual({
        rules: [{ severity: 'error', name: 'no-empty' }],
      });
    });

    it('should handle deeply nested mixed objects and arrays', () => {
      const obj: Record<string, unknown> = {};
      deepSet(obj, ['a', 'b', 0, 'c', 'd', 1], 'value');

      expect(obj).toEqual({
        a: {
          b: [
            {
              c: {
                // eslint-disable-next-line no-sparse-arrays
                d: [, 'value'],
              },
            },
          ],
        },
      });
    });

    it('should replace null intermediate with a new object', () => {
      const obj: Record<string, unknown> = { nested: null };
      deepSet(obj, ['nested', 'key'], 'val');

      expect(obj).toEqual({ nested: { key: 'val' } });
    });

    it('should set a value of type object', () => {
      const obj: Record<string, unknown> = {};
      deepSet(obj, ['config'], { a: 1, b: 2 });

      expect(obj).toEqual({ config: { a: 1, b: 2 } });
    });

    it('should set a value of type array', () => {
      const obj: Record<string, unknown> = {};
      deepSet(obj, ['list'], [1, 2, 3]);

      expect(obj).toEqual({ list: [1, 2, 3] });
    });

    it('should set null as a leaf value', () => {
      const obj: Record<string, unknown> = {};
      deepSet(obj, ['key'], null);

      expect(obj).toEqual({ key: null });
    });

    it('should handle multiple independent calls on the same root', () => {
      const obj: Record<string, unknown> = {};
      deepSet(obj, ['a', 'x'], 1);
      deepSet(obj, ['a', 'y'], 2);
      deepSet(obj, ['b'], 3);

      expect(obj).toEqual({ a: { x: 1, y: 2 }, b: 3 });
    });
  });

  describe('end-to-end flag scenarios', () => {
    it('should combine parse + deepSet to build plugin options from multiple flags', () => {
      const flags = [
        '@thymian/plugin-reporter.formatters.text.summaryOnly=true',
        '@thymian/plugin-reporter.formatters.text.path=report.txt',
        '@thymian/plugin-websocket-proxy.port=9090',
      ];

      const plugins: Record<string, Record<string, unknown>> = {};

      for (const raw of flags) {
        const override = parseOptionFlag(raw);
        plugins[override.pluginName] ??= {};
        deepSet(plugins[override.pluginName]!, override.path, override.value);
      }

      expect(plugins).toEqual({
        '@thymian/plugin-reporter': {
          formatters: {
            text: {
              summaryOnly: true,
              path: 'report.txt',
            },
          },
        },
        '@thymian/plugin-websocket-proxy': {
          port: 9090,
        },
      });
    });

    it('should allow later flags to override earlier flags for the same path', () => {
      const flags = [
        '@thymian/plugin-websocket-proxy.port=3000',
        '@thymian/plugin-websocket-proxy.port=9090',
      ];

      const plugins: Record<string, Record<string, unknown>> = {};

      for (const raw of flags) {
        const override = parseOptionFlag(raw);
        plugins[override.pluginName] ??= {};
        deepSet(plugins[override.pluginName]!, override.path, override.value);
      }

      expect(plugins['@thymian/plugin-websocket-proxy']).toEqual({ port: 9090 });
    });

    it('should build array elements from indexed flags', () => {
      const flags = [
        'sampler.headers[0].name=Authorization',
        'sampler.headers[0].value=Bearer token',
        'sampler.headers[1].name=Accept',
        'sampler.headers[1].value=application/json',
      ];

      const plugins: Record<string, Record<string, unknown>> = {};

      for (const raw of flags) {
        const override = parseOptionFlag(raw);
        plugins[override.pluginName] ??= {};
        deepSet(plugins[override.pluginName]!, override.path, override.value);
      }

      expect(plugins['sampler']).toEqual({
        headers: [
          { name: 'Authorization', value: 'Bearer token' },
          { name: 'Accept', value: 'application/json' },
        ],
      });
    });
  });
});
