import { oclif, type ThymianFeedbackHook, wrap } from '@thymian/common-cli';

const hook: ThymianFeedbackHook = async () => {
  const message = `${oclif.ux.colorize('blueBright', `🚀  Tip: Found a bug or wanna give feedback? Run ${oclif.ux.colorize('bold', 'thymian feedback')}.`)}`;

  console.log(wrap(message));
  console.log();
};

export default hook;
