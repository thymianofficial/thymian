---
title: 'What is an HTTP Rule?'
description: 'TODO'
---

- an http rule in Thymian takes the concept of rules known from linters like ESLint and applies it to HTTP APIs
- with these HTTP rules you can test and ensure your API is following the HTTP specification/industry best practices or you custom/company wide guidelines
- A Similar approach follows spectral for example. But Thymian not only allows to lint static documents but also to test your live API with the same set of rules
- For this @thymian/http-linter provides access to 3 different interfaces/contexts:
  - `StaticApiContext`: Write rules for static documents
  - `LiveApiContext`: Write rules to generate specific traffic. You decide which traffic is generated and tested based on the provided API descriptions
  - `AnalyticApiContext`: Lint arbitrary HTTP traffic
- To ease the development of rules, the HTTP Linter provides several mechanisms to define the logic of a rule once and reuse it for all 3 contexts
- The different interfaces avoid API drift and guarantee API governance at any stage of the development lifecycle
- A rule consists of a severity level
- A rule has a name and a description
- A rule can have reference links, for example to the document describing the rule (RFC 9110 or any other document, such as enterprise API governance docs)
