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

<h2 id="formatters">formatters: object</h2>

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

<h3 id="formatterstext">formatters.text: object</h3>

**Properties**

| Name            | Type                   | Description                                                                               | Required |
| --------------- | ---------------------- | ----------------------------------------------------------------------------------------- | -------- |
| **summaryOnly** | <nobr>`boolean`</nobr> | When true, only shows the summary without detailed reports<br/>                           |          |
| **path**        | <nobr>`string`</nobr>  | File path where the plain text report will be saved (ANSI escape codes are stripped)<br/> |          |

**Additional Properties:** not allowed

<h3 id="formattersmarkdown">formatters.markdown: object</h3>

**Properties**

| Name     | Type                  | Description                                            | Required |
| -------- | --------------------- | ------------------------------------------------------ | -------- |
| **path** | <nobr>`string`</nobr> | File path where the markdown report will be saved<br/> |          |

**Additional Properties:** not allowed

<h3 id="formatterscsv">formatters.csv: object</h3>

**Properties**

| Name     | Type                  | Description                                       | Required |
| -------- | --------------------- | ------------------------------------------------- | -------- |
| **path** | <nobr>`string`</nobr> | File path where the CSV report will be saved<br/> |          |

**Additional Properties:** not allowed
