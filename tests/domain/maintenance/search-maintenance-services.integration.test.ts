import { describe, expect, it } from "vitest";
import { AuditLogger, InMemoryAuditSink } from "../../../src/foundation/audit/audit-logger.js";
import {
  CentralAuthorizationGuard,
  StaticCentralAuthorizationProvider,
} from "../../../src/foundation/authorization/central-authorization.js";
import { ToolRuntime } from "../../../src/foundation/tool-runtime.js";
import { createSearchMaintenanceServicesTool } from "../../../src/domain/maintenance/search-maintenance-services.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager } from "./test-helpers.js";

describe("search_maintenance_services — integração via ToolRuntime", () => {
  it("bloqueia cross-central antes de chamar a API Core", async () => {
    const fake = createFakeApiCoreClient({ data: [], pagination: { total: 0, page: 1, itemsPerPage: 25, totalPages: 0 } });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchMaintenanceServicesTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const centralGuard = new CentralAuthorizationGuard(new StaticCentralAuthorizationProvider({ "consumer-a": ["central-1"] }));
    const runtime = new ToolRuntime(centralGuard, new AuditLogger(new InMemoryAuditSink()));

    const envelope = await runtime.execute(
      definition,
      { central: "central-99" },
      { consumer: { consumer_id: "consumer-a" }, environment: "homologation" },
    );

    expect(envelope).toMatchObject({ error: { code: "CENTRAL_NOT_AUTHORIZED" } });
    expect(fake.get).not.toHaveBeenCalled();
  });

  it("aplica auditoria/envelope de sucesso via ToolRuntime", async () => {
    const fake = createFakeApiCoreClient({
      data: [{ id: 1, name: "Martelinho" }],
      pagination: { total: 1, page: 1, itemsPerPage: 25, totalPages: 1 },
    });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchMaintenanceServicesTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const auditSink = new InMemoryAuditSink();
    const centralGuard = new CentralAuthorizationGuard(new StaticCentralAuthorizationProvider({ "consumer-a": ["central-1"] }));
    const runtime = new ToolRuntime(centralGuard, new AuditLogger(auditSink));

    const envelope = await runtime.execute(
      definition,
      { central: "central-1" },
      { consumer: { consumer_id: "consumer-a" }, environment: "homologation" },
    );

    expect(envelope).toMatchObject({ data: { services: [{ id: 1, name: "Martelinho" }] } });
    expect(auditSink.records[0]).toMatchObject({ tool: "search_maintenance_services", result: "success" });
  });
});
