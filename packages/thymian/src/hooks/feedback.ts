import { oclif, type ThymianFeedbackHook } from '@thymian/cli-common';

const hook: ThymianFeedbackHook = async () => {
  const message = `${oclif.ux.colorize('blueBright', `🚀  Tip: Found a bug or wanna give feedback? Run ${oclif.ux.colorize('bold', 'thymian feedback')}.`)}`;

  console.log(message);
  console.log();
};

export default hook;
