#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { logger } from "./logger.js";
import { RateLimiter, SUBSCRIPTION_PLANS } from "./rate-limiter.js";

// Create server instance
const server = new McpServer({
  name: "HIBP-MCP",
  version: "1.0.2",
});

logger.info("Starting HIBP MCP Server");


// Create rate limiter based on environment variable or default to Pwned 1
const subscriptionPlan = process.env.HIBP_SUBSCRIPTION_PLAN || "Pwned 1";
const rateLimitConfig = SUBSCRIPTION_PLANS[subscriptionPlan] || SUBSCRIPTION_PLANS["Pwned 1"];
const rateLimiter = new RateLimiter(rateLimitConfig);

server.tool(
  "HIBP-Breaches",
  "Tool to query breached accounts and breaches from the Have I Been Pwned API",
  {
    operation: z.enum([
      "getAllBreachesForAccount", 
      "getAllBreachedSites", 
      "getBreachByName",
      "getDataClasses"
    ]).describe("The HIBP operation to perform"),
    account: z.string().optional().describe("Email address to check for breaches"),
    domain: z.string().optional().describe("Domain to filter breaches by"),
    name: z.string().optional().describe("Breach name to get details for"),
    includeUnverified: z.boolean().optional().describe("Whether to include unverified breaches"),
    truncateResponse: z.boolean().optional().describe("Whether to truncate the response"),
  },
  async ({ operation, account, domain, name, includeUnverified, truncateResponse }) => {
    try {
      // Check for API key in environment
      const apiKey = process.env.HIBP_API_KEY;
      if (!apiKey) {
        throw new Error("Missing required environment variable: HIBP_API_KEY");
      }

      // Apply rate limiting before making the request
      await rateLimiter.throttle();

      // Base URL for the HIBP API
      const baseUrl = "https://haveibeenpwned.com/api/v3";
      
      // Prepare headers
      const headers: Record<string, string> = {
        'hibp-api-key': apiKey,
        'user-agent': 'HIBP-MCP-Server',
      };

      let url = "";
      let requiresAuth = false;

      switch (operation) {
        case "getAllBreachesForAccount":
          if (!account) {
            throw new Error("Account parameter is required for getAllBreachesForAccount operation");
          }
          url = `${baseUrl}/breachedaccount/${encodeURIComponent(account)}`;
          requiresAuth = true;
          
          // Add query parameters if provided
          const queryParams = new URLSearchParams();
          
          if (domain) {
            queryParams.append("domain", domain);
          }
          
          if (includeUnverified !== undefined) {
            queryParams.append("includeUnverified", includeUnverified.toString());
          }
          
          if (truncateResponse !== undefined) {
            queryParams.append("truncateResponse", truncateResponse.toString());
          }
          
          if (queryParams.toString()) {
            url += `?${queryParams.toString()}`;
          }
          break;
          
        case "getAllBreachedSites":
          url = `${baseUrl}/breaches`;
          
          if (domain) {
            url += `?domain=${encodeURIComponent(domain)}`;
          }
          break;
          
        case "getBreachByName":
          if (!name) {
            throw new Error("Name parameter is required for getBreachByName operation");
          }
          url = `${baseUrl}/breach/${encodeURIComponent(name)}`;
          break;
          
        case "getDataClasses":
          url = `${baseUrl}/dataclasses`;
          break;
          
        default:
          throw new Error(`Unsupported operation: ${operation}`);
      }

      // Make the API request
      logger.info(`Making HIBP API request to ${url}`);
      
      const response = await fetch(url, {
        method: "GET",
        headers: headers,
      });

      // Handle response
      let responseData: any;
      
      if (response.status === 404) {
        // For 404 responses, this means "not found" for the getAllBreachesForAccount operation
        if (operation === "getAllBreachesForAccount") {
          return {
            content: [
              {
                type: "text" as const,
                text: `Good news! No breaches found for account: ${account}`,
              },
            ],
          };
        } else {
          throw new Error(`Resource not found: ${url}`);
        }
      }
      
      if (response.status === 429) {
        const retryAfter = response.headers.get("retry-after") || "Unknown";
        throw new Error(`Rate limit exceeded. Try again in ${retryAfter} seconds.`);
      }
      
      if (!response.ok) {
        throw new Error(`HIBP API error (${response.status}): ${await response.text()}`);
      }

      // Parse response
      const responseText = await response.text();
      responseData = responseText ? JSON.parse(responseText) : {};

      let resultText = `Result for ${operation}:\n\n`;
      resultText += JSON.stringify(responseData, null, 2);

      return {
        content: [
          {
            type: "text" as const,
            text: resultText,
          },
        ],
      };
    } catch (error) {
      logger.error("Error in HIBP-Breaches tool:", error);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true
      };
    }
  },
);

