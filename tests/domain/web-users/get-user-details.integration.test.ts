import { describe, expect, it } from "vitest";
import { AuditLogger, InMemoryAuditSink } from "../../../src/foundation/audit/audit-logger.js";
import {
  CentralAuthorizationGuard,
  StaticCentralAuthorizationProvider,
} from "../../../src/foundation/authorization/central-authorization.js";
import { McpToolError } from "../../../src/domain/errors.js";
import { ToolRuntime } from "../../../src/foundation/tool-runtime.js";
import { createGetUserDetailsTool } from "../../../src/domain/web-users/get-user-details.js";
import {
  createFakeApiCoreClient,
  createFakeDelegatedTokenManager,
  createRejectingApiCoreClient,
  createRejectingDelegatedTokenManager,
} from "./test-helpers.js";

describe("get_user_details — integração completa via ToolRuntime", () => {
  it("aplica autenticação delegada/validação de central/envelope/auditoria sem duplicar lógica na tool", async () => {
    const fake = createFakeApiCoreClient({ id: 1, full_name: "Ygor", client: null, subclient: null, central: {} });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetUserDetailsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const auditSink = new InMemoryAuditSink();
    const centralGuard = new CentralAuthorizationGuard(
      new StaticCentralAuthorizationProvider({ "consumer-a": ["central-1"] }),
    );
    const runtime = new ToolRuntime(centralGuard, new AuditLogger(auditSink));

    const envelope = await runtime.execute(
      definition,
      { central: "central-1", user_id: 1 },
      { consumer: { consumer_id: "consumer-a" }, environment: "homologation" },
    );

    expect(envelope).toMatchObject({ data: { user: { id: 1, full_name: "Ygor" } } });
    expect(auditSink.records[0]).toMatchObject({
      tool: "get_user_details",
      result: "success",
      auth_scheme: "delegated_user",
    });
  });

  it("bloqueia cross-central antes de chamar a API Core", async () => {
    const fake = createFakeApiCoreClient({});
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetUserDetailsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const centralGuard = new CentralAuthorizationGuard(
      new StaticCentralAuthorizationProvider({ "consumer-a": ["central-1"] }),
    );
    const runtime = new ToolRuntime(centralGuard, new AuditLogger(new InMemoryAuditSink()));

    const envelope = await runtime.execute(
      definition,
      { central: "central-99", user_id: 1 },
      { consumer: { consumer_id: "consumer-a" }, environment: "homologation" },
    );

    expect(envelope).toMatchObject({ error: { code: "CENTRAL_NOT_AUTHORIZED" } });
    expect(fake.get).not.toHaveBeenCalled();
  });

  it("normaliza usuário inexistente para o erro USER_NOT_FOUND no envelope padrão", async () => {
    const fake = createRejectingApiCoreClient(
      new McpToolError({ code: "USER_NOT_FOUND", message: "Resource not found.", retryable: false }),
    );
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetUserDetailsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const centralGuard = new CentralAuthorizationGuard(
      new StaticCentralAuthorizationProvider({ "consumer-a": ["central-1"] }),
    );
    const auditSink = new InMemoryAuditSink();
    const runtime = new ToolRuntime(centralGuard, new AuditLogger(auditSink));

    const envelope = await runtime.execute(
      definition,
      { central: "central-1", user_id: 999999999 },
      { consumer: { consumer_id: "consumer-a" }, environment: "homologation" },
    );

    expect(envelope).toMatchObject({ error: { code: "USER_NOT_FOUND", retryable: false } });
    expect(auditSink.records[0]).toMatchObject({ result: "error", error_code: "USER_NOT_FOUND" });
  });

  it("normaliza falha de credencial delegada inválida (USER_CREDENTIAL_INVALID)", async () => {
    const fake = createFakeApiCoreClient({});
    const rejectingDelegated = createRejectingDelegatedTokenManager(
      new McpToolError({
        code: "USER_CREDENTIAL_INVALID",
        message: "The stored user credential was rejected by the Getrak API Core.",
        retryable: false,
      }),
    );
    const { definition } = createGetUserDetailsTool({ apiCoreClient: fake.client, delegatedTokenManager: rejectingDelegated.manager });

    const centralGuard = new CentralAuthorizationGuard(
      new StaticCentralAuthorizationProvider({ "consumer-a": ["central-1"] }),
    );
    const runtime = new ToolRuntime(centralGuard, new AuditLogger(new InMemoryAuditSink()));

    const envelope = await runtime.execute(
      definition,
      { central: "central-1", user_id: 1 },
      { consumer: { consumer_id: "consumer-a" }, environment: "homologation" },
    );

    expect(envelope).toMatchObject({ error: { code: "USER_CREDENTIAL_INVALID", retryable: false } });
  });
});
