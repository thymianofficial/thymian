import { Args, Command } from '@oclif/core';

export default class Greet extends Command {
  static description = 'greet someone';
  static args = {
    name: Args.string({ required: true, description: 'who to greet' }),
  };

  async run() {
    const { args } = await this.parse(Greet);
    this.log(`Hello ${args.name}`);
  }
}
