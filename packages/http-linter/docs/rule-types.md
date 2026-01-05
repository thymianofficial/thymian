---
title: 'Rule Types'
description: 'TODO'
---

There are 3 types of rules:

- static: `StaticApiContext`
- test: `HttpTestContext`
- analytics: `AnalyticsApiContext`

Each type has a different way of working. And each type is represented by another context. A context models the access to the HTTP APIs which varies between the types.

## `StaticApiContext`

`StaticApiContext` only works on the description of HTTP APIs. It does not make any HTTP calls. It onyl checks the internal used Thymian format for rule violations. This is similar to spectral or zally.
While this context is limited to the description of the HTTP APIs, it provides great speed and fits well to a design first development process. it is one pillar to prevent an API drift. to run the same rule
against the static descriptions and the actual API Thymian can prevent that these two does not match.

## `HttpTestContext`

with this context a rule can make HTTP calls to the API. Thereby it can test the actual behavior of the API. It have access to the Thymian format and can make an request that is documented in the Thymian format.
and the thymian format holds the information that is provided by an OpenAPI document for example.

## `AnalyticsApiContext`

the analytics context goes another step further. with this context any HTTP traffic can be linted. The source of this traffic can be a file, a database or any other source.

## How does these rule types belong together?

these 3 contexts share a common super class, the `ApiContext`. When the interface of this superclass is used by a rule, the logic of the rule can be reused for all 3 contexts. This is made possible
through the usage of the `HttpFilterExpressions` from @thymnian/core. For me details the combining rules docs. these expressions are a DSL to describe the HTTP traffic.
