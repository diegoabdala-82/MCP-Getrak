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
import { registerVehicleTools } from "../../../src/domain/vehicles/index.js";
import { createGetrakMcpServer } from "../../../src/server.js";
import { createFakeApiCoreClient } from "./test-helpers.js";

describe("Epic 2 — registro das 5 tools de veículos no servidor MCP", () => {
  it("expõe as 5 tools na descoberta nativa, cada uma com seu próprio input schema", async () => {
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

    registerVehicleTools(registerDomainTool, { apiCoreClient: createFakeApiCoreClient([]).client });

    const listToolsHandler = (
      server as unknown as {
        _requestHandlers: Map<string, (req: unknown) => Promise<{ tools: { name: string }[] }>>;
      }
    )._requestHandlers.get(ListToolsRequestSchema.shape.method.value);

    const result = await listToolsHandler?.({ method: "tools/list" });
    const names = result?.tools.map((t) => t.name).sort();

    expect(names).toEqual([
      "get_suspended_vehicles",
      "get_vehicle_category",
      "get_vehicle_client_link",
      "get_vehicle_subclient_link",
      "search_vehicles",
    ]);
  });
});