server.tool(
  "HIBP-Pastes",
  "Tool to query pastes containing account data from the Have I Been Pwned API",
  {
    account: z.string().describe("Email address to check for pastes"),
  },
  async ({ account }) => {
    try {
      // Check for API key in environment
      const apiKey = process.env.HIBP_API_KEY;
      if (!apiKey) {
        throw new Error("Missing required environment variable: HIBP_API_KEY");
      }

      // Apply rate limiting before making the request
      await rateLimiter.throttle();

      // Base URL for the HIBP API
      const baseUrl = "https://haveibeenpwned.com/api/v3";
      
      // Prepare headers
      const headers: Record<string, string> = {
        'hibp-api-key': apiKey,
        'user-agent': 'HIBP-MCP-Server',
      };

      const url = `${baseUrl}/pasteaccount/${encodeURIComponent(account)}`;

      // Make the API request
      logger.info(`Making HIBP API request to ${url}`);
      
      const response = await fetch(url, {
        method: "GET",
        headers: headers,
      });

      // Handle response
      let responseData: any;
      
      if (response.status === 404) {
        // For 404 responses, this means "no pastes found" for the account
        return {
          content: [
            {
              type: "text" as const,
              text: `Good news! No pastes found for account: ${account}`,
            },
          ],
        };
      }
      
      if (response.status === 429) {
        const retryAfter = response.headers.get("retry-after") || "Unknown";
        throw new Error(`Rate limit exceeded. Try again in ${retryAfter} seconds.`);
      }
      
      if (!response.ok) {
        throw new Error(`HIBP API error (${response.status}): ${await response.text()}`);
      }

      // Parse response
      const responseText = await response.text();
      responseData = responseText ? JSON.parse(responseText) : {};

      let resultText = `Pastes containing the account ${account}:\n\n`;
      resultText += JSON.stringify(responseData, null, 2);

      return {
        content: [
          {
            type: "text" as const,
            text: resultText,
          },
        ],
      };
    } catch (error) {
      logger.error("Error in HIBP-Pastes tool:", error);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true
      };
    }
  },
);

server.tool(
  "HIBP-PwnedPasswords",
  "Tool to check if a password has been exposed in data breaches using the Pwned Passwords API",
  {
    password: z.string().describe("Password to check (will be hashed locally before sending)"),
  },
  async ({ password }) => {
    try {
      // Base URL for the HIBP Pwned Passwords API
      const baseUrl = "https://api.pwnedpasswords.com/range";
      
      // Generate SHA-1 hash of the password
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-1', data);
      
      // Convert hash to hex string
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      // Get first 5 characters of the hash (prefix)
      const prefix = hashHex.substring(0, 5).toUpperCase();
      const suffix = hashHex.substring(5).toUpperCase();
      
      // Prepare headers
      const headers: Record<string, string> = {
        'user-agent': 'HIBP-MCP-Server',
      };

      const url = `${baseUrl}/${prefix}`;
      
      // Make the API request
      logger.info(`Making HIBP Pwned Passwords API request to ${url}`);
      
      const response = await fetch(url, {
        method: "GET",
        headers: headers,
      });

      if (!response.ok) {
        throw new Error(`HIBP API error (${response.status}): ${await response.text()}`);
      }

      // Parse response
      const responseText = await response.text();
      const hashes = responseText.split('\r\n');
      
      // Look for our hash suffix in the response
      let found = false;
      let count = 0;
      
      for (const hash of hashes) {
        const [hashSuffix, hashCount] = hash.split(':');
        
        if (hashSuffix === suffix) {
          found = true;
          count = parseInt(hashCount);
          break;
        }
      }
      
      let resultText = '';
      
      if (found) {
        resultText = `Password found in ${count.toLocaleString()} data breaches!`;
      } else {
        resultText = `Good news! Password wasn't found in any known data breaches.`;
      }

      return {
        content: [
          {
            type: "text" as const,
            text: resultText,
          },
        ],
      };
    } catch (error) {
      logger.error("Error in HIBP-PwnedPasswords tool:", error);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true
      };
    }
  },
);

// Start the server with stdio transport
async function main() {
  // Check for required environment variables
  const apiKey = process.env.HIBP_API_KEY;

  if (!apiKey) {
    throw new Error("Missing required environment variable: HIBP_API_KEY");
  }

  // Log the subscription plan
  const subscriptionPlan = process.env.HIBP_SUBSCRIPTION_PLAN || "Pwned 1";
  if (!SUBSCRIPTION_PLANS[subscriptionPlan]) {
    logger.warn(`Unknown subscription plan: ${subscriptionPlan}. Defaulting to Pwned 1.`);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  logger.error("Fatal error in main()", error);
  process.exit(1);
});
