# 10. Quality Requirements

## 10.1 Quality Requirements Overview

| Quality Category | Quality          | Description                                                                                                                                                                                                                       | ID            | Related ADRs                                                                                      |
| ---------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------- |
| Usability        | Learnability     | It should be easy to understand how to use Thymian, whithout extensive instruction reading. Users should recognize patterns in the interaction with Thymian from other tools.                                                     | 10.2.1        | [ADR-0003](adr/0003-plugins-allow-streaming.md)                                                   |
|                  | User engagement  | Thymian should encourage users by ease of use and good, understandable feedback to use it more to verify their APIs. It should also encourage developers to add their own plugins or rules by providing an easy way to add these. | 10.2.2        | [ADR-0001](adr/0001-core-features-as-plugins.md), [ADR-0003](adr/0003-plugins-allow-streaming.md) |
| Maintainability  | Modularity       | It should be easy to add checks and configure modules or add new ones to extend the functionality of Thymian or tailor it to ones own needs.                                                                                      | 10.2.3        | [ADR-0001](adr/0001-core-features-as-plugins.md), [ADR-0004](adr/0004-plugins-run-isolated.md)    |
| Compatibility    | Interoperability | It should be possible to integrate Thymian with other products, like IDEs, and allow writing extensions in other languages so developers don't need to learn the language that is used to write Thymian.                          | 10.2.3 10.2.4 | [ADR-0002](adr/0002-communication-as-plugin.md)                                                   |
| Reliability      | Faultlessness    | Thymian should evaluate API specifications correctly and don't give false positives or false negatives. Rulesets that validate standards should match the standard.                                                               |               | —                                                                                                 |
| Flexibility      | Adaptability     | Which of Thymians modules are used and (if applicable) the modules itself should be configurable to match the users usecases.                                                                                                     |               | —                                                                                                 |

## 10.2 Quality Scenarios

| ID     | Scenario                                                                                                                                |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| 10.2.1 | A user who does not know Thymian can use it after 10 minutes of instruction.                                                            |
| 10.2.2 | A developer can create a first plugin for Thymian after 20 minutes of instruction.                                                      |
| 10.2.3 | When a new API specification format needs to be validated by Thymian, the only change is adding a plugin for loading the specification. |
| 10.2.4 | A developer who wants to write a plugin for Thymian, can write the plugin in His/Her prefered programming language.                     |
