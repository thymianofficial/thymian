export const exampleContentGenerator = async (schema) => {
    if (typeof schema === 'boolean') {
        return { content: {} };
    }
    else {
        return { content: schema.examples?.[0] };
    }
};
export const identityHookRunner = async (a, b) => b;
//# sourceMappingURL=utils.js.map