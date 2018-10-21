#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import Deploy from './deploy.js';

/* eslint-disable no-console */

const rawArgs = process.argv.slice(2); 
const args = {};

rawArgs.filter((arg, i) => {
  if (arg.includes('--')) {
    const name = arg.slice(2, arg.length);
    Object.assign(args, { [name]: rawArgs[i + 1] });
  }
});

const configPath = path.resolve((args.config || './deploy.config.js'));
fs.readFile(configPath, 'utf8', err => {
  if (err) {
    Deploy.error(`Config file is not found.\n\nPlease do one of the following:\n   - check if ${ chalk.blue('deploy.config.js') } file added to the root folder\n   - run command with ${ chalk.blue('--config path/to/deploy.config.js') }`);
  } else {
    const config = require(configPath);
    new Deploy(config);
  }
});