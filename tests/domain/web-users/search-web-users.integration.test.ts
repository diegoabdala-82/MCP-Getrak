import { describe, expect, it } from "vitest";
import { AuditLogger, InMemoryAuditSink } from "../../../src/foundation/audit/audit-logger.js";
import {
  CentralAuthorizationGuard,
  StaticCentralAuthorizationProvider,
} from "../../../src/foundation/authorization/central-authorization.js";
import { McpToolError } from "../../../src/domain/errors.js";
import { ToolRuntime } from "../../../src/foundation/tool-runtime.js";
import { createSearchWebUsersTool } from "../../../src/domain/web-users/search-web-users.js";
import {
  createFakeApiCoreClient,
  createFakeDelegatedTokenManager,
  createRejectingApiCoreClient,
} from "./test-helpers.js";

describe("search_web_users — integração completa via ToolRuntime", () => {
  it("aplica autenticação delegada/validação de central/envelope/auditoria sem duplicar lógica na tool", async () => {
    const fake = createFakeApiCoreClient({ data: [{ id: 1, full_name: "Cristiano" }], page: 1, pages: 1, total: 1 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchWebUsersTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

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

    expect(envelope).toMatchObject({ data: { users: [{ id: 1, full_name: "Cristiano" }] } });
    expect(auditSink.records[0]).toMatchObject({
      tool: "search_web_users",
      result: "success",
      auth_scheme: "delegated_user",
    });
  });

  it("bloqueia cross-central antes de chamar a API Core", async () => {
    const fake = createFakeApiCoreClient({ data: [] });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchWebUsersTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

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
    const { definition } = createSearchWebUsersTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

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
    expect(auditSink.records[0]).toMatchObject({ tool: "search_web_users", result: "error", error_code: "UPSTREAM_UNAVAILABLE" });
  });
});
