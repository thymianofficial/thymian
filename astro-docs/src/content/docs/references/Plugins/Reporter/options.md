---
title: Plugin Options
description: ''
sidebar:
  order: -100
---

**Properties**

| Name                          | Type                  | Description                                        | Required |
| ----------------------------- | --------------------- | -------------------------------------------------- | -------- |
| [**formatters**](#formatters) | <nobr>`object`</nobr> | Configuration for different report formatters<br/> |          |

**Additional Properties:** not allowed  
**Example**

```json
{
  "formatters": {
    "text": {},
    "markdown": {},
    "csv": {}
  }
}
```

<a name="formatters"></a>

## formatters: object

**Properties**

| Name                                | Type                  | Description                                         | Required |
| ----------------------------------- | --------------------- | --------------------------------------------------- | -------- |
| [**text**](#formatterstext)         | <nobr>`object`</nobr> | Configuration for the text (console) formatter<br/> |          |
| [**markdown**](#formattersmarkdown) | <nobr>`object`</nobr> | Configuration for the Markdown formatter<br/>       |          |
| [**csv**](#formatterscsv)           | <nobr>`object`</nobr> | Configuration for the CSV formatter<br/>            |          |

**Additional Properties:** not allowed  
**Example**

```json
{
  "text": {},
  "markdown": {},
  "csv": {}
}
```

<a name="formatterstext"></a>

### formatters\.text: object

**Properties**

| Name            | Type                   | Description                                                                               | Required |
| --------------- | ---------------------- | ----------------------------------------------------------------------------------------- | -------- |
| **summaryOnly** | <nobr>`boolean`</nobr> | When true, only shows the summary without detailed reports<br/>                           |          |
| **path**        | <nobr>`string`</nobr>  | File path where the plain text report will be saved (ANSI escape codes are stripped)<br/> |          |

**Additional Properties:** not allowed  
<a name="formattersmarkdown"></a>

### formatters\.markdown: object

**Properties**

| Name     | Type                  | Description                                            | Required |
| -------- | --------------------- | ------------------------------------------------------ | -------- |
| **path** | <nobr>`string`</nobr> | File path where the markdown report will be saved<br/> |          |

**Additional Properties:** not allowed  
<a name="formatterscsv"></a>

### formatters\.csv: object

**Properties**

| Name     | Type                  | Description                                       | Required |
| -------- | --------------------- | ------------------------------------------------- | -------- |
| **path** | <nobr>`string`</nobr> | File path where the CSV report will be saved<br/> |          |

**Additional Properties:** not allowed
