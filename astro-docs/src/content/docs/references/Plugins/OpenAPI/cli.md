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
- [`thymian openapi validate FILE`](#thymian-openapi-validate-file)

## `thymian openapi info CONTENT`

Load and parse the given Swagger/OpenAPI file to the Thymian format.

```
USAGE
  $ thymian openapi info CONTENT [--json] [--verbose] [--debug] [--log-level trace|debug|info|warn|error|silent]
    [--config <value>] [--autoload] [--plugin <value>...] [--option <plugin>.<path>=<value>...] [--spec
    type:location...] [--traffic type:location...] [--rule-set package-name...] [--rule-severity off|error|warn|hint]
    [--timeout <value>] [--idle-timeout <value>] [--cwd <value>] [--suppress-feedback]

ARGUMENTS
  CONTENT  file to read

FLAGS
  --cwd=<value>  [default: /Users/petermuller/dev/thymian/thymian/packages/plugin-openapi] Set current working
                 directory.

BASE FLAGS
  --[no-]autoload                      Disable automatic loading and initialization of plugins based on configuration
                                       file.
  --config=<value>                     Path to thymian configuration file.
  --debug                              Run thymian in debug mode.
  --idle-timeout=<value>               [default: 500] Set the duration in ms to waited for events and actions when
                                       closing Thymian.
  --log-level=<option>                 Set log level (trace, debug, info, warn, error, silent). When set to trace, all
                                       events are traced.
                                       <options: trace|debug|info|warn|error|silent>
  --option=<plugin>.<path>=<value>...  Override plugin options. Format: <pluginName>.<property.path>=<value>. Supports
                                       nested paths (dot notation) and array indices (bracket notation).
  --plugin=<value>...                  [default: ]
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
  --verbose                            Run thymian in verbose mode.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Load and parse the given Swagger/OpenAPI file to the Thymian format.

EXAMPLES
  $ thymian openapi info openapi.yaml
```

_See code: [dist/cli/commands/openapi/info.js](https://github.com/thymianofficial/thymian/blob/v0.0.0-PLACEHOLDER/dist/cli/commands/openapi/info.js)_

## `thymian openapi load CONTENT`

Load and parse the given Swagger/OpenAPI file to the Thymian format.

```
USAGE
  $ thymian openapi load CONTENT [--json] [--verbose] [--debug] [--log-level trace|debug|info|warn|error|silent]
    [--config <value>] [--autoload] [--plugin <value>...] [--option <plugin>.<path>=<value>...] [--spec
    type:location...] [--traffic type:location...] [--rule-set package-name...] [--rule-severity off|error|warn|hint]
    [--timeout <value>] [--idle-timeout <value>] [--cwd <value>] [--suppress-feedback]

ARGUMENTS
  CONTENT  file to read

FLAGS
  --cwd=<value>  [default: /Users/petermuller/dev/thymian/thymian/packages/plugin-openapi] Set current working
                 directory.

BASE FLAGS
  --[no-]autoload                      Disable automatic loading and initialization of plugins based on configuration
                                       file.
  --config=<value>                     Path to thymian configuration file.
  --debug                              Run thymian in debug mode.
  --idle-timeout=<value>               [default: 500] Set the duration in ms to waited for events and actions when
                                       closing Thymian.
  --log-level=<option>                 Set log level (trace, debug, info, warn, error, silent). When set to trace, all
                                       events are traced.
                                       <options: trace|debug|info|warn|error|silent>
  --option=<plugin>.<path>=<value>...  Override plugin options. Format: <pluginName>.<property.path>=<value>. Supports
                                       nested paths (dot notation) and array indices (bracket notation).
  --plugin=<value>...                  [default: ]
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
  --verbose                            Run thymian in verbose mode.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Load and parse the given Swagger/OpenAPI file to the Thymian format.

EXAMPLES
  $ thymian openapi load openapi.yaml
```

_See code: [dist/cli/commands/openapi/load.js](https://github.com/thymianofficial/thymian/blob/v0.0.0-PLACEHOLDER/dist/cli/commands/openapi/load.js)_

## `thymian openapi validate FILE`

Load and parse the given Swagger/OpenAPI file to the Thymian format.

```
USAGE
  $ thymian openapi validate FILE [--json] [--verbose] [--debug] [--log-level trace|debug|info|warn|error|silent]
    [--config <value>] [--autoload] [--plugin <value>...] [--option <plugin>.<path>=<value>...] [--spec
    type:location...] [--traffic type:location...] [--rule-set package-name...] [--rule-severity off|error|warn|hint]
    [--timeout <value>] [--idle-timeout <value>] [--cwd <value>] [--suppress-feedback]

ARGUMENTS
  FILE  file to read

FLAGS
  --cwd=<value>  [default: /Users/petermuller/dev/thymian/thymian/packages/plugin-openapi] Set current working
                 directory.

BASE FLAGS
  --[no-]autoload                      Disable automatic loading and initialization of plugins based on configuration
                                       file.
  --config=<value>                     Path to thymian configuration file.
  --debug                              Run thymian in debug mode.
  --idle-timeout=<value>               [default: 500] Set the duration in ms to waited for events and actions when
                                       closing Thymian.
  --log-level=<option>                 Set log level (trace, debug, info, warn, error, silent). When set to trace, all
                                       events are traced.
                                       <options: trace|debug|info|warn|error|silent>
  --option=<plugin>.<path>=<value>...  Override plugin options. Format: <pluginName>.<property.path>=<value>. Supports
                                       nested paths (dot notation) and array indices (bracket notation).
  --plugin=<value>...                  [default: ]
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
  --verbose                            Run thymian in verbose mode.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Load and parse the given Swagger/OpenAPI file to the Thymian format.

EXAMPLES
  $ thymian openapi validate openapi.yaml
```

_See code: [dist/cli/commands/openapi/validate.js](https://github.com/thymianofficial/thymian/blob/v0.0.0-PLACEHOLDER/dist/cli/commands/openapi/validate.js)_

<!-- commandsstop -->
