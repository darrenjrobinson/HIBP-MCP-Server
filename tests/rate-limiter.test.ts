// tests/rate-limiter.test.ts
import { jest, describe, beforeEach, afterEach, test, expect } from '@jest/globals';
import type { RateLimitConfig } from '../src/rate-limiter.js';

interface RateLimiterType {
  throttle(): Promise<void>;
  config: RateLimitConfig;
}

// Mock setTimeout with the correct type signature
const mockSetTimeout = jest.fn((callback: Function, ms: number) => {
  callback();
  return 0;
}) as jest.Mock & typeof setTimeout;

// Mock logger
jest.unstable_mockModule('../src/logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

describe('RateLimiter', () => {
  let RateLimiter: { new(config: RateLimitConfig, customSetTimeout?: typeof setTimeout): RateLimiterType };
  let SUBSCRIPTION_PLANS: Record<string, RateLimitConfig>;

  beforeEach(async () => {
    jest.useFakeTimers();
    mockSetTimeout.mockClear();
    
    // Import the module under test
    const rateModule = await import('../src/rate-limiter.js');
    RateLimiter = rateModule.RateLimiter as unknown as new(config: RateLimitConfig, customSetTimeout?: typeof setTimeout) => RateLimiterType;
    SUBSCRIPTION_PLANS = rateModule.SUBSCRIPTION_PLANS;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('should initialize with the correct config', () => {
    const rateLimiter = new RateLimiter(SUBSCRIPTION_PLANS['Pwned 1'], mockSetTimeout);
    expect(rateLimiter.config.requestsPerMinute).toBe(10);
    expect(rateLimiter.config.plan).toBe('Pwned 1');
  });

  test('should not throttle when under rate limit', async () => {
    const rateLimiter = new RateLimiter(SUBSCRIPTION_PLANS['Pwned 1'], mockSetTimeout);
    
    // Execute 5 requests (under the 10 RPM limit)
    for (let i = 0; i < 5; i++) {
      await rateLimiter.throttle();
    }
    
    // Expect no delay
    expect(mockSetTimeout).not.toHaveBeenCalled();
  });

  test('should throttle when rate limit is reached', async () => {
    const rateLimiter = new RateLimiter(SUBSCRIPTION_PLANS['Pwned 1'], mockSetTimeout);
    
    // Execute 10 requests (hitting the limit)
    for (let i = 0; i < 10; i++) {
      await rateLimiter.throttle();
    }
    
    // Next call should trigger throttling
    const throttlePromise = rateLimiter.throttle();
    
    // Advance time to simulate waiting
    jest.advanceTimersByTime(60000);
    
    // Resolve the promise
    await throttlePromise;
    
    // Expect throttling to have been applied
    expect(mockSetTimeout).toHaveBeenCalled();
  });
});
