import { AsyncLocalStorage } from 'async_hooks';

export const sessionLocalStorage = new AsyncLocalStorage<string>();
