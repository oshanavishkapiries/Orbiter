import { Command } from 'commander';
import { LLMFactory } from '../../llm/factory.js';
import { logger } from '../ui/logger.js';
import chalk from 'chalk';

export function modelsCommand() {
  const cmd = new Command('models');

  cmd
    .description('List available LLM models')
    .option(
      '-p, --provider <provider>',
      'Filter by provider (openrouter, openai, anthropic)',
    )
    .action(async (options) => {
      try {
        console.log('\n' + chalk.bold('Available LLM Models') + '\n');

        const provider = LLMFactory.create();

        if (provider.name === 'openrouter') {
          const models = await (provider as any).getModels();

          console.log(
            chalk.gray(`Found ${models.length} models on OpenRouter\n`),
          );

          // Show popular models
          const popular = [
            'anthropic/claude-3.5-sonnet',
            'anthropic/claude-sonnet-4',
            'openai/gpt-4-turbo',
            'openai/gpt-4o',
            'google/gemini-pro',
            'meta-llama/llama-3.1-70b-instruct',
          ];

          console.log(chalk.bold('Popular models:'));
          for (const modelId of popular) {
            const model = models.find((m: any) => m.id === modelId);
            if (model) {
              console.log(`  ${chalk.cyan(model.id)}`);
              console.log(`    ${chalk.gray(model.name)}`);
              console.log(
                `    Context: ${chalk.yellow(model.context_length?.toLocaleString() || 'N/A')}`,
              );
              console.log('');
            }
          }

          console.log(
            chalk.gray('Visit https://openrouter.ai/models for full list'),
          );
        } else {
          console.log(
            chalk.yellow('Model listing not supported for this provider'),
          );
        }
      } catch (error) {
        logger.error(`Failed to fetch models: ${(error as Error).message}`);
        process.exit(1);
      }
    });

  return cmd;
}
