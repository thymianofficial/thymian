export default {
  name: 'my-thymian-plugin',
  version: '0.0.1',
  plugin(emitter, logger) {
    emitter.on('core.close', () => {
      logger.info('Hello from my-thymian-plugin.');
    });
  },
};
