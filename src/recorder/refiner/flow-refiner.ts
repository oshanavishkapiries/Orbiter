import { createInterface } from 'node:readline';
import chalk from 'chalk';
import { logger } from '../../cli/ui/logger.js';
import { readJson, fileExists } from '../../utils/fs.js';
import { LLMFactory } from '../../llm/factory.js';
import { AutoCleaner } from './auto-cleaner.js';
import { SelectorOptimizer } from './selector-optimizer.js';
import { LLMFlowOptimizer } from './llm-optimizer.js';
import { InteractiveReviewer } from './interactive-reviewer.js';
import { FlowDiffViewer } from './diff-viewer.js';
import { Flow, FlowStep } from '../schema.js';
import { OptimizedFlow, RefineOptions } from './types.js';
import { DatabaseConnection } from '../../memory/database/connection.js';
import { DataRepository } from '../../memory/database/repositories/data-repository.js';

export class FlowRefiner {
  private autoCleaner: AutoCleaner;
  private selectorOptimizer: SelectorOptimizer;
  private diffViewer: FlowDiffViewer;

  constructor() {
    this.autoCleaner = new AutoCleaner();
    this.selectorOptimizer = new SelectorOptimizer();
    this.diffViewer = new FlowDiffViewer();
  }

  async refine(rawFlowOrId: string, options: RefineOptions): Promise<string> {
    console.log('\n' + chalk.cyan.bold('🧹 ORBITER - Flow Refiner'));
    console.log(chalk.gray('─'.repeat(60)) + '\n');

    const rawFlow = await this.loadFlow(rawFlowOrId);

    logger.info(`Loaded: ${rawFlow.name}`);
    logger.bullet(`Original steps: ${rawFlow.steps.length}`);
    logger.bullet(`Recorded: ${new Date(rawFlow.createdAt).toLocaleString()}`);
    logger.bullet(`LLM tokens used: ${rawFlow.metadata.totalTokensUsed}`);
    console.log('');

    let currentSteps = [...rawFlow.steps];
    const optimizationMethods: string[] = [];

    // ─── Phase 1: Auto Cleanup ─────────────────────────────
    if (options.autoClean) {
      logger.info(chalk.bold('Phase 1: Auto Cleanup'));

      const { steps: cleaned, report } = this.autoCleaner.clean(currentSteps);

      this.diffViewer.displayDiff(currentSteps, cleaned, report);

      currentSteps = cleaned;
      optimizationMethods.push('auto_cleanup');

      console.log('');
    }

    // ─── Phase 2: Selector Analysis ───────────────────────
    logger.info(chalk.bold('Phase 2: Selector Analysis'));

    const selectorIssues: string[] = [];

    for (const step of currentSteps) {
      if (!step.selector) continue;

      const analysis = this.selectorOptimizer.analyze(step.selector);

      if (analysis.stability === 'low') {
        selectorIssues.push(
          `  ${chalk.yellow('⚠')} Step ${step.id} (${step.tool}): ` +
            chalk.gray(analysis.original) +
            '\n    ' +
            chalk.gray(analysis.reason),
        );
      }
    }

    if (selectorIssues.length > 0) {
      console.log(chalk.yellow('\nFragile selectors detected:'));
      console.log(selectorIssues.join('\n'));
    } else {
      logger.success('All selectors look stable');
    }

    console.log('');

    // ─── Phase 3: LLM Optimization ────────────────────────
    let llmSuggestions: string[] = [];
    let llmTokensUsed = 0;

    if (options.llmOptimize) {
      logger.info(chalk.bold('Phase 3: LLM Optimization'));

      const estimatedTokens = JSON.stringify(currentSteps).length / 4;
      logger.bullet(
        `Estimated tokens: ~${Math.round(estimatedTokens).toLocaleString()}`,
      );

      const confirm = await this.confirmAction(
        `Run LLM optimization? (uses ~${Math.round(estimatedTokens)} tokens) [Y/n]: `,
      );

      if (confirm) {
        try {
          const llm = LLMFactory.create();
          const optimizer = new LLMFlowOptimizer(llm);

          const result = await optimizer.optimize(
            currentSteps,
            rawFlow.metadata.originalPrompt,
          );

          llmSuggestions = result.suggestions;
          llmTokensUsed = result.tokenUsed;
          optimizationMethods.push('llm_optimization');

          this.diffViewer.displaySuggestions(result.suggestions);

          currentSteps = result.optimizedSteps.map((s, idx) => ({
            ...(currentSteps[idx] || {}),
            ...s,
            id: idx + 1,
          })) as FlowStep[];

          logger.success(`LLM optimization used ${llmTokensUsed} tokens`);
        } catch (error) {
          logger.warn(`LLM optimization failed: ${(error as Error).message}`);
          logger.info('Continuing without LLM optimization...');
        }
      } else {
        logger.info('LLM optimization skipped');
      }

      console.log('');
    }

    // ─── Phase 4: Interactive Review ──────────────────────
    if (options.interactive) {
      logger.info(chalk.bold('Phase 4: Interactive Review'));
      console.log('');

      const reviewer = new InteractiveReviewer();
      currentSteps = await reviewer.review(currentSteps);
      optimizationMethods.push('interactive_review');

      console.log('');
    }

    // ─── Build Optimized Flow ─────────────────────────────
    const reductionPercent = Math.round(
      ((rawFlow.steps.length - currentSteps.length) / rawFlow.steps.length) * 100,
    );

    const estimatedReplayTime = currentSteps.length * 2;

    const optimizedFlow: OptimizedFlow = {
      id: rawFlow.id + '_optimized',
      name: rawFlow.name,
      description: rawFlow.metadata.originalPrompt,
      version: 1,
      type: 'optimized',
      createdAt: rawFlow.createdAt,
      updatedAt: Date.now(),
      parameters: rawFlow.parameters,
      steps: currentSteps.map((step, index) => ({
        id: index + 1,
        tool: step.tool,
        params: step.params,
        selector: step.selector,
        selectors: this.buildSelectorChain(step),
        selectorStrategy: 'first_match' as const,
        reasoning: (step as any).reasoning || undefined,
      })),
      metadata: {
        originalFlowId: rawFlow.id,
        originalStepCount: rawFlow.steps.length,
        optimizedStepCount: currentSteps.length,
        reductionPercent,
        optimizedAt: Date.now(),
        optimizationMethod: optimizationMethods,
        estimatedReplayTime,
      },
    };

    this.diffViewer.displayFinalSteps(optimizedFlow.steps);

    // ─── Save to DB ────────────────────────────────────────
    let outputRef = optimizedFlow.id;

    if (!options.dryRun) {
      outputRef = await this.saveOptimizedFlow(optimizedFlow);
    } else {
      logger.info('\nDry run - flow not saved');
    }

    this.displayFinalSummary(
      rawFlow.steps.length,
      currentSteps.length,
      reductionPercent,
      estimatedReplayTime,
      outputRef,
    );

    return outputRef;
  }

