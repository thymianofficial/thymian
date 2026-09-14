---
title: Concern Tags
description: The closed vocabulary of concern tags a rule can carry.
---

Generated from `ruleTagDescriptions` in `@thymian/core`. A rule's own tag is always fully
qualified and terminal (`category:member`); a bare category is only a legal _pattern_ for
matching against tags, never a legal tag on a rule.

## security

| Tag                          | Description                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------ |
| `security:transport`         | Transport security: TLS, HSTS, scheme downgrade, secure-channel requirements.              |
| `security:cors`              | Cross-origin resource sharing: preflight, credentials, wildcards, header safelisting.      |
| `security:cookies`           | Cookie syntax, attributes, lifetime and scope.                                             |
| `security:csp`               | Content Security Policy delivery and content.                                              |
| `security:content-type`      | Media type handling: sniffing, nosniff, type confusion.                                    |
| `security:authentication`    | Authentication: challenges, credentials, scheme selection.                                 |
| `security:authorization`     | Authorization: object-, property- and function-level access control.                       |
| `security:disclosure`        | Unintended disclosure of internals, versions, or other parties' data.                      |
| `security:dos`               | Resource consumption and denial of service.                                                |
| `security:cache-poisoning`   | Cache poisoning: unkeyed inputs and response splitting reaching a shared cache.            |
| `security:request-smuggling` | Request smuggling: message-framing ambiguity that lets two hops disagree about boundaries. |
| `security:clickjacking`      | Clickjacking: UI redress by framing a page inside another origin.                          |
| `security:csrf`              | Cross-site request forgery: state-changing requests forged across origins.                 |
| `security:spoofing`          | Spoofing: forged identity, origin, or message provenance.                                  |

## privacy

| Tag                      | Description                                          |
| ------------------------ | ---------------------------------------------------- |
| `privacy:tracking`       | Cross-site tracking and correlation of users.        |
| `privacy:fingerprinting` | Passive identification from message characteristics. |
| `privacy:referrer`       | Referrer leakage across origins and down to HTTP.    |
