---
title: Plugin Options
description: Configuration options for the HTTP Linter plugin
sidebar:
  order: -100
---

**Properties**

| Name                            | Type       | Description | Required |
| ------------------------------- | ---------- | ----------- | -------- |
| [**ruleOptions**](#ruleoptions) | `object`   |             | no       |
| [**modes**](#modes)             | `string[]` |             | no       |
| [**rules**](#rules)             | `string[]` |             | yes      |
| **origin**                      | `string`   |             | no       |
| [**analytics**](#analytics)     | `object`   |             | no       |
| [**ruleFilter**](#rulefilter)   | `object`   |             | no       |

**Example**

```json
{
  "ruleOptions": {},
  "analytics": {
    "captureTransactions": {}
  },
  "ruleFilter": {}
}
```

<a name="ruleoptions"></a>

## ruleOptions: object

**Additional Properties:** allowed  
<a name="modes"></a>

## modes\[\]: array

**Items**

**Item Type:** `string`  
**Item Enum:** `"static"`, `"analytics"`, `"test"`, `"informational"`  
<a name="rules"></a>

## rules\[\]: array

**Items**

**Item Type:** `string`  
<a name="analytics"></a>

## analytics: object

**Properties**

| Name                                                     | Type     | Description | Required |
| -------------------------------------------------------- | -------- | ----------- | -------- |
| [**captureTransactions**](#analyticscapturetransactions) | `object` |             | yes      |

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
Save incoming HTTP transaction in memory.

**Properties**

| Name     | Type | Description                        | Required |
| -------- | ---- | ---------------------------------- | -------- |
| **type** |      | Constant Value: `"in-memory"`<br/> | yes      |

**Additional Properties:** not allowed

   
**Option 2 (alternative):**
Saves incoming HTTP transaction in specified DB file.

**Properties**

| Name         | Type     | Description                   | Required |
| ------------ | -------- | ----------------------------- | -------- |
| **type**     |          | Constant Value: `"file"`<br/> | yes      |
| **filePath** | `string` |                               | no       |

**Additional Properties:** not allowed

<a name="rulefilter"></a>

## ruleFilter: object

**Properties**

| Name                                  | Type       | Description                                       | Required |
| ------------------------------------- | ---------- | ------------------------------------------------- | -------- |
| [**ruleTypes**](#rulefilterruletypes) | `string[]` |                                                   |          |
| **severity**                          | `string`   | Enum: `"off"`, `"error"`, `"warn"`, `"hint"`<br/> |          |
| [**appliesTo**](#rulefilterappliesto) | `string[]` |                                                   |          |
| [**names**](#rulefilternames)         | `string[]` |                                                   |          |

**Additional Properties:** not allowed  
<a name="rulefilterruletypes"></a>

### ruleFilter\.ruleTypes\[\]: array

**Items**

**Item Type:** `string`  
**Item Enum:** `"static"`, `"analytics"`, `"test"`, `"informational"`  
<a name="rulefilterappliesto"></a>

### ruleFilter\.appliesTo\[\]: array

**Items**

**Item Type:** `string`  
**Item Enum:** `"intermediary"`, `"proxy"`, `"gateway"`, `"tunnel"`, `"origin server"`, `"server"`, `"client"`, `"user-agent"`, `"cache"`  
<a name="rulefilternames"></a>

### ruleFilter\.names\[\]: array

**Items**

**Item Type:** `string`