  private async loadFlow(flowOrId: string): Promise<Flow> {
    // Try DB first
    if (flowOrId.startsWith('flow_') || flowOrId.startsWith('flow-')) {
      try {
        await DatabaseConnection.getInstance().initialize();
        const repo = new DataRepository();
        const flow = await repo.loadFlow(flowOrId);
        if (flow) return flow as Flow;
      } catch (err) {
        logger.debug(`DB flow load failed: ${(err as Error).message}`);
      }
    }

    // Fallback to file
    if (!fileExists(flowOrId)) {
      throw new Error(`Flow not found: "${flowOrId}" (tried database and file system)`);
    }

    const flow = readJson<Flow>(flowOrId);
    if (!flow.id || !flow.steps || !Array.isArray(flow.steps)) {
      throw new Error('Invalid flow file format');
    }

    return flow;
  }

  private async saveOptimizedFlow(flow: OptimizedFlow): Promise<string> {
    try {
      await DatabaseConnection.getInstance().initialize();
      const repo = new DataRepository();
      const id = await repo.saveFlow(flow as any);
      logger.success(`\nOptimized flow saved to database (id: ${id})`);
      return id;
    } catch (err) {
      logger.warn(`Failed to save optimized flow to DB: ${(err as Error).message}`);
      return flow.id;
    }
  }

  private buildSelectorChain(step: FlowStep): string[] {
    const selectors: string[] = [];

    if (step.selector) {
      selectors.push(step.selector);
    }

    if (step.recoveryAttempts) {
      const recovered = this.selectorOptimizer.extractRecoverySelectors(step);
      for (const sel of recovered) {
        if (!selectors.includes(sel)) {
          selectors.push(sel);
        }
      }
    }

    return selectors;
  }

  private async confirmAction(question: string): Promise<boolean> {
    return new Promise((resolve) => {
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      rl.question(chalk.yellow(question), (answer: string) => {
        rl.close();
        const normalized = answer.toLowerCase().trim();
        resolve(normalized === '' || normalized === 'y' || normalized === 'yes');
      });
    });
  }

  private displayFinalSummary(
    originalCount: number,
    finalCount: number,
    reductionPercent: number,
    estimatedReplayTime: number,
    outputRef: string,
  ): void {
    console.log('\n' + chalk.cyan('─'.repeat(60)));
    console.log(chalk.green.bold('\n✅ FLOW OPTIMIZATION COMPLETE\n'));

    console.log(chalk.bold('Results:'));
    console.log(
      `  Steps: ${chalk.yellow(originalCount)} → ${chalk.green(finalCount)}` +
        chalk.gray(` (${reductionPercent}% reduction)`),
    );
    console.log(`  Estimated replay time: ${chalk.green(`~${estimatedReplayTime}s`)}`);

    console.log('\n' + chalk.bold('Output:'));
    console.log(`  📄 ${outputRef} ${chalk.dim('(database)')}`);

    console.log('\n' + chalk.bold('Next steps:'));
    console.log(`  • Replay: ${chalk.cyan(`orbiter replay ${outputRef}`)}`);
    console.log(
      `  • With params: ${chalk.cyan(`orbiter replay ${outputRef} --params '{"KEY":"value"}'`)}`,
    );
    console.log('');
  }
}
