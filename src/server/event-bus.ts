import { EventEmitter } from 'events';

class EventBus extends EventEmitter {
  emitStep(sessionId: string, data: any) {
    this.emit(`step:${sessionId}`, data);
  }

  emitLog(sessionId: string, data: any) {
    this.emit(`log:${sessionId}`, data);
  }

  emitScreenshot(sessionId: string, data: any) {
    this.emit(`screenshot:${sessionId}`, data);
  }

  emitStatus(sessionId: string, data: any) {
    this.emit(`status:${sessionId}`, data);
  }
}

export const eventBus = new EventBus();
