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
import { registerWebVehicleTools } from "../../../src/domain/web-vehicles/index.js";
import { createGetrakMcpServer } from "../../../src/server.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager } from "./test-helpers.js";

describe("Epic 17 — registro das 6 tools de web_vehicles no servidor MCP", () => {
  it("expõe as 6 tools na descoberta nativa (US-076 fora desta rodada, confirmada ausente)", async () => {
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

    registerWebVehicleTools(registerDomainTool, {
      apiCoreClient: createFakeApiCoreClient({}).client,
      delegatedTokenManager: createFakeDelegatedTokenManager().manager,
    });

    const listToolsHandler = (
      server as unknown as {
        _requestHandlers: Map<string, (req: unknown) => Promise<{ tools: { name: string }[] }>>;
      }
    )._requestHandlers.get(ListToolsRequestSchema.shape.method.value);

    const result = await listToolsHandler?.({ method: "tools/list" });
    const names = result?.tools.map((t) => t.name).sort();

    expect(names).toEqual([
      "get_vehicle_by_equipment",
      "get_vehicle_by_plate",
      "get_vehicle_equipment_history",
      "get_vehicle_status",
      "search_vehicles_status",
      "search_web_vehicles",
    ]);
    expect(names).not.toContain("get_isoline_shape");
  });
});
