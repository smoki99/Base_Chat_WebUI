/** A tool exposed by an MCP server. */
export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/** A tool with its owning server name prefixed (e.g. "postgres.query"). */
export interface QualifiedTool {
  qualifiedName: string;
  serverName: string;
  tool: McpTool;
}

/** Configuration for a single MCP server entry. */
export interface McpServerConfig {
  name: string;
  command: string;
  args: string[];
  enabled: boolean;
}

/** Root MCP configuration file shape. */
export interface McpConfig {
  servers: McpServerConfig[];
}
