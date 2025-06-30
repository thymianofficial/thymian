export default {
  name: 'my-thymian-plugin',
  version: '0.0.1',
  plugin(emitter, logger, opts) {
    console.log({ opts });

    emitter.onHook('core.close', () => {
      logger.info('Hello from my-thymian-plugin.');
    });
  },
};
