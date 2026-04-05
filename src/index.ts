#!/usr/bin/env node

import 'dotenv/config';
import { createCLI } from './cli/index.js';

async function main() {
  const cli = createCLI();
  
  try {
    await cli.parseAsync(process.argv);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();