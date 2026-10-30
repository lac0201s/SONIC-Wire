import { EventEmitter } from 'node:events';
import type { RealtimeEvent } from '@sonicwire/contracts';
import { logger } from '../../logger.js';

/**
 * In-process fan-out for realtime job/asset events.
 *
 * Bounded: at most MAX_SUBSCRIBERS listeners; slow consumers are dropped
 * instead of buffering without limit. Reconnection recovery is handled by the
 * client refetching state, not by replaying an unbounded history.
 */
const MAX_SUBSCRIBERS = 64;

class RealtimeBus {
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(MAX_SUBSCRIBERS);
  }

  publish(event: RealtimeEvent): void {
    this.emitter.emit('event', event);
  }

  subscribe(listener: (event: RealtimeEvent) => void): () => void {
    if (this.emitter.listenerCount('event') >= MAX_SUBSCRIBERS) {
      logger.warn('realtime subscriber limit reached; rejecting subscription');
      listener({
        type: 'heartbeat',
        at: new Date().toISOString(),
      } satisfies RealtimeEvent);
      return () => undefined;
    }
    this.emitter.on('event', listener);
    return () => {
      this.emitter.off('event', listener);
    };
  }

  get subscriberCount(): number {
    return this.emitter.listenerCount('event');
  }
}

export const realtimeBus = new RealtimeBus();
