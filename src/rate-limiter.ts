import { logger } from "./logger.js";

export interface RateLimitConfig {
  requestsPerMinute: number;
  plan: string;
}

export const SUBSCRIPTION_PLANS: Record<string, RateLimitConfig> = {
  "Pwned 1": { requestsPerMinute: 10, plan: "Pwned 1" },
  "Pwned 2": { requestsPerMinute: 50, plan: "Pwned 2" },
  "Pwned 3": { requestsPerMinute: 100, plan: "Pwned 3" },
  "Pwned 4": { requestsPerMinute: 500, plan: "Pwned 4" },
  "Pwned 5": { requestsPerMinute: 1000, plan: "Pwned 5" },
};

export class RateLimiter {
  private requestTimestamps: number[] = [];
  private config: RateLimitConfig;
  private setTimeoutFn: typeof setTimeout;
  
  constructor(config: RateLimitConfig, customSetTimeout: typeof setTimeout = setTimeout) {
    this.config = config;
    this.setTimeoutFn = customSetTimeout;
    logger.info(`Rate limiter initialized with plan ${config.plan} (${config.requestsPerMinute} RPM)`);
  }

  async throttle(): Promise<void> {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    
    // Remove timestamps older than 1 minute
    this.requestTimestamps = this.requestTimestamps.filter(
      timestamp => timestamp >= oneMinuteAgo
    );
    
    // Check if we've reached the rate limit
    if (this.requestTimestamps.length >= this.config.requestsPerMinute) {
      const oldestTimestamp = this.requestTimestamps[0];
      const waitTime = Math.max(0, oldestTimestamp + 60 * 1000 - now);
      
      logger.info(`Rate limit reached, waiting ${waitTime}ms before next request`);
      
      if (waitTime > 0) {
        await new Promise(resolve => this.setTimeoutFn(resolve, waitTime));
      }
      
      // After waiting, remove expired timestamps again
      const newNow = Date.now();
      this.requestTimestamps = this.requestTimestamps.filter(
        timestamp => timestamp >= newNow - 60 * 1000
      );
    }
    
    // Add current timestamp
    this.requestTimestamps.push(Date.now());
  }
}
