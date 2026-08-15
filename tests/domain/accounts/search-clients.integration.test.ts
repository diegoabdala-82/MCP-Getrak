import { describe, expect, it } from "vitest";
import { AuditLogger, InMemoryAuditSink } from "../../../src/foundation/audit/audit-logger.js";
import {
  CentralAuthorizationGuard,
  StaticCentralAuthorizationProvider,
} from "../../../src/foundation/authorization/central-authorization.js";
import { McpToolError } from "../../../src/domain/errors.js";
import { ToolRuntime } from "../../../src/foundation/tool-runtime.js";
import { createSearchClientsTool } from "../../../src/domain/accounts/search-clients.js";
import { createFakeApiCoreClient, createRejectingApiCoreClient } from "./test-helpers.js";

describe("search_clients — integração completa via ToolRuntime", () => {
  it("aplica autenticação/validação de central/envelope/auditoria da fundação sem duplicar lógica na tool", async () => {
    const fake = createFakeApiCoreClient([{ id: 1, descricao: "Cliente 1" }]);
    const { definition } = createSearchClientsTool({ apiCoreClient: fake.client });

    const auditSink = new InMemoryAuditSink();
    const centralGuard = new CentralAuthorizationGuard(
      new StaticCentralAuthorizationProvider({ "consumer-a": ["central-1"] }),
    );
    const runtime = new ToolRuntime(centralGuard, new AuditLogger(auditSink));

    const envelope = await runtime.execute(
      definition,
      { central: "central-1", name: "Cliente" },
      { consumer: { consumer_id: "consumer-a" }, environment: "homologation" },
    );

    expect(envelope).toMatchObject({
      data: { clients: [{ id: 1, descricao: "Cliente 1" }] },
      meta: { central: "central-1", partial: false },
    });
    expect(auditSink.records[0]).toMatchObject({ tool: "search_clients", result: "success" });
  });

  it("bloqueia cross-central antes de chamar a API Core", async () => {
    const fake = createFakeApiCoreClient([]);
    const { definition } = createSearchClientsTool({ apiCoreClient: fake.client });

    const centralGuard = new CentralAuthorizationGuard(
      new StaticCentralAuthorizationProvider({ "consumer-a": ["central-1"] }),
    );
    const runtime = new ToolRuntime(centralGuard, new AuditLogger(new InMemoryAuditSink()));

    const envelope = await runtime.execute(
      definition,
      { central: "central-99" },
      { consumer: { consumer_id: "consumer-a" }, environment: "homologation" },
    );

    expect(envelope).toMatchObject({ error: { code: "CENTRAL_NOT_AUTHORIZED" } });
    expect(fake.get).not.toHaveBeenCalled();
  });

  it("normaliza falha de endpoint indisponível/timeout da API Core no envelope de erro padrão", async () => {
    const fake = createRejectingApiCoreClient(
      new McpToolError({ code: "UPSTREAM_UNAVAILABLE", message: "Upstream service temporarily unavailable.", retryable: true }),
    );
    const { definition } = createSearchClientsTool({ apiCoreClient: fake.client });

    const centralGuard = new CentralAuthorizationGuard(
      new StaticCentralAuthorizationProvider({ "consumer-a": ["central-1"] }),
    );
    const auditSink = new InMemoryAuditSink();
    const runtime = new ToolRuntime(centralGuard, new AuditLogger(auditSink));

    const envelope = await runtime.execute(
      definition,
      { central: "central-1" },
      { consumer: { consumer_id: "consumer-a" }, environment: "homologation" },
    );

    expect(envelope).toMatchObject({ error: { code: "UPSTREAM_UNAVAILABLE", retryable: true } });
    expect(envelope).not.toHaveProperty("data");
    expect(auditSink.records[0]).toMatchObject({ tool: "search_clients", result: "error", error_code: "UPSTREAM_UNAVAILABLE" });
  });
});
