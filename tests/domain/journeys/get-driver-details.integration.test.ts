import { describe, expect, it } from "vitest";
import { AuditLogger, InMemoryAuditSink } from "../../../src/foundation/audit/audit-logger.js";
import {
  CentralAuthorizationGuard,
  StaticCentralAuthorizationProvider,
} from "../../../src/foundation/authorization/central-authorization.js";
import { ToolRuntime } from "../../../src/foundation/tool-runtime.js";
import { createGetDriverDetailsTool } from "../../../src/domain/journeys/get-driver-details.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager } from "./test-helpers.js";

describe("get_driver_details — integração via ToolRuntime", () => {
  it("bloqueia cross-central antes de chamar a API Core", async () => {
    const fake = createFakeApiCoreClient({ data: {} });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetDriverDetailsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const centralGuard = new CentralAuthorizationGuard(new StaticCentralAuthorizationProvider({ "consumer-a": ["central-1"] }));
    const runtime = new ToolRuntime(centralGuard, new AuditLogger(new InMemoryAuditSink()));

    const envelope = await runtime.execute(
      definition,
      { central: "central-99", id: 1 },
      { consumer: { consumer_id: "consumer-a" }, environment: "homologation" },
    );

    expect(envelope).toMatchObject({ error: { code: "CENTRAL_NOT_AUTHORIZED" } });
    expect(fake.get).not.toHaveBeenCalled();
  });

  it("normaliza id inexistente (204) para DRIVER_NOT_FOUND via ToolRuntime", async () => {
    const fake = createFakeApiCoreClient(undefined);
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetDriverDetailsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const centralGuard = new CentralAuthorizationGuard(new StaticCentralAuthorizationProvider({ "consumer-a": ["central-1"] }));
    const auditSink = new InMemoryAuditSink();
    const runtime = new ToolRuntime(centralGuard, new AuditLogger(auditSink));

    const envelope = await runtime.execute(
      definition,
      { central: "central-1", id: 999999999 },
      { consumer: { consumer_id: "consumer-a" }, environment: "homologation" },
    );

    expect(envelope).toMatchObject({ error: { code: "DRIVER_NOT_FOUND" } });
    expect(auditSink.records[0]).toMatchObject({ tool: "get_driver_details", result: "error", error_code: "DRIVER_NOT_FOUND" });
  });
});
