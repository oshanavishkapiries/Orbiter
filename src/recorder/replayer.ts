import chalk from 'chalk';
import { config } from '../config/index.js';
import { logger } from '../cli/ui/logger.js';
import { readJson, fileExists } from '../utils/fs.js';
import { ExecutionContext } from '../core/execution-context.js';
import { getToolRegistry, initializeTools } from '../tools/index.js';
import { createProgressBar } from '../cli/ui/progress.js';
import { ParameterEngine } from './parameters.js';
import { OutputFormatter } from './output-formatter.js';
import { Flow, FlowStep, ReplayOptions, ReplayResult } from './schema.js';

export class FlowReplayer {
  private context: ExecutionContext;
  private paramEngine: ParameterEngine;
  private formatter: OutputFormatter;

  constructor() {
    this.context = new ExecutionContext();
    this.paramEngine = new ParameterEngine();
    this.formatter = new OutputFormatter();
  }

  /**
   * Load and validate flow from file
   */
  loadFlow(flowPath: string): Flow {
    if (!fileExists(flowPath)) {
      throw new Error(`Flow file not found: ${flowPath}`);
    }

    const flow = readJson<Flow>(flowPath);

    if (!flow.id || !flow.steps || !Array.isArray(flow.steps)) {
      throw new Error('Invalid flow file format');
    }

    logger.info(`Flow loaded: ${flow.name}`);
    logger.bullet(`Steps: ${flow.steps.length}`);
    logger.bullet(`Created: ${new Date(flow.createdAt).toLocaleString()}`);
    logger.bullet(`Type: ${flow.type}`);

    return flow;
  }

  /**
   * Replay a flow file
   */
  async replay(
    flowPath: string,
    options: ReplayOptions = {},
  ): Promise<ReplayResult> {
    const startTime = Date.now();

    console.log('\n' + chalk.cyan.bold('🔄 ORBITER - Flow Replay') + '\n');
    console.log(chalk.gray('─'.repeat(60)) + '\n');

    // Load flow
    const flow = this.loadFlow(flowPath);

    // Setup parameters
    if (options.parameters) {
      this.paramEngine = new ParameterEngine(options.parameters);
    }
    if (options.parametersFile) {
      this.paramEngine.loadFromFile(options.parametersFile);
    }

    // Validate required parameters
    if (flow.parameters.length > 0) {
      const validation = this.paramEngine.validate(flow.parameters);
      if (!validation.valid) {
        throw new Error(
          `Missing required parameters: ${validation.missing.map((p) => `{{${p}}}`).join(', ')}`,
        );
      }
    }

    // Initialize tools
    initializeTools();

    // Initialize browser
    logger.info('Launching browser...');
    await this.context.initialize({
      headless: options.headless ?? config().browser.headless,
      profilePath: options.profilePath,
    });
    logger.success('Browser ready');

    console.log('\n' + chalk.cyan('━'.repeat(60)) + '\n');
    logger.info(chalk.bold('REPLAY PHASE'));
    logger.info(`Replaying: ${chalk.cyan(flow.name)}`);
    logger.info(`Total steps: ${flow.steps.length}`);

    if (flow.parameters.length > 0) {
      logger.info(
        `Parameters: ${flow.parameters.map((p) => p.name).join(', ')}`,
      );
    }

    console.log('');

    // Filter steps to replay
    const stepsToReplay = flow.steps.filter((step) => {
      // Skip failed steps by default (only replay successful ones)
      if (step.status === 'failed' && !step.metadata?.wasRetry) {
        return false;
      }
      // Skip debug-only steps
      if (step.metadata?.isDebugOnly) {
        return false;
      }
      // Skip explicitly requested steps
      if (options.skipSteps?.includes(step.id)) {
        return false;
      }
      return true;
    });

    logger.info(
      `Executing ${stepsToReplay.length} steps (skipped ${flow.steps.length - stepsToReplay.length} noise steps)\n`,
    );

    // Progress bar
    const progress = createProgressBar(stepsToReplay.length, 'Replaying');

    const errors: Array<{ stepId: number; error: string }> = [];
    const extractedData: any[] = [];
    let stepsExecuted = 0;
    let stepsFailed = 0;

    // Execute each step
    for (let i = 0; i < stepsToReplay.length; i++) {
      const step = stepsToReplay[i];

      // Substitute parameters
      const params = this.paramEngine.substituteParams(step.params);

      progress.update(i, `Step ${i + 1}/${stepsToReplay.length}: ${step.tool}`);

      try {
        const result = await this.executeStep(step, params, options);
        stepsExecuted++;

        // Collect extracted data
        if (
          (step.tool === 'extract_data' || step.tool === 'extract_text') &&
          result?.data
        ) {
          if (Array.isArray(result.data)) {
            extractedData.push(...result.data);
          } else {
            extractedData.push(result.data);
          }
        }

        // Screenshot on step if requested
        if (options.screenshotOnStep) {
          await this.context.getBrowserManager().screenshot({
            path: `./screenshots/replay-step-${i + 1}.png`,
          });
        }
      } catch (error) {
        stepsFailed++;
        const errorMsg = (error as Error).message;

        errors.push({ stepId: step.id, error: errorMsg });
        logger.error(`Step ${step.id} failed: ${errorMsg}`);

        if (options.stopOnError) {
          progress.stop();
          logger.error('Stopping replay due to error (--stop-on-error)');
          break;
        }
      }
    }

    progress.stop();

    // Save extracted data
    const outputFiles: string[] = [];
    if (extractedData.length > 0) {
      const filename = this.formatter.generateFilename(flow.name);
      const files = this.formatter.saveAll(extractedData, filename);
      outputFiles.push(...files);
    }

    const duration = Date.now() - startTime;
    const success = stepsFailed === 0;

    const result: ReplayResult = {
      flowId: flow.id,
      flowName: flow.name,
      success,
      stepsExecuted,
      stepsFailed,
      duration,
      extractedData: extractedData.length > 0 ? extractedData : undefined,
      outputFiles: outputFiles.length > 0 ? outputFiles : undefined,
      errors,
    };

    // Display summary
    this.displaySummary(result, flow);

    return result;
  }

