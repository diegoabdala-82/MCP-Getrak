import { describe, expect, it } from "vitest";
import { ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { AuditLogger, InMemoryAuditSink } from "../../src/foundation/audit/audit-logger.js";
import {
  CentralAuthorizationGuard,
  StaticCentralAuthorizationProvider,
} from "../../src/foundation/authorization/central-authorization.js";
import { AllowAllToolPermissionChecker, ToolCatalog } from "../../src/foundation/catalog/tool-catalog.js";
import { StaticConsumerIdentityResolver } from "../../src/foundation/identity/consumer-context.js";
import { ToolRuntime } from "../../src/foundation/tool-runtime.js";
import { createGetrakMcpServer } from "../../src/server.js";

describe("US-007 — bootstrap do servidor MCP", () => {
  it("monta o servidor e expõe a descoberta nativa de tools (catálogo vazio na Fase 1)", async () => {
    const auditLogger = new AuditLogger(new InMemoryAuditSink());
    const centralGuard = new CentralAuthorizationGuard(new StaticCentralAuthorizationProvider({}));
    const { server } = createGetrakMcpServer({
      environment: "homologation",
      catalog: new ToolCatalog(),
      permissionChecker: new AllowAllToolPermissionChecker(),
      identityResolver: new StaticConsumerIdentityResolver({ consumer_id: "claude-code" }),
      toolRuntime: new ToolRuntime(centralGuard, auditLogger),
      auditLogger,
    });

    const listToolsHandler = (
      server as unknown as {
        _requestHandlers: Map<string, (req: unknown) => Promise<{ tools: unknown[] }>>;
      }
    )._requestHandlers.get(ListToolsRequestSchema.shape.method.value);

    expect(listToolsHandler).toBeTypeOf("function");
    const result = await listToolsHandler?.({ method: "tools/list" });
    expect(result).toEqual({ tools: [] });
  });
});
