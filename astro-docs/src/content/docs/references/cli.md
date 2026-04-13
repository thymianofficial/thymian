---
title: 'Thymian CLI Reference'
decription: 'Reference for the Thymian CLI'
sidebar:
  order: -1000
---

# Commands

  <!-- commands -->

- [`thymian analyze`](#thymian-analyze)
- [`thymian config show`](#thymian-config-show)
- [`thymian feedback`](#thymian-feedback)
- [`thymian generate config`](#thymian-generate-config)
- [`thymian generate rule`](#thymian-generate-rule)
- [`thymian help [COMMAND]`](#thymian-help-command)
- [`thymian lint`](#thymian-lint)
- [`thymian plugins list`](#thymian-plugins-list)
- [`thymian rules list`](#thymian-rules-list)
- [`thymian schema`](#thymian-schema)
- [`thymian serve`](#thymian-serve)
- [`thymian test`](#thymian-test)
- [`thymian version`](#thymian-version)

## `thymian analyze`

Analyze recorded API traffic against specifications and configured rule sets.

```
USAGE
  $ thymian analyze [--json] [--verbose] [--debug] [--log-level trace|debug|info|warn|error|silent] [--config
    <value>] [--autoload] [--plugin <value>...] [--option <plugin>.<path>=<value>...] [--spec type:location...]
    [--traffic type:location...] [--rule-set package-name...] [--rule-severity off|error|warn|hint] [--timeout <value>]
    [--idle-timeout <value>] [--cwd <value>] [--suppress-feedback]

FLAGS
  --cwd=<value>  [default: /Users/petermuller/dev/thymian/thymian/packages/thymian] Set current working directory.

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
  Analyze recorded API traffic against specifications and configured rule sets.

EXAMPLES
  $ thymian analyze

  $ thymian analyze --traffic har:./traffic.har

  $ thymian analyze --spec openapi:./openapi.yaml --traffic har:./traffic.har
```

_See code: [dist/commands/analyze.js](https://github.com/thymianofficial/thymian/blob/v0.0.0-PLACEHOLDER/dist/commands/analyze.js)_

## `thymian config show`

Show the current Thymian configuration.

```
USAGE
  $ thymian config show [--json] [--verbose] [--debug] [--log-level trace|debug|info|warn|error|silent] [--config
    <value>] [--autoload] [--plugin <value>...] [--option <plugin>.<path>=<value>...] [--spec type:location...]
    [--traffic type:location...] [--rule-set package-name...] [--rule-severity off|error|warn|hint] [--timeout <value>]
    [--idle-timeout <value>] [--cwd <value>] [--suppress-feedback] [--yaml]

FLAGS
  --cwd=<value>  [default: /Users/petermuller/dev/thymian/thymian/packages/thymian] Set current working directory.
  --[no-]yaml    Output configuration in YAML format.

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
  Show the current Thymian configuration.
```

_See code: [dist/commands/config/show.js](https://github.com/thymianofficial/thymian/blob/v0.0.0-PLACEHOLDER/dist/commands/config/show.js)_

## `thymian feedback`

```
USAGE
  $ thymian feedback [--json] [--suppress-feedback]

GLOBAL FLAGS
  --json  Format output as json.

BASE FLAGS
  --suppress-feedback  Suppress feedback messages from Thymian.
```

_See code: [dist/commands/feedback.js](https://github.com/thymianofficial/thymian/blob/v0.0.0-PLACEHOLDER/dist/commands/feedback.js)_

## `thymian generate config`

Generate a Thymian configuration file for a single API specification.

```
USAGE
  $ thymian generate config [--json] [--suppress-feedback] [--cwd <value>] [--interactive] [--output <value>]
    [--for-spec type:location...]

FLAGS
  --cwd=<value>                [default: /Users/petermuller/dev/thymian/thymian/packages/thymian] Set current working
                               directory.
  --for-spec=type:location...  Specification input in the format <type>:<location>. Skips auto-detection and uses the
                               provided spec(s) directly.
  --[no-]interactive           Run in interactive mode. Use --no-interactive for automation.
  --output=<value>             Output path for the generated configuration file. Defaults to thymian.config.yaml in the
                               working directory.

GLOBAL FLAGS
  --json  Format output as json.

BASE FLAGS
  --suppress-feedback  Suppress feedback messages from Thymian.

DESCRIPTION
  Generate a Thymian configuration file for a single API specification.

EXAMPLES
  $ thymian generate config

  $ thymian generate config --no-interactive

  $ thymian generate config --output my-api.config.yaml

  $ thymian generate config --for-spec openapi:./petstore.yaml
```

_See code: [dist/commands/generate/config.js](https://github.com/thymianofficial/thymian/blob/v0.0.0-PLACEHOLDER/dist/commands/generate/config.js)_

## `thymian generate rule`

Scaffold a new HTTP rule using the httpRule builder.

```
USAGE
  $ thymian generate rule [--json] [--suppress-feedback] [--cjs] [--prefix <value>] [--url <value>] [--output
    <value>] [--cwd <value>]

FLAGS
  --cjs             Generate rule using CommonJS syntax.
  --cwd=<value>     [default: /Users/petermuller/dev/thymian/thymian/packages/thymian] Set current working directory.
  --output=<value>  Write the generated rule to a file instead of printing to stdout.
  --prefix=<value>  Prefix for the rule name that is automatically prepended.
  --url=<value>     Reference URL for the rule.

GLOBAL FLAGS
  --json  Format output as json.

BASE FLAGS
  --suppress-feedback  Suppress feedback messages from Thymian.

DESCRIPTION
  Scaffold a new HTTP rule using the httpRule builder.

EXAMPLES
  $ thymian generate rule

  $ thymian generate rule --prefix my-org/

  $ thymian generate rule --cjs

  $ thymian generate rule --output src/rules/my-rule.rule.ts
```

_See code: [dist/commands/generate/rule.js](https://github.com/thymianofficial/thymian/blob/v0.0.0-PLACEHOLDER/dist/commands/generate/rule.js)_

## `thymian help [COMMAND]`

Display help for thymian.

```
USAGE
  $ thymian help [COMMAND...] [-n]

ARGUMENTS
  [COMMAND...]  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for thymian.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v6.2.37/src/commands/help.ts)_

## `thymian lint`

Lint API specifications against configured rule sets.

```
USAGE
  $ thymian lint [--json] [--verbose] [--debug] [--log-level trace|debug|info|warn|error|silent] [--config
    <value>] [--autoload] [--plugin <value>...] [--option <plugin>.<path>=<value>...] [--spec type:location...]
    [--traffic type:location...] [--rule-set package-name...] [--rule-severity off|error|warn|hint] [--timeout <value>]
    [--idle-timeout <value>] [--cwd <value>] [--suppress-feedback]

FLAGS
  --cwd=<value>  [default: /Users/petermuller/dev/thymian/thymian/packages/thymian] Set current working directory.

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
  Lint API specifications against configured rule sets.

EXAMPLES
  $ thymian lint

  $ thymian lint --spec openapi:./openapi.yaml

  $ thymian lint --rule-set @thymian/rules-rfc-9110
```

_See code: [dist/commands/lint.js](https://github.com/thymianofficial/thymian/blob/v0.0.0-PLACEHOLDER/dist/commands/lint.js)_

## `thymian plugins list`

List all registered Thymian plugins.

```
USAGE
  $ thymian plugins list [--json] [--verbose] [--debug] [--log-level trace|debug|info|warn|error|silent] [--config
    <value>] [--autoload] [--plugin <value>...] [--option <plugin>.<path>=<value>...] [--spec type:location...]
    [--traffic type:location...] [--rule-set package-name...] [--rule-severity off|error|warn|hint] [--timeout <value>]
    [--idle-timeout <value>] [--cwd <value>] [--suppress-feedback]

FLAGS
  --cwd=<value>  [default: /Users/petermuller/dev/thymian/thymian/packages/thymian] Set current working directory.

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
  List all registered Thymian plugins.
```

_See code: [dist/commands/plugins/list.js](https://github.com/thymianofficial/thymian/blob/v0.0.0-PLACEHOLDER/dist/commands/plugins/list.js)_

## `thymian rules list`

List all rules from the configured rule sets.

```
USAGE
  $ thymian rules list [--json] [--verbose] [--debug] [--log-level trace|debug|info|warn|error|silent] [--config
    <value>] [--autoload] [--plugin <value>...] [--option <plugin>.<path>=<value>...] [--spec type:location...]
    [--traffic type:location...] [--rule-set package-name...] [--rule-severity off|error|warn|hint] [--timeout <value>]
    [--idle-timeout <value>] [--cwd <value>] [--suppress-feedback] [--type static|analytics|test|informational...]

FLAGS
  --cwd=<value>       [default: /Users/petermuller/dev/thymian/thymian/packages/thymian] Set current working directory.
  --type=<option>...  Filter rules by type (static, analytics, test, informational). Can be specified multiple times.
                      <options: static|analytics|test|informational>

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
  List all rules from the configured rule sets.

EXAMPLES
  $ thymian rules list

  $ thymian rules list --rule-set @thymian/rules-rfc-9110

  $ thymian rules list --rule-severity hint

  $ thymian rules list --type static
```

_See code: [dist/commands/rules/list.js](https://github.com/thymianofficial/thymian/blob/v0.0.0-PLACEHOLDER/dist/commands/rules/list.js)_

## `thymian schema`

```
USAGE
  $ thymian schema [--json] [--verbose] [--debug] [--log-level trace|debug|info|warn|error|silent] [--config
    <value>] [--autoload] [--plugin <value>...] [--option <plugin>.<path>=<value>...] [--spec type:location...]
    [--traffic type:location...] [--rule-set package-name...] [--rule-severity off|error|warn|hint] [--timeout <value>]
    [--idle-timeout <value>] [--cwd <value>] [--suppress-feedback]

FLAGS
  --cwd=<value>  [default: /Users/petermuller/dev/thymian/thymian/packages/thymian] Set current working directory.

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
```

_See code: [dist/commands/schema.js](https://github.com/thymianofficial/thymian/blob/v0.0.0-PLACEHOLDER/dist/commands/schema.js)_

## `thymian serve`

Run Thymian in serve mode.

```
USAGE
  $ thymian serve [--json] [--verbose] [--debug] [--log-level trace|debug|info|warn|error|silent] [--config
    <value>] [--autoload] [--plugin <value>...] [--option <plugin>.<path>=<value>...] [--spec type:location...]
    [--traffic type:location...] [--rule-set package-name...] [--rule-severity off|error|warn|hint] [--timeout <value>]
    [--idle-timeout <value>] [--cwd <value>] [--suppress-feedback]

FLAGS
  --cwd=<value>  [default: /Users/petermuller/dev/thymian/thymian/packages/thymian] Set current working directory.

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
  Run Thymian in serve mode.

EXAMPLES
  $ thymian serve
```

_See code: [dist/commands/serve.js](https://github.com/thymianofficial/thymian/blob/v0.0.0-PLACEHOLDER/dist/commands/serve.js)_

## `thymian test`

Test API specifications by running live requests against configured rule sets.

```
USAGE
  $ thymian test [--json] [--verbose] [--debug] [--log-level trace|debug|info|warn|error|silent] [--config
    <value>] [--autoload] [--plugin <value>...] [--option <plugin>.<path>=<value>...] [--spec type:location...]
    [--traffic type:location...] [--rule-set package-name...] [--rule-severity off|error|warn|hint] [--timeout <value>]
    [--idle-timeout <value>] [--cwd <value>] [--suppress-feedback] [--target-url <value>]

FLAGS
  --cwd=<value>         [default: /Users/petermuller/dev/thymian/thymian/packages/thymian] Set current working
                        directory.
  --target-url=<value>  Override the target URL for all test requests. When set, all requests are sent to this origin
                        instead of the servers defined in the specification.

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
  Test API specifications by running live requests against configured rule sets.

EXAMPLES
  $ thymian test

  $ thymian test --spec openapi:./openapi.yaml

  $ thymian test --rule-set @thymian/rules-rfc-9110

  $ thymian test --target-url http://localhost:8080
```

_See code: [dist/commands/test.js](https://github.com/thymianofficial/thymian/blob/v0.0.0-PLACEHOLDER/dist/commands/test.js)_

## `thymian version`

```
USAGE
  $ thymian version [--json] [--verbose]

FLAGS
  --verbose  Show additional information about the CLI.

GLOBAL FLAGS
  --json  Format output as json.

FLAG DESCRIPTIONS
  --verbose  Show additional information about the CLI.

    Additionally shows the architecture, node version, operating system, and versions of plugins that the CLI is using.
```

_See code: [@oclif/plugin-version](https://github.com/oclif/plugin-version/blob/v2.2.36/src/commands/version.ts)_

<!-- commandsstop -->
