---
title: 'Combining Different Rule Types'
description: 'TODO'
---

- sometimes the common interace of the `ApiContext` is not enough
- if this is the case, the logic for the different rule types must be implemented separately
- in the following the different rule types are combined and it is showed how to do this

ig general the logic of the rule can always defined by using the interface of the `ApiContext` class. Then if for one type of rule a special logic is needed, the logic can be implemented in a separate function using the
`overrideStaticRule` APIs. These function are available for each context type.

## `StaticApiContext` & `HttpTestApiContext`

when the rule logic can be tested on the static description of the api AND by running specific tests against the api

## `StaticApiContext` & `AnalyticsApiContext`

when the rule logic can be tested on the static description of the api AND by analyzing recorded traffic

## `AnalyticsApiContext` & `HttpTestApiContext`

when rule logic can be tested by analyzing recorded traffic AND by running specific tests against the api

## `StaticApiContext` & `AnalyticsApiContext` & `HttpTestApiContext`

when rule logic can be tested on the static description of the api AND by analyzing recorded traffic AND by running specific tests against the api
