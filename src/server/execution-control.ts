import { SessionRepository } from '../memory/database/repositories/session-repository.js';
import { logger } from '../cli/ui/logger.js';

export async function checkExecutionControl(sessionId: string | null): Promise<boolean> {
  if (!sessionId) return true; // Running outside of web session context

  const repo = new SessionRepository();
  let status = await repo.getSessionStatus(sessionId);

  if (status === 'stopped') {
    logger.info(`Session ${sessionId} has been stopped via control interface.`);
    throw new Error('Execution stopped by user');
  }

  if (status === 'paused') {
    logger.info(`Session ${sessionId} is paused. Waiting for resume signal...`);
    while (status === 'paused') {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      status = await repo.getSessionStatus(sessionId);
      if (status === 'stopped') {
        logger.info(`Session ${sessionId} was stopped while paused.`);
        throw new Error('Execution stopped by user');
      }
    }
    logger.info(`Session ${sessionId} resumed.`);
  }

  return true; // Continue execution
}
