#!/usr/bin/env node

import path from 'path';
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

try {
  const configPath = path.resolve((args.config || './config.js'));
  const config = require(configPath);
  new Deploy(config);
} catch(e) {
  console.log('Error', e);
}


