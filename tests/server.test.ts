// tests/server.test.ts
import { jest } from '@jest/globals';

// Manual mocks
const mockTool = jest.fn();
const mockResource = jest.fn();
const mockPrompts = jest.fn();
const mockConnect = jest.fn();

// Mock MCP Server implementation
const mockMcpServer = jest.fn().mockImplementation(() => ({
  tool: mockTool,
  resource: mockResource,
  prompts: mockPrompts,
  connect: mockConnect
}));

// Mock StdioServerTransport
const mockStdioTransport = jest.fn();

// Set up the mocks before importing the module under test
jest.unstable_mockModule('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: mockMcpServer
}));

jest.unstable_mockModule('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: mockStdioTransport
}));

jest.unstable_mockModule('../src/logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

jest.unstable_mockModule('../src/rate-limiter.js', () => ({
  RateLimiter: jest.fn().mockImplementation(() => ({
    throttle: jest.fn()
  })),
  SUBSCRIPTION_PLANS: {
    'Pwned 1': { requestsPerMinute: 10, plan: 'Pwned 1' }
  }
}));

describe('MCP Server', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Set environment variables
    process.env.HIBP_API_KEY = 'test-api-key';
    process.env.HIBP_SUBSCRIPTION_PLAN = 'Pwned 1';
  });
  
  test('should create a server instance', async () => {
    // Import the server module (must be dynamic in ESM tests)
    await import('../src/main.js');
    
    // Verify server was created
    expect(mockMcpServer).toHaveBeenCalledWith({
      name: 'HIBP-MCP',
      version: '1.0.2',
    });
  });
});
