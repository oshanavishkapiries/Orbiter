import chalk from 'chalk';
import { config } from '../config/index.js';
import { logger } from '../cli/ui/logger.js';
import { readJson, fileExists } from '../utils/fs.js';
import { ExecutionContext } from '../core/execution-context.js';
import { McpClient } from '../mcp/client.js';
import { getToolRegistry, initializeTools } from '../tools/index.js';
import { createProgressBar } from '../cli/ui/progress.js';
import { ParameterEngine } from './parameters.js';
import { OutputFormatter } from './output-formatter.js';
import { Flow, FlowStep, ReplayOptions, ReplayResult } from './schema.js';

export class FlowReplayer {
  private context: ExecutionContext;
  private mcpClient: McpClient;
  private paramEngine: ParameterEngine;
  private formatter: OutputFormatter;

  constructor() {
    this.context = new ExecutionContext();
    this.mcpClient = new McpClient();
    this.paramEngine = new ParameterEngine();
    this.formatter = new OutputFormatter();
  }

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

  async replay(flowPath: string, options: ReplayOptions = {}): Promise<ReplayResult> {
    const startTime = Date.now();
    const cfg = config();

    console.log('\n' + chalk.cyan.bold('🔄 ORBITER - Flow Replay') + '\n');
    console.log(chalk.gray('─'.repeat(60)) + '\n');

    const flow = this.loadFlow(flowPath);

    if (options.parameters) {
      this.paramEngine = new ParameterEngine(options.parameters);
    }
    if (options.parametersFile) {
      this.paramEngine.loadFromFile(options.parametersFile);
    }

    if (flow.parameters.length > 0) {
      const validation = this.paramEngine.validate(flow.parameters);
      if (!validation.valid) {
        throw new Error(
          `Missing required parameters: ${validation.missing.map((p) => `{{${p}}}`).join(', ')}`,
        );
      }
    }

    initializeTools();

    logger.info('Starting Playwright MCP server...');
    await this.mcpClient.connect({
      headless: options.headless ?? cfg.browser.headless,
      userDataDir: options.profilePath ?? cfg.browser.profilePath,
      executablePath: cfg.browser.executablePath,
      browser: (cfg.browser.channel as any) ?? undefined,
      viewport: cfg.browser.viewport,
      outputDir: './data/errors',
    });
    this.context.setMcpClient(this.mcpClient);
    logger.success('Browser ready');

    console.log('\n' + chalk.cyan('━'.repeat(60)) + '\n');
    logger.info(chalk.bold('REPLAY PHASE'));
    logger.info(`Replaying: ${chalk.cyan(flow.name)}`);
    logger.info(`Total steps: ${flow.steps.length}`);

    if (flow.parameters.length > 0) {
      logger.info(`Parameters: ${flow.parameters.map((p) => p.name).join(', ')}`);
    }

    console.log('');

    const stepsToReplay = flow.steps.filter((step) => {
      if (step.status === 'failed' && !step.metadata?.wasRetry) return false;
      if (step.metadata?.isDebugOnly) return false;
      if (options.skipSteps?.includes(step.id)) return false;
      return true;
    });

    logger.info(
      `Executing ${stepsToReplay.length} steps (skipped ${flow.steps.length - stepsToReplay.length} noise steps)\n`,
    );

    const progress = createProgressBar(stepsToReplay.length, 'Replaying');

    const errors: Array<{ stepId: number; error: string }> = [];
    const extractedData: any[] = [];
    let stepsExecuted = 0;
    let stepsFailed = 0;

    for (let i = 0; i < stepsToReplay.length; i++) {
      const step = stepsToReplay[i];
      const params = this.paramEngine.substituteParams(step.params);

      progress.update(i, `Step ${i + 1}/${stepsToReplay.length}: ${step.tool}`);

      try {
        const result = await this.executeStep(step, params);
        stepsExecuted++;

        if (step.tool === 'save_extracted_data' && result?.data) {
          if (Array.isArray(result.data)) {
            extractedData.push(...result.data);
          } else {
            extractedData.push(result.data);
          }
        }

        if (options.screenshotOnStep) {
          await this.mcpClient.callTool('browser_screenshot', {});
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

    this.displaySummary(result, flow);
    return result;
  }

  private async executeStep(step: FlowStep, params: Record<string, any>): Promise<any> {
    const registry = getToolRegistry();
    const startTime = Date.now();

    logger.step(step.id, step.id, step.tool, `${step.tool}`);
    logger.bullet(`Tool: ${chalk.cyan(step.tool)}`);

    if (step.selector) {
      logger.bullet(`Selector: ${chalk.gray(step.selector)}`);
    }

    // Route: MCP tools go through mcpClient, custom tools go through registry
    let toolResult: any;
    if (this.mcpClient.isMcpTool(step.tool)) {
      toolResult = await this.mcpClient.callTool(step.tool, params);
    } else {
      toolResult = await registry.execute(step.tool, params, this.context);
    }

    const duration = Date.now() - startTime;

    if (toolResult.success) {
      logger.success(`${step.tool} completed in ${(duration / 1000).toFixed(1)}s`);
      if (!this.mcpClient.isMcpTool(step.tool) && toolResult.message) logger.bullet(toolResult.message);
    } else {
      throw new Error(toolResult.error || `Tool ${step.tool} failed`);
    }

    return toolResult;
  }

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
      console.log(`  ${chalk.green('Items extracted:')} ${result.extractedData.length}`);
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

    const originalCost = flow.metadata?.estimatedCost;
    if (originalCost) {
      console.log(chalk.bold('vs. Original LLM execution:'));
      console.log(`  Original cost: ${chalk.yellow(`$${originalCost.toFixed(4)}`)}`);
      console.log(`  Original tokens: ${chalk.yellow(flow.metadata.totalTokensUsed?.toLocaleString() || '0')}`);
      console.log(`  ${chalk.green('Cost saved: 100% 💰')}\n`);
    }
  }

  async cleanup(): Promise<void> {
    await this.mcpClient.disconnect();
    await this.context.cleanup();
  }
}
