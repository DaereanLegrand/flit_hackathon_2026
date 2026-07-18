interface McpTool {
  name: string
  description?: string
  inputSchema: {
    type: "object"
    properties: Record<string, unknown>
    required?: string[]
  }
}

interface McpToolResult {
  content: { type: string; text?: string; data?: unknown }[]
  isError?: boolean
}

interface GroqFunctionTool {
  type: "function"
  name: string
  description: string
  parameters: {
    type: "object"
    properties: Record<string, unknown>
    required: string[]
  }
}

interface JsonRpcRequest {
  jsonrpc: "2.0"
  id: number
  method: string
  params?: Record<string, unknown>
}

interface JsonRpcResponse {
  jsonrpc: "2.0"
  id: number
  result?: unknown
  error?: { code: number; message: string }
}

let requestId = 0

function nextId(): number {
  return ++requestId
}

async function jsonRpcRequest(url: string, method: string, params?: Record<string, unknown>): Promise<unknown> {
  const body: JsonRpcRequest = { jsonrpc: "2.0", id: nextId(), method, params }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`MCP request failed: ${res.status} ${res.statusText}`)
  const data: JsonRpcResponse = await res.json()
  if (data.error) throw new Error(`MCP error: ${data.error.message} (code ${data.error.code})`)
  return data.result
}

export interface McpServerConfig {
  name: string
  url: string
}

export interface McpConnection {
  serverName: string
  tools: McpTool[]
  callTool: (name: string, args: Record<string, unknown>) => Promise<McpToolResult>
  close: () => void
}

export async function connectMcpServer(config: McpServerConfig): Promise<McpConnection> {
  const baseUrl = config.url.replace(/\/$/, "")

  const result = await jsonRpcRequest(baseUrl, "initialize", {
    protocolVersion: "2025-03-26",
    capabilities: { tools: {} },
    clientInfo: { name: "flit-daily-dj-agent", version: "1.0.0" },
  }) as { protocolVersion: string; serverInfo: { name: string }; capabilities: { tools?: Record<string, unknown> } }

  const serverName = result.serverInfo?.name || config.name

  await jsonRpcRequest(baseUrl, "notifications/initialized")

  const toolsResult = await jsonRpcRequest(baseUrl, "tools/list") as { tools: McpTool[] }
  const tools = toolsResult.tools || []

  return {
    serverName,
    tools,
    async callTool(name: string, args: Record<string, unknown>): Promise<McpToolResult> {
      const raw = await jsonRpcRequest(baseUrl, "tools/call", { name, arguments: args }) as McpToolResult
      return {
        content: raw.content || [],
        isError: raw.isError || false,
      }
    },
    close() {},
  }
}

export interface ConnectedServer {
  serverName: string
  groqTools: GroqFunctionTool[]
  callTool: (name: string, args: Record<string, unknown>) => Promise<McpToolResult>
}

export async function connectAllMcpServers(servers: McpServerConfig[]): Promise<ConnectedServer[]> {
  const results: ConnectedServer[] = []
  for (const config of servers) {
    try {
      const conn = await connectMcpServer(config)
      const groqTools: GroqFunctionTool[] = conn.tools.map((tool) => ({
        type: "function",
        name: `${conn.serverName}__${tool.name}`,
        description: `[${conn.serverName}] ${tool.description || tool.name}`,
        parameters: {
          type: "object",
          properties: (tool.inputSchema?.properties || {}) as Record<string, unknown>,
          required: tool.inputSchema?.required || [],
        },
      }))
      results.push({ serverName: conn.serverName, groqTools, callTool: conn.callTool })
    } catch (err) {
      console.error(`Failed to connect to MCP server "${config.name}" at ${config.url}:`, err instanceof Error ? err.message : err)
    }
  }
  return results
}

export async function callMcpTool(
  servers: ConnectedServer[],
  fullName: string,
  args: Record<string, unknown>,
): Promise<string> {
  const separatorIndex = fullName.indexOf("__")
  if (separatorIndex < 0) throw new Error(`Invalid MCP tool name: ${fullName}`)
  const serverName = fullName.slice(0, separatorIndex)
  const toolName = fullName.slice(separatorIndex + 2)
  const server = servers.find((s) => s.serverName === serverName)
  if (!server) throw new Error(`MCP server not found: ${serverName}`)
  const result = await server.callTool(toolName, args)
  return result.content
    .map((c) => (c.type === "text" ? c.text : JSON.stringify(c.data ?? "")))
    .filter(Boolean)
    .join("\n")
}
