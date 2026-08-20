import { describe, expect, it } from "vitest";
import { AuditLogger, InMemoryAuditSink } from "../../../src/foundation/audit/audit-logger.js";
import {
  CentralAuthorizationGuard,
  StaticCentralAuthorizationProvider,
} from "../../../src/foundation/authorization/central-authorization.js";
import { ToolRuntime } from "../../../src/foundation/tool-runtime.js";
import { createGetDriversSummaryTool } from "../../../src/domain/journeys/get-drivers-summary.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager } from "./test-helpers.js";

describe("get_drivers_summary — integração via ToolRuntime", () => {
  it("bloqueia cross-central antes de chamar a API Core", async () => {
    const fake = createFakeApiCoreClient({ data: { has_vehicles: 0, available: 0, total: 0 } });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetDriversSummaryTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

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
});
