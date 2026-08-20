import { describe, expect, it } from "vitest";
import { AuditLogger, InMemoryAuditSink } from "../../../src/foundation/audit/audit-logger.js";
import {
  CentralAuthorizationGuard,
  StaticCentralAuthorizationProvider,
} from "../../../src/foundation/authorization/central-authorization.js";
import { ToolRuntime } from "../../../src/foundation/tool-runtime.js";
import { createGetIdentifiersSummaryTool } from "../../../src/domain/journeys/get-identifiers-summary.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager } from "./test-helpers.js";

describe("get_identifiers_summary — integração via ToolRuntime", () => {
  it("bloqueia cross-central antes de chamar a API Core", async () => {
    const fake = createFakeApiCoreClient({ data: { available: 0, has_driver: 0, total: 0 } });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetIdentifiersSummaryTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

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
