export const beforeEachRequestHook = `import * as Hooks from '@thymian/hooks';

const hook: Hooks.BeforeEachRequestHook = async (request, context, utils) => {

  return request;
}

export default hook;
`;

export const afterEachRequestHook = `import * as Hooks from '@thymian/hooks';

const hook: Hooks.AfterEachRequestHook = async (response, context, utils) => {

  return response;
}

export default hook;
`;

export const authorizeHook = `import * as Hooks from '@thymian/hooks';

const hook: Hooks.AuthorizeHook = async (request, context, utils) => {

  return request;
}

export default hook;
`;
