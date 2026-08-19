import { describe, expect, it } from "vitest";
import { AuditLogger, InMemoryAuditSink } from "../../../src/foundation/audit/audit-logger.js";
import {
  CentralAuthorizationGuard,
  StaticCentralAuthorizationProvider,
} from "../../../src/foundation/authorization/central-authorization.js";
import { McpToolError } from "../../../src/domain/errors.js";
import { ToolRuntime } from "../../../src/foundation/tool-runtime.js";
import { createGetMessagesAnalyticsTool } from "../../../src/domain/notifications/get-messages-analytics.js";
import {
  createFakeApiCoreClient,
  createFakeDelegatedTokenManager,
  createRejectingApiCoreClient,
} from "./test-helpers.js";

describe("get_messages_analytics — integração completa via ToolRuntime", () => {
  it("aplica autenticação delegada/validação de central/envelope/auditoria sem duplicar lógica na tool", async () => {
    const fake = createFakeApiCoreClient({ total_sent: 2253, total_viewed: 494, reading_rate: 21.9 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetMessagesAnalyticsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const auditSink = new InMemoryAuditSink();
    const centralGuard = new CentralAuthorizationGuard(
      new StaticCentralAuthorizationProvider({ "consumer-a": ["central-1"] }),
    );
    const runtime = new ToolRuntime(centralGuard, new AuditLogger(auditSink));

    const envelope = await runtime.execute(
      definition,
      { central: "central-1" },
      { consumer: { consumer_id: "consumer-a" }, environment: "homologation" },
    );

    expect(envelope).toMatchObject({ data: { analytics: { total_sent: 2253 } } });
    expect(auditSink.records[0]).toMatchObject({
      tool: "get_messages_analytics",
      result: "success",
      auth_scheme: "delegated_user",
    });
  });

  it("bloqueia cross-central antes de chamar a API Core", async () => {
    const fake = createFakeApiCoreClient({});
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetMessagesAnalyticsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

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
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetMessagesAnalyticsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

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
    expect(auditSink.records[0]).toMatchObject({ tool: "get_messages_analytics", result: "error", error_code: "UPSTREAM_UNAVAILABLE" });
  });
});
