import { ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it } from "vitest";
import { AuditLogger, InMemoryAuditSink } from "../../../src/foundation/audit/audit-logger.js";
import {
  CentralAuthorizationGuard,
  StaticCentralAuthorizationProvider,
} from "../../../src/foundation/authorization/central-authorization.js";
import { AllowAllToolPermissionChecker, ToolCatalog } from "../../../src/foundation/catalog/tool-catalog.js";
import { StaticConsumerIdentityResolver } from "../../../src/foundation/identity/consumer-context.js";
import { ToolRuntime } from "../../../src/foundation/tool-runtime.js";
import { registerWorkOrderTools } from "../../../src/domain/work-orders/index.js";
import { createGetrakMcpServer } from "../../../src/server.js";
import { createFakeApiCoreClient } from "./test-helpers.js";

describe("Epic 5 — registro das 4 tools de ordens de serviço no servidor MCP", () => {
  it("expõe as 4 tools na descoberta nativa", async () => {
    const auditLogger = new AuditLogger(new InMemoryAuditSink());
    const centralGuard = new CentralAuthorizationGuard(new StaticCentralAuthorizationProvider({}));
    const { server, registerDomainTool } = createGetrakMcpServer({
      environment: "homologation",
      catalog: new ToolCatalog(),
      permissionChecker: new AllowAllToolPermissionChecker(),
      identityResolver: new StaticConsumerIdentityResolver({ consumer_id: "claude-code" }),
      toolRuntime: new ToolRuntime(centralGuard, auditLogger),
      auditLogger,
    });

    registerWorkOrderTools(registerDomainTool, { apiCoreClient: createFakeApiCoreClient({}).client });

    const listToolsHandler = (
      server as unknown as {
        _requestHandlers: Map<string, (req: unknown) => Promise<{ tools: { name: string }[] }>>;
      }
    )._requestHandlers.get(ListToolsRequestSchema.shape.method.value);

    const result = await listToolsHandler?.({ method: "tools/list" });
    const names = result?.tools.map((t) => t.name).sort();

    expect(names).toEqual([
      "get_work_order_details",
      "get_work_order_report",
      "get_work_order_tests",
      "get_work_order_tests_definition",
    ]);
  });
});
