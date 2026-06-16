import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { eventBus } from './event-bus.js';
import { logger } from '../cli/ui/logger.js';
import { verifyJwt } from './jwt.js';

export class SocketServerManager {
  private static instance: SocketServerManager | null = null;
  private io: SocketIOServer | null = null;
  private activeSubscriptions = new Map<string, {
    onStep: (data: any) => void;
    onLog: (data: any) => void;
    onScreenshot: (data: any) => void;
    onStatus: (data: any) => void;
  }>();

  private constructor() {}

  static getInstance(): SocketServerManager {
    if (!SocketServerManager.instance) {
      SocketServerManager.instance = new SocketServerManager();
    }
    return SocketServerManager.instance;
  }

  initialize(httpServer: HttpServer): void {
    if (this.io) return;

    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });

    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth?.token || socket.handshake.query?.token;
        if (!token) {
          return next(new Error('Authentication error: Missing token'));
        }
        const decoded = await verifyJwt(token);
        if (!decoded) {
          return next(new Error('Authentication error: Invalid token'));
        }
        (socket as any).user = decoded;
        next();
      } catch (err) {
        next(new Error('Authentication error: ' + (err as Error).message));
      }
    });

    this.io.on('connection', (socket) => {
      logger.debug(`Socket connected: ${socket.id}`);

      socket.on('join-session', (sessionId: string) => {
        if (!sessionId) return;
        socket.join(`session:${sessionId}`);
        logger.debug(`Socket ${socket.id} joined room session:${sessionId}`);
        this.setupSessionListeners(sessionId);
      });

      socket.on('leave-session', (sessionId: string) => {
        if (!sessionId) return;
        socket.leave(`session:${sessionId}`);
        logger.debug(`Socket ${socket.id} left room session:${sessionId}`);
        this.cleanupSessionListenersIfEmpty(sessionId);
      });

      socket.on('disconnect', () => {
        logger.debug(`Socket disconnected: ${socket.id}`);
        // Clean up empty rooms
        for (const [sessionId] of this.activeSubscriptions.entries()) {
          this.cleanupSessionListenersIfEmpty(sessionId);
        }
      });
    });
  }

  private setupSessionListeners(sessionId: string): void {
    if (this.activeSubscriptions.has(sessionId)) return;

    const onStep = (data: any) => {
      this.io?.to(`session:${sessionId}`).emit('step', data);
    };

    const onLog = (data: any) => {
      this.io?.to(`session:${sessionId}`).emit('log', data);
    };

    const onScreenshot = (data: any) => {
      this.io?.to(`session:${sessionId}`).emit('screenshot', data);
    };

    const onStatus = (data: any) => {
      this.io?.to(`session:${sessionId}`).emit('status', data);
    };

    eventBus.on(`step:${sessionId}`, onStep);
    eventBus.on(`log:${sessionId}`, onLog);
    eventBus.on(`screenshot:${sessionId}`, onScreenshot);
    eventBus.on(`status:${sessionId}`, onStatus);

    this.activeSubscriptions.set(sessionId, {
      onStep,
      onLog,
      onScreenshot,
      onStatus,
    });
  }

  private cleanupSessionListenersIfEmpty(sessionId: string): void {
    const clients = this.io?.sockets.adapter.rooms.get(`session:${sessionId}`);
    const clientCount = clients ? clients.size : 0;

    if (clientCount === 0) {
      const subs = this.activeSubscriptions.get(sessionId);
      if (subs) {
        eventBus.off(`step:${sessionId}`, subs.onStep);
        eventBus.off(`log:${sessionId}`, subs.onLog);
        eventBus.off(`screenshot:${sessionId}`, subs.onScreenshot);
        eventBus.off(`status:${sessionId}`, subs.onStatus);
        this.activeSubscriptions.delete(sessionId);
        logger.debug(`Cleaned up event listeners for session:${sessionId} (no listeners active)`);
      }
    }
  }
}