  /**
   * Execute a single step
   */
  private async executeStep(
    step: FlowStep,
    params: Record<string, any>,
    options: ReplayOptions,
  ): Promise<any> {
    const registry = getToolRegistry();
    const browser = this.context.getBrowserManager();

    // Update page context in browser manager
    if (browser.isLaunched()) {
      const page = browser.getPage();
      const url = page.url();
      const title = await page.title().catch(() => '');
      this.context.getBrowserManager();
    }

    const startTime = Date.now();

    logger.step(step.id, step.id, step.tool, `${step.tool}`);
    logger.bullet(`Tool: ${chalk.cyan(step.tool)}`);

    if (step.selector) {
      logger.bullet(`Selector: ${chalk.gray(step.selector)}`);
    }

    // Execute tool
    const toolResult = await registry.execute(step.tool, params, this.context);
    const duration = Date.now() - startTime;

    if (toolResult.success) {
      logger.success(
        `${step.tool} completed in ${(duration / 1000).toFixed(1)}s`,
      );
      if (toolResult.message) {
        logger.bullet(toolResult.message);
      }
    } else {
      throw new Error(toolResult.error || `Tool ${step.tool} failed`);
    }

    return toolResult;
  }

  /**
   * Display replay summary
   */
  private displaySummary(result: ReplayResult, flow: Flow): void {
    console.log('\n' + chalk.cyan('━'.repeat(60)) + '\n');

    if (result.success) {
      console.log(chalk.green.bold('✅ REPLAY COMPLETED SUCCESSFULLY') + '\n');
    } else {
      console.log(chalk.yellow.bold('⚠️  REPLAY COMPLETED WITH ERRORS') + '\n');
    }

    console.log(chalk.bold('Results:'));
    console.log(`  Flow: ${chalk.cyan(result.flowName)}`);
    console.log(`  Steps executed: ${result.stepsExecuted}`);

    if (result.stepsFailed > 0) {
      console.log(`  ${chalk.red('Steps failed:')} ${result.stepsFailed}`);
    }

    if (result.extractedData && result.extractedData.length > 0) {
      console.log(
        `  ${chalk.green('Items extracted:')} ${result.extractedData.length}`,
      );
    }

    if (result.outputFiles && result.outputFiles.length > 0) {
      console.log('\n' + chalk.bold('Output files:'));
      for (const file of result.outputFiles) {
        console.log(`  📄 ${file}`);
      }
    }

    if (result.errors.length > 0) {
      console.log('\n' + chalk.bold('Errors:'));
      for (const err of result.errors) {
        console.log(`  ${chalk.red('✖')} Step ${err.stepId}: ${err.error}`);
      }
    }

    console.log('\n' + chalk.bold('Performance:'));
    console.log(`  Duration: ${(result.duration / 1000).toFixed(1)}s`);
    console.log(`  LLM calls: ${chalk.green('0')} (replay mode)`);
    console.log(`  Cost: ${chalk.green('$0.00')} 💰\n`);

    // Compare with original
    const originalDuration = flow.metadata?.totalSteps
      ? flow.metadata.totalSteps * 2000
      : 0;

    if (originalDuration > 0) {
      const originalCost = `$${flow.metadata.estimatedCost?.toFixed(4) || '0.00'}`;
      console.log(chalk.bold('vs. Original LLM execution:'));
      console.log(`  Original cost: ${chalk.yellow(originalCost)}`);
      console.log(
        `  Original tokens: ${chalk.yellow(flow.metadata.totalTokensUsed?.toLocaleString() || '0')}`,
      );
      console.log(`  ${chalk.green('Cost saved: 100% 💰')}\n`);
    }
  }

  /**
   * Cleanup
   */
  async cleanup(): Promise<void> {
    await this.context.cleanup();
  }
}
