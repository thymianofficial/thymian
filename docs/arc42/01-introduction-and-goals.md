# 1. Introduction & Goals

Thymian checks HTTP APIs for compliance with the HTTP standard. It runs static checks on API specifications and dynamic checks on API implementations by running HTTP requests and examining the response. It creates reports in human-readable and machine-readable formats. This allows for direct use by developers, as well as for integration into continuous integration pipelines and AI-based development processes.

The main goal is to support API designers and developers in the creation of compliant APIs, as compliancy with the HTTP standard is a prerequisite for interoperability and security.

## 1.1 Requirements Overview

1. Authors either write API specifications in supported formats, e.g. OpenAPI, or use a tool to generate them from existing API implementations.
2. Thymian checks the API specifications and the API implementations (if applicable) for compliance with the HTTP standard.
3. Thymian creates a test report in a specified format. The test reports should not only state the issues found but also provide explanations and reasons for the issues to improve the understanding of the HTTP standard.
4. Thymian can be extended with custom checks and other functionality.

## 1.2 Quality Goals

| ID     | Scenario                                                                                                                                |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| 10.2.1 | A user who does not know Thymian can use it after 10 minutes of instruction.                                                            |
| 10.2.2 | A developer can create a first plugin for Thymian after 20 minutes of instruction.                                                      |
| 10.2.3 | When a new API specification format needs to be validated by Thymian, the only change is adding a plugin for loading the specification. |

## 1.3 Stakeholder

| Role              | Expectations                                                                                                                  |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| API developer     | Thymian should be able to check APIs written in different programming languages and API formats for HTTP standard compliance. |
| Plugin developer  | ...                                                                                                                           |
| Thymian developer | ...                                                                                                                           |
| Quality assurance | ...                                                                                                                           |
