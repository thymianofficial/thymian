# 4. Solution Strategy

## 4.1 Usability / Developer Experience

1. Thymian returns not only found issues but also descriptions of the RFC and problems that may be a result of the issue.
2. The Thymian CLI follows the [Command Line Interface Guidelines](https://clig.dev).
3. The user documentation follows the [Diátaxis Guidelines](https://diataxis.fr).

## 4.2 Modularity

1. Thymian is modularized into multiple packages, which are implemented as plugins.
2. Thymian uses events to communicate between plugins.

## 4.3 Compatibility

1. Proxy plugins can connect Thymian to different languages and frameworks and vice versa.
