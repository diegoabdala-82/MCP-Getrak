/**
 * US-007 — Descoberta de tools via protocolo MCP e catálogo por domínio.
 *
 * Bootstrap do servidor MCP: expõe descoberta nativa (`ListTools`/`CallTool`)
 * filtrada pelas permissões do consumidor, delegando toda execução ao
 * `ToolRuntime` (que aplica US-001/US-002/US-003/US-005/US-006). Na Fase 1
 * nenhuma tool de domínio é registrada ainda — isso acontece na Fase 2
 * (Epics 2 a 5), quando cada tool chamar `registerDomainTool`.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod";
import { zodToJsonSchema } from "./foundation/schema/zod-to-json-schema.js";
import type { AuditLogger } from "./foundation/audit/audit-logger.js";
import type { CentralAuthorizationGuard } from "./foundation/authorization/central-authorization.js";
import type { ToolCatalog, ToolPermissionChecker } from "./foundation/catalog/tool-catalog.js";
import type { ConsumerIdentityResolver } from "./foundation/identity/consumer-context.js";
import { ToolRuntime, type ToolDefinition } from "./foundation/tool-runtime.js";
import type { Environment } from "./config/environment.js";

export interface DomainToolRegistration<TInput, TData> {
  catalogEntry: Parameters<ToolCatalog["register"]>[0];
  definition: ToolDefinition<TInput, TData>;
}

export interface GetrakMcpServerDeps {
  environment: Environment;
  catalog: ToolCatalog;
  permissionChecker: ToolPermissionChecker;
  identityResolver: ConsumerIdentityResolver;
  toolRuntime: ToolRuntime;
  auditLogger: AuditLogger;
}

/**
 * Cria o servidor MCP com a fundação já conectada. Tools de domínio se
 * registram via `registerDomainTool` antes de `connect`.
 */
export function createGetrakMcpServer(deps: GetrakMcpServerDeps) {
  const server = new Server(
    { name: "getrak-core-mcp", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  const registrations = new Map<string, DomainToolRegistration<unknown, unknown>>();

  function registerDomainTool<TInput, TData>(registration: DomainToolRegistration<TInput, TData>): void {
    deps.catalog.register(registration.catalogEntry);
    registrations.set(
      registration.catalogEntry.name,
      registration as unknown as DomainToolRegistration<unknown, unknown>,
    );
  }

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const consumer = await deps.identityResolver.resolve(undefined);
    const authorizedEntries = await deps.catalog.listForConsumer(consumer.consumer_id, deps.permissionChecker);

    return {
      tools: authorizedEntries.map((entry) => {
        const registration = registrations.get(entry.name);
        return {
          name: entry.name,
          description: entry.description,
          inputSchema: registration
            ? zodToJsonSchema(registration.definition.inputSchema as z.ZodType)
            : { type: "object" as const },
        };
      }),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const consumer = await deps.identityResolver.resolve(undefined);
    const authorized = await deps.permissionChecker.isAuthorized(consumer.consumer_id, request.params.name);
    const registration = registrations.get(request.params.name);

    if (!authorized || !registration) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              error: {
                code: "NOT_FOUND",
                message: `Tool "${request.params.name}" is not available for this consumer.`,
                retryable: false,
                request_id: "n/a",
              },
            }),
          },
        ],
        isError: true,
      };
    }

    const envelope = await deps.toolRuntime.execute(registration.definition, request.params.arguments ?? {}, {
      consumer,
      environment: deps.environment,
    });

    const isError = "error" in envelope;
    return {
      content: [{ type: "text" as const, text: JSON.stringify(envelope) }],
      isError,
    };
  });

  return { server, registerDomainTool };
}
