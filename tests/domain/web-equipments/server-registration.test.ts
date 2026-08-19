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
import { registerWebEquipmentTools } from "../../../src/domain/web-equipments/index.js";
import { createGetrakMcpServer } from "../../../src/server.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager } from "./test-helpers.js";

describe("Epic 21 — registro das 13 tools de web_equipments no servidor MCP", () => {
  it("expõe as 13 tools na descoberta nativa", async () => {
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

    registerWebEquipmentTools(registerDomainTool, {
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
      "get_equipment_import_items",
      "get_equipment_import_summary",
      "get_equipment_tag_details",
      "get_equipments_summary",
      "get_inventory_summary",
      "get_web_equipment_details",
      "search_device_models",
      "search_equipment_carriers",
      "search_equipment_devices",
      "search_equipment_import_requests",
      "search_equipment_tags",
      "search_inventory",
      "search_web_equipments",
    ]);
  });
});
