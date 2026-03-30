#!/usr/bin/env node

import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { editCommand } from './commands/edit.js';
import { setCommand } from './commands/set.js';
import { getCommand } from './commands/get.js';
import { listCommand } from './commands/list.js';
import { decryptCommand } from './commands/decrypt.js';
import { exportCommand } from './commands/export.js';
import { importCommand } from './commands/import.js';

const program = new Command()
  .name('touchenv')
  .description('Encrypted .env file manager')
  .version('0.1.0');

program.addCommand(initCommand);
program.addCommand(editCommand);
program.addCommand(setCommand);
program.addCommand(getCommand);
program.addCommand(listCommand);
program.addCommand(decryptCommand);
program.addCommand(exportCommand);
program.addCommand(importCommand);

program.parseAsync().catch((err: Error) => {
  console.error(`error: ${err.message}`);
  process.exit(1);
});
