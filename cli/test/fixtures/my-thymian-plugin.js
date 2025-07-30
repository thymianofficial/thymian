export default {
  name: 'my-thymian-plugin',
  version: '0.0.1',
  plugin(emitter) {
    emitter.onAction('http-testing.authorize', (payload, ctx) => {
      ctx.reply({
        value: {
          headers: {
            authorization: 'Basic bWF0dGh5azpxdXBheWE=',
          },
        },
      });
    });
  },
};
