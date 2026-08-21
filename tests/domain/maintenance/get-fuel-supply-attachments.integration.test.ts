import { describe, expect, it } from "vitest";
import { AuditLogger, InMemoryAuditSink } from "../../../src/foundation/audit/audit-logger.js";
import {
  CentralAuthorizationGuard,
  StaticCentralAuthorizationProvider,
} from "../../../src/foundation/authorization/central-authorization.js";
import { McpToolError } from "../../../src/domain/errors.js";
import { ToolRuntime } from "../../../src/foundation/tool-runtime.js";
import { createGetFuelSupplyAttachmentsTool } from "../../../src/domain/maintenance/get-fuel-supply-attachments.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, createRejectingApiCoreClient } from "./test-helpers.js";

describe("get_fuel_supply_attachments — integração via ToolRuntime", () => {
  it("bloqueia cross-central antes de chamar a API Core", async () => {
    const fake = createFakeApiCoreClient({ data: [] });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetFuelSupplyAttachmentsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const centralGuard = new CentralAuthorizationGuard(new StaticCentralAuthorizationProvider({ "consumer-a": ["central-1"] }));
    const runtime = new ToolRuntime(centralGuard, new AuditLogger(new InMemoryAuditSink()));

    const envelope = await runtime.execute(
      definition,
      { central: "central-99", id: 101 },
      { consumer: { consumer_id: "consumer-a" }, environment: "homologation" },
    );

    expect(envelope).toMatchObject({ error: { code: "CENTRAL_NOT_AUTHORIZED" } });
    expect(fake.get).not.toHaveBeenCalled();
  });

  it("normaliza abastecimento inexistente para FUEL_SUPPLY_NOT_FOUND", async () => {
    const fake = createRejectingApiCoreClient(
      new McpToolError({ code: "FUEL_SUPPLY_NOT_FOUND", message: "Fuel supply not found.", retryable: false }),
    );
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetFuelSupplyAttachmentsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const centralGuard = new CentralAuthorizationGuard(new StaticCentralAuthorizationProvider({ "consumer-a": ["central-1"] }));
    const auditSink = new InMemoryAuditSink();
    const runtime = new ToolRuntime(centralGuard, new AuditLogger(auditSink));

    const envelope = await runtime.execute(
      definition,
      { central: "central-1", id: 999999999 },
      { consumer: { consumer_id: "consumer-a" }, environment: "homologation" },
    );

    expect(envelope).toMatchObject({ error: { code: "FUEL_SUPPLY_NOT_FOUND" } });
    expect(auditSink.records[0]).toMatchObject({ tool: "get_fuel_supply_attachments", result: "error", error_code: "FUEL_SUPPLY_NOT_FOUND" });
  });
});
