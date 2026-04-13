import path from 'path';
import { createInterface } from 'node:readline';
import chalk from 'chalk';
import { config } from '../../config/index.js';
import { logger } from '../../cli/ui/logger.js';
import { readJson, writeJson, fileExists } from '../../utils/fs.js';
import { LLMFactory } from '../../llm/factory.js';
import { AutoCleaner } from './auto-cleaner.js';
import { SelectorOptimizer } from './selector-optimizer.js';
import { LLMFlowOptimizer } from './llm-optimizer.js';
import { InteractiveReviewer } from './interactive-reviewer.js';
import { FlowDiffViewer } from './diff-viewer.js';
import { Flow, FlowStep } from '../schema.js';
import { OptimizedFlow, RefineOptions } from './types.js';

export class FlowRefiner {
  private autoCleaner: AutoCleaner;
  private selectorOptimizer: SelectorOptimizer;
  private diffViewer: FlowDiffViewer;

  constructor() {
    this.autoCleaner = new AutoCleaner();
    this.selectorOptimizer = new SelectorOptimizer();
    this.diffViewer = new FlowDiffViewer();
  }

  /**
   * Main refine method
   */
  async refine(rawFlowPath: string, options: RefineOptions): Promise<string> {
    console.log('\n' + chalk.cyan.bold('🧹 ORBITER - Flow Refiner'));
    console.log(chalk.gray('─'.repeat(60)) + '\n');

    // Load raw flow
    if (!fileExists(rawFlowPath)) {
      throw new Error(`Flow file not found: ${rawFlowPath}`);
    }

    const rawFlow = readJson<Flow>(rawFlowPath);

    logger.info(`Loaded: ${rawFlow.name}`);
    logger.bullet(`Original steps: ${rawFlow.steps.length}`);
    logger.bullet(`Recorded: ${new Date(rawFlow.createdAt).toLocaleString()}`);
    logger.bullet(`LLM tokens used: ${rawFlow.metadata.totalTokensUsed}`);
    console.log('');

    let currentSteps = [...rawFlow.steps];
    const optimizationMethods: string[] = [];

    // ─────────────────────────────────────────────
    // Phase 1: Auto Cleanup
    // ─────────────────────────────────────────────
    if (options.autoClean) {
      logger.info(chalk.bold('Phase 1: Auto Cleanup'));

      const { steps: cleaned, report } = this.autoCleaner.clean(currentSteps);

      this.diffViewer.displayDiff(currentSteps, cleaned, report);

      currentSteps = cleaned;
      optimizationMethods.push('auto_cleanup');

      console.log('');
    }

    // ─────────────────────────────────────────────
    // Phase 2: Selector Optimization
    // ─────────────────────────────────────────────
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

    // ─────────────────────────────────────────────
    // Phase 3: LLM Optimization
    // ─────────────────────────────────────────────
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

          // Apply LLM optimized steps
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

    // ─────────────────────────────────────────────
    // Phase 4: Interactive Review
    // ─────────────────────────────────────────────
    if (options.interactive) {
      logger.info(chalk.bold('Phase 4: Interactive Review'));
      console.log('');

      const reviewer = new InteractiveReviewer();
      currentSteps = await reviewer.review(currentSteps);
      optimizationMethods.push('interactive_review');

      console.log('');
    }

    // ─────────────────────────────────────────────
    // Build Optimized Flow
    // ─────────────────────────────────────────────
    const reductionPercent = Math.round(
      ((rawFlow.steps.length - currentSteps.length) / rawFlow.steps.length) *
        100,
    );

    // Estimate replay time (avg 2s per step)
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

    // Display final steps
    this.diffViewer.displayFinalSteps(optimizedFlow.steps);

    // ─────────────────────────────────────────────
    // Save Output
    // ─────────────────────────────────────────────
    const outputPath = this.resolveOutputPath(rawFlowPath, options.outputPath);

    if (!options.dryRun) {
      writeJson(outputPath, optimizedFlow);
      logger.success(`\nOptimized flow saved: ${outputPath}`);
    } else {
      logger.info('\nDry run - flow not saved');
    }

    // Final summary
    this.displayFinalSummary(
      rawFlow.steps.length,
      currentSteps.length,
      reductionPercent,
      estimatedReplayTime,
      outputPath,
      rawFlowPath,
    );

    return outputPath;
  }

  /**
   * Build selector fallback chain for a step
   */
  private buildSelectorChain(step: FlowStep): string[] {
    const selectors: string[] = [];

    // Primary selector
    if (step.selector) {
      selectors.push(step.selector);
    }

    // Add recovery selectors
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

  /**
   * Resolve output path for optimized flow
   */
  private resolveOutputPath(rawPath: string, customPath?: string): string {
    if (customPath) return customPath;

    return rawPath
      .replace('.raw.json', '.flow.json')
      .replace('/flows/', '/flows/');
  }

  /**
   * Confirm action prompt
   */
  private async confirmAction(question: string): Promise<boolean> {
    return new Promise((resolve) => {
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      rl.question(chalk.yellow(question), (answer: string) => {
        rl.close();
        const normalized = answer.toLowerCase().trim();
        resolve(
          normalized === '' || normalized === 'y' || normalized === 'yes',
        );
      });
    });
  }

  /**
   * Display final summary
   */
  private displayFinalSummary(
    originalCount: number,
    finalCount: number,
    reductionPercent: number,
    estimatedReplayTime: number,
    outputPath: string,
    rawPath: string,
  ): void {
    console.log('\n' + chalk.cyan('─'.repeat(60)));
    console.log(chalk.green.bold('\n✅ FLOW OPTIMIZATION COMPLETE\n'));

    console.log(chalk.bold('Results:'));
    console.log(
      `  Steps: ${chalk.yellow(originalCount)} → ${chalk.green(finalCount)}` +
        chalk.gray(` (${reductionPercent}% reduction)`),
    );
    console.log(
      `  Estimated replay time: ${chalk.green(`~${estimatedReplayTime}s`)}`,
    );

    console.log('\n' + chalk.bold('Output:'));
    console.log(`  📄 ${outputPath}`);

    console.log('\n' + chalk.bold('Next steps:'));
    console.log(`  • Replay: ${chalk.cyan(`orbiter replay ${outputPath}`)}`);
    console.log(
      `  • With params: ${chalk.cyan(`orbiter replay ${outputPath} --params '{"KEY":"value"}'`)}`,
    );
    console.log('');
  }
}
