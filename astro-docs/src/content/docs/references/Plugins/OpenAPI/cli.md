---
title: 'CLI Reference'
description: 'Command-line tool for reading and interacting with OpenAPI specifications'
sidebar:
  order: -50
---

# Commands

<!-- commands -->

- [`thymian openapi info CONTENT`](#thymian-openapi-info-content)
- [`thymian openapi load CONTENT`](#thymian-openapi-load-content)

## `thymian openapi info CONTENT`

Print summary information for an OpenAPI or Swagger document.

```
USAGE
  $ thymian openapi info CONTENT [--verbose] [--debug] [--guidance] [--log-level
    trace|debug|info|warn|error|silent] [--config <value>] [--autoload] [--plugin <value>...] [--option
    <plugin>.<path>=<value>...] [--spec type:location...] [--traffic type:location...] [--rule-set package-name...]
    [--rule-severity off|error|warn|hint] [--timeout <value>] [--idle-timeout <value>] [--cwd <value>]
    [--suppress-feedback] [--validate-specs]

ARGUMENTS
  CONTENT  Path to the OpenAPI or Swagger document to inspect.

FLAGS
  --cwd=<value>  [default: /home/andreas/Projects/thymian/thymian-internal/.worktrees/story-333-map-plugin-execution-dat
                 a/packages/plugin-openapi] Set current working directory.

BASE FLAGS
  --[no-]autoload                      Automatically load and initialize plugins from the configuration file.
  --config=<value>                     Path to thymian configuration file.
  --debug                              Run thymian in debug mode.
  --[no-]guidance                      Show guidance hints on stderr. Defaults to true for TTY, false for non-TTY.
  --idle-timeout=<value>               [default: 500] Set the duration in ms to waited for events and actions when
                                       closing Thymian.
  --log-level=<option>                 Set log level (trace, debug, info, warn, error, silent). When set to trace, all
                                       events are traced.
                                       <options: trace|debug|info|warn|error|silent>
  --option=<plugin>.<path>=<value>...  Override plugin options. Format: <pluginName>.<property.path>=<value>. Supports
                                       nested paths (dot notation) and array indices (bracket notation).
  --plugin=<value>...                  [default: ] Load an additional plugin package or relative plugin path before
                                       running the command. Can be used multiple times.
  --rule-set=package-name...           Add a rule set package to use for validation (e.g. @thymian/rules-rfc-9110). Can
                                       be specified multiple times.
  --rule-severity=<option>             Set the minimum rule severity threshold for rule loading (off, error, warn,
                                       hint). Only rules at or above this severity are loaded.
                                       <options: off|error|warn|hint>
  --spec=type:location...              Specification input in the format <type>:<location> (e.g.
                                       openapi:./openapi.yaml).
  --suppress-feedback                  Suppress feedback messages from Thymian.
  --timeout=<value>                    [default: 10000] Set the duration in ms to wait for anything that happens in
                                       Thymian.
  --traffic=type:location...           Traffic input in the format <type>:<location> (e.g. har:./traffic.har).
  --[no-]validate-specs                Validate included specifications and fail on schema validation errors.
  --verbose                            Run thymian in verbose mode.

DESCRIPTION
  Print summary information for an OpenAPI or Swagger document.

EXAMPLES
  $ thymian openapi info openapi.yaml
```

_See code: [dist/cli/commands/openapi/info.js](https://github.com/thymianofficial/thymian/blob/v0.0.0-PLACEHOLDER/dist/cli/commands/openapi/info.js)_

## `thymian openapi load CONTENT`

Convert an OpenAPI or Swagger document to exported Thymian format JSON.

```
USAGE
  $ thymian openapi load CONTENT [--verbose] [--debug] [--guidance] [--log-level
    trace|debug|info|warn|error|silent] [--config <value>] [--autoload] [--plugin <value>...] [--option
    <plugin>.<path>=<value>...] [--spec type:location...] [--traffic type:location...] [--rule-set package-name...]
    [--rule-severity off|error|warn|hint] [--timeout <value>] [--idle-timeout <value>] [--cwd <value>]
    [--suppress-feedback] [--validate-specs]

ARGUMENTS
  CONTENT  Path to the OpenAPI or Swagger document to convert.

FLAGS
  --cwd=<value>  [default: /home/andreas/Projects/thymian/thymian-internal/.worktrees/story-333-map-plugin-execution-dat
                 a/packages/plugin-openapi] Set current working directory.

BASE FLAGS
  --[no-]autoload                      Automatically load and initialize plugins from the configuration file.
  --config=<value>                     Path to thymian configuration file.
  --debug                              Run thymian in debug mode.
  --[no-]guidance                      Show guidance hints on stderr. Defaults to true for TTY, false for non-TTY.
  --idle-timeout=<value>               [default: 500] Set the duration in ms to waited for events and actions when
                                       closing Thymian.
  --log-level=<option>                 Set log level (trace, debug, info, warn, error, silent). When set to trace, all
                                       events are traced.
                                       <options: trace|debug|info|warn|error|silent>
  --option=<plugin>.<path>=<value>...  Override plugin options. Format: <pluginName>.<property.path>=<value>. Supports
                                       nested paths (dot notation) and array indices (bracket notation).
  --plugin=<value>...                  [default: ] Load an additional plugin package or relative plugin path before
                                       running the command. Can be used multiple times.
  --rule-set=package-name...           Add a rule set package to use for validation (e.g. @thymian/rules-rfc-9110). Can
                                       be specified multiple times.
  --rule-severity=<option>             Set the minimum rule severity threshold for rule loading (off, error, warn,
                                       hint). Only rules at or above this severity are loaded.
                                       <options: off|error|warn|hint>
  --spec=type:location...              Specification input in the format <type>:<location> (e.g.
                                       openapi:./openapi.yaml).
  --suppress-feedback                  Suppress feedback messages from Thymian.
  --timeout=<value>                    [default: 10000] Set the duration in ms to wait for anything that happens in
                                       Thymian.
  --traffic=type:location...           Traffic input in the format <type>:<location> (e.g. har:./traffic.har).
  --[no-]validate-specs                Validate included specifications and fail on schema validation errors.
  --verbose                            Run thymian in verbose mode.

DESCRIPTION
  Convert an OpenAPI or Swagger document to exported Thymian format JSON.

EXAMPLES
  $ thymian openapi load openapi.yaml
```

_See code: [dist/cli/commands/openapi/load.js](https://github.com/thymianofficial/thymian/blob/v0.0.0-PLACEHOLDER/dist/cli/commands/openapi/load.js)_

<!-- commandsstop -->
