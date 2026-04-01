---
title: Plugin Options
description: Configuration options for the HTTP Linter plugin
sidebar:
  order: -100
---

**Properties**

| Name                        | Type                    | Description                                                                                                                                            | Required |
| --------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| [**type**](#type)           | <nobr>`string[]`</nobr> | Defines with which contexts the rules are run.<br/>                                                                                                    | no       |
| [**ruleSets**](#rulesets)   | <nobr>`string[]`</nobr> | Array of rule sets to load. Can be package names or file paths (absolute or relative to the current working directory).<br/>                           | yes      |
| [**rules**](#rules)         | <nobr>`object`</nobr>   | Per-rule configuration to override default settings. Keys are rule names, values can be either a severity level string or a configuration object.<br/> | no       |
| **severity**                | <nobr>`string`</nobr>   | Set the severity the linter is run with.<br/>Enum: `"off"`, `"error"`, `"warn"`, `"hint"`<br/>                                                         | no       |
| [**analytics**](#analytics) | <nobr>`object`</nobr>   | Configuration for analytics mode, which analyzes captured HTTP traffic. Required when using type "analytics".<br/>                                     | no       |

**Example**

```json
{
  "rules": {
    "rfc9110/server-should-send-validator-fields": "off"
  },
  "analytics": {
    "captureTransactions": {}
  }
}
```

<a name="type"></a>

## type\[\]: array

**Items**

Defines with which contexts the rules are run.

**Item Type:** <nobr>`string`</nobr>  
**Item Enum:** `"static"`, `"analytics"`, `"test"`, `"informational"`  
<a name="rulesets"></a>

## ruleSets\[\]: array

**Items**

Array of rule sets to load. Can be package names or file paths (absolute or relative to the current working directory).

**Item Type:** <nobr>`string`</nobr>  
<a name="rules"></a>

## rules: object

**Additional Properties**

| Name                                                    | Type                                         | Description | Required |
| ------------------------------------------------------- | -------------------------------------------- | ----------- | -------- |
| [**Additional Properties**](#rulesadditionalproperties) | <nobr>`string`</nobr>, <nobr>`object`</nobr> |             | no       |

**Example**

```json
{
  "rfc9110/server-should-send-validator-fields": "off"
}
```

**Example**

```json
{
  "rfc9110/server-should-send-validator-fields": {
    "severity": "error",
    "skipOrigins": ["*.my-domain.de"]
  }
}
```

<a name="rulesadditionalproperties"></a>

### rules\.additionalProperties: string,object

   
**Option 1 (alternative):**
Set the severity level for this rule.

**Type:** <nobr>`string`</nobr>  
**Enum:** `"off"`, `"error"`, `"warn"`, `"hint"`

   
**Option 2 (alternative):**
Detailed configuration for this rule.

**Properties**

| Name                                   | Type                    | Description                                                                                                                                                     | Required |
| -------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| **severity**                           | <nobr>`string`</nobr>   | Override the default severity level for this rule.<br/>Enum: `"off"`, `"error"`, `"warn"`, `"hint"`<br/>                                                        | no       |
| [**type**](#option2type)               | <nobr>`string[]`</nobr> | Override which execution modes this rule applies to.<br/>                                                                                                       | no       |
| [**skipOrigins**](#option2skiporigins) | <nobr>`string[]`</nobr> | Array of origin (patterns) to exclude from this rule. Transactions or operations matching these origins will not be checked by this rule.<br/>                  | no       |
| [**options**](#option2options)         | <nobr>`object`</nobr>   | Rule-specific configuration options. The structure depends on the individual rule being configured. Refer to the rule documentation for available options.<br/> | no       |

**Additional Properties:** not allowed  
**Example**

```json
{
  "skipOrigins": ["*.my-domain.de"],
  "options": {}
}
```

<a name="option2type"></a>

## Option 2: type\[\]: array

**Items**

**Item Type:** <nobr>`string`</nobr>  
**Item Enum:** `"static"`, `"analytics"`, `"test"`, `"informational"`  
<a name="option2skiporigins"></a>

## Option 2: skipOrigins\[\]: array

**Items**

**Item Type:** <nobr>`string`</nobr>  
**Example**

```json
["*.my-domain.de"]
```

<a name="option2options"></a>

## Option 2: options: object

**Additional Properties:** allowed  
<a name="analytics"></a>

## analytics: object

**Properties**

| Name                                                     | Type                  | Description                                                                                                                                                                        | Required |
| -------------------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| [**captureTransactions**](#analyticscapturetransactions) | <nobr>`object`</nobr> | Specifies how to capture and store HTTP transactions for analytics linting. Transactions can be stored in-memory (fast, lost on exit) or persisted to a SQLite database file.<br/> | yes      |

**Additional Properties:** not allowed  
**Example**

```json
{
  "captureTransactions": {}
}
```

<a name="analyticscapturetransactions"></a>

### analytics\.captureTransactions: object

   
**Option 1 (alternative):**
Store HTTP transactions in memory. Fast and suitable for short-lived processes or when persistence is not needed. All captured data is lost when the process exits.

**Properties**

| Name     | Type | Description                                                                                       | Required |
| -------- | ---- | ------------------------------------------------------------------------------------------------- | -------- |
| **type** |      | Storage type identifier for in-memory transaction capture.<br/>Constant Value: `"in-memory"`<br/> | yes      |

**Additional Properties:** not allowed

   
**Option 2 (alternative):**
Store HTTP transactions in a SQLite database file. Allows persistence and analysis after the process exits. If filePath is not specified, a timestamped database file is created in .thymian/db/.

**Properties**

| Name         | Type                  | Description                                                                                                                                                                               | Required |
| ------------ | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| **type**     |                       | Storage type identifier for file-based transaction capture.<br/>Constant Value: `"file"`<br/>                                                                                             | yes      |
| **filePath** | <nobr>`string`</nobr> | Path to the SQLite database file for storing transactions. Can be absolute or relative to the current working directory. If not specified, defaults to ".thymian/db/{timestamp}.db".<br/> | no       |

**Additional Properties:** not allowed
