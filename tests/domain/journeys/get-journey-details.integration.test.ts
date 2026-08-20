import { describe, expect, it } from "vitest";
import { AuditLogger, InMemoryAuditSink } from "../../../src/foundation/audit/audit-logger.js";
import {
  CentralAuthorizationGuard,
  StaticCentralAuthorizationProvider,
} from "../../../src/foundation/authorization/central-authorization.js";
import { McpToolError } from "../../../src/domain/errors.js";
import { ToolRuntime } from "../../../src/foundation/tool-runtime.js";
import { createGetJourneyDetailsTool } from "../../../src/domain/journeys/get-journey-details.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, createRejectingApiCoreClient } from "./test-helpers.js";

describe("get_journey_details — integração via ToolRuntime", () => {
  it("bloqueia cross-central antes de chamar a API Core", async () => {
    const fake = createFakeApiCoreClient({ data: {} });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetJourneyDetailsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

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

  it("normaliza viagem inexistente para JOURNEY_NOT_FOUND via ToolRuntime", async () => {
    const fake = createRejectingApiCoreClient(
      new McpToolError({ code: "JOURNEY_NOT_FOUND", message: "Journey not found.", retryable: false }),
    );
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetJourneyDetailsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const centralGuard = new CentralAuthorizationGuard(new StaticCentralAuthorizationProvider({ "consumer-a": ["central-1"] }));
    const auditSink = new InMemoryAuditSink();
    const runtime = new ToolRuntime(centralGuard, new AuditLogger(auditSink));

    const envelope = await runtime.execute(
      definition,
      { central: "central-1", id: 999999999 },
      { consumer: { consumer_id: "consumer-a" }, environment: "homologation" },
    );

    expect(envelope).toMatchObject({ error: { code: "JOURNEY_NOT_FOUND" } });
    expect(auditSink.records[0]).toMatchObject({ tool: "get_journey_details", result: "error", error_code: "JOURNEY_NOT_FOUND" });
  });
});
