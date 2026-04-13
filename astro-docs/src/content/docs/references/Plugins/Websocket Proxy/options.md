---
title: Plugin Options
description: ''
sidebar:
  order: -100
---

**Properties**

| Name                    | Type                    | Description | Required |
| ----------------------- | ----------------------- | ----------- | -------- |
| **port**                | <nobr>`integer`</nobr>  |             |          |
| **clientTimeout**       | <nobr>`integer`</nobr>  |             |          |
| [**plugins**](#plugins) | <nobr>`object[]`</nobr> |             |          |

**Additional Properties:** not allowed  
**Example**

```json
{
  "plugins": [
    {
      "options": {}
    }
  ]
}
```

<h2 id="plugins">plugins[]: array</h2>

**Items**

**Item Properties**

| Name                           | Type                   | Description | Required |
| ------------------------------ | ---------------------- | ----------- | -------- |
| **name**                       | <nobr>`string`</nobr>  |             | yes      |
| **required**                   | <nobr>`boolean`</nobr> |             | no       |
| **token**                      | <nobr>`string`</nobr>  |             | no       |
| [**options**](#pluginsoptions) | <nobr>`object`</nobr>  |             | yes      |

**Item Additional Properties:** not allowed  
**Example**

```json
[
  {
    "options": {}
  }
]
```

<h3 id="pluginsoptions">plugins[].options: object</h3>

**Additional Properties:** allowed
