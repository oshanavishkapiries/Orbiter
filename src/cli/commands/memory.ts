import { Command } from 'commander';
import chalk from 'chalk';
import { getMemoryManager } from '../../memory/manager.js';
import { logger } from '../ui/logger.js';

export function memoryCommand() {
  const cmd = new Command('memory');

  cmd
    .description('Manage Orbiter PostgreSQL memory database')
    .addCommand(memoryStatsCommand())
    .addCommand(memoryListCommand())
    .addCommand(memoryClearCommand())
    .addCommand(memorySearchCommand());

  return cmd;
}

function memoryStatsCommand() {
  return new Command('stats')
    .description('Show memory database statistics')
    .action(async () => {
      const memory = await getMemoryManager();
      const stats = await memory.getStats();

      console.log('\n' + chalk.bold('📊 Memory Database Statistics'));
      console.log(chalk.gray('─'.repeat(50)));

      // Database info
      console.log('\n' + chalk.bold('Database:'));
      console.log(`  Host:     ${chalk.gray(stats.database.host)}`);
      console.log(`  Database: ${chalk.cyan(stats.database.database)}`);

      // Table counts
      console.log('\n' + chalk.bold('Tables:'));
      for (const [table, count] of Object.entries(stats.database.tables)) {
        if (count > 0) {
          console.log(`  ${table}: ${chalk.cyan(count)}`);
        }
      }

      // Memory stats
      console.log('\n' + chalk.bold('Memory Entries:'));
      console.log(`  Total: ${chalk.cyan(stats.memory.total)}`);
      console.log(
        `  Avg confidence: ${chalk.cyan((stats.memory.averageConfidence * 100).toFixed(1) + '%')}`,
      );

      // By type
      if (Object.keys(stats.memory.byType).length > 0) {
        console.log('\n' + chalk.bold('By Type:'));
        for (const [type, count] of Object.entries(stats.memory.byType)) {
          if (count > 0) {
            console.log(`  ${type}: ${count}`);
          }
        }
      }

      // By domain
      if (Object.keys(stats.memory.byDomain).length > 0) {
        console.log('\n' + chalk.bold('By Domain (top 10):'));
        const domains = Object.entries(stats.memory.byDomain).slice(0, 10);
        for (const [domain, count] of domains) {
          console.log(`  ${domain}: ${count}`);
        }
      }

      console.log('');
    });
}

function memoryListCommand() {
  return new Command('list')
    .description('List stored selectors')
    .option('-d, --domain <domain>', 'Filter by domain')
    .option('-l, --limit <number>', 'Limit results', '20')
    .action(async (options) => {
      const memory = await getMemoryManager();

      if (!options.domain) {
        console.log(
          chalk.yellow('\nSpecify a domain with --domain <domain>\n'),
        );
        return;
      }

      const selectors = await memory.getDomainSelectors(options.domain);

      console.log('\n' + chalk.bold(`📝 Selectors for ${options.domain}`));
      console.log(chalk.gray('─'.repeat(60)));

      if (selectors.length === 0) {
        console.log(chalk.gray('  No selectors found'));
      } else {
        for (const sel of selectors.slice(0, parseInt(options.limit))) {
          const conf = (sel.confidence * 100).toFixed(0) + '%';
          const fallbackCount = sel.fallbacks.length;

          console.log(
            `\n  ${chalk.cyan(sel.element_name)} ${chalk.gray(`[${sel.element_type}]`)}`,
          );
          console.log(`    Selector:   ${chalk.white(sel.primary_selector)}`);
          console.log(`    Confidence: ${chalk.yellow(conf)}`);
          console.log(
            `    Usage:      ${sel.usage_count} times (${sel.success_count} success)`,
          );

          if (fallbackCount > 0) {
            console.log(`    Fallbacks:  ${fallbackCount}`);
          }
        }
      }

      console.log('');
    });
}

function memorySearchCommand() {
  return new Command('search')
    .description('Search selectors by name')
    .argument('<domain>', 'Domain to search')
    .argument('<query>', 'Search query')
    .action(async (domain, query) => {
      const memory = await getMemoryManager();
      const results = await memory.searchSelectors(domain, query);

      console.log(
        '\n' + chalk.bold(`🔍 Search results for "${query}" on ${domain}`),
      );
      console.log(chalk.gray('─'.repeat(50)));

      if (results.length === 0) {
        console.log(chalk.gray('  No results found'));
      } else {
        for (const sel of results) {
          console.log(
            `  ${chalk.cyan(sel.element_name)}: ` +
              chalk.gray(sel.primary_selector),
          );
        }
      }

      console.log('');
    });
}

function memoryClearCommand() {
  return new Command('clear')
    .description('Clear memory')
    .option('-d, --domain <domain>', 'Clear only specific domain')
    .option('--all', 'Clear ALL memories (use with caution)')
    .option('--yes', 'Skip confirmation')
    .action(async (options) => {
      const memory = await getMemoryManager();

      if (options.all) {
        if (!options.yes) {
          const readline = await import('readline');
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
          });

          const answer = await new Promise<string>((resolve) => {
            rl.question(
              chalk.yellow(
                'Are you sure you want to clear ALL memories? (yes/no): ',
              ),
              resolve,
            );
          });
          rl.close();

          if (answer.toLowerCase() !== 'yes') {
            console.log('Cancelled');
            return;
          }
        }

        const count = await memory.clearAll();
        logger.success(`Cleared ${count} memory entries`);
      } else if (options.domain) {
        const count = await memory.clearDomain(options.domain);
        logger.success(`Cleared ${count} memories for ${options.domain}`);
      } else {
        console.log('Specify --all or --domain <domain>');
      }
    });
}
