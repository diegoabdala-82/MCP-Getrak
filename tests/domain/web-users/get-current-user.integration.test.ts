import { describe, expect, it } from "vitest";
import { AuditLogger, InMemoryAuditSink } from "../../../src/foundation/audit/audit-logger.js";
import {
  CentralAuthorizationGuard,
  StaticCentralAuthorizationProvider,
} from "../../../src/foundation/authorization/central-authorization.js";
import { McpToolError } from "../../../src/domain/errors.js";
import { ToolRuntime } from "../../../src/foundation/tool-runtime.js";
import { createGetCurrentUserTool } from "../../../src/domain/web-users/get-current-user.js";
import {
  createFakeApiCoreClient,
  createFakeDelegatedTokenManager,
  createRejectingApiCoreClient,
  createRejectingDelegatedTokenManager,
} from "./test-helpers.js";

describe("get_current_user — integração completa via ToolRuntime", () => {
  it("aplica autenticação delegada/validação de central/envelope/auditoria sem duplicar lógica na tool", async () => {
    const fake = createFakeApiCoreClient({ id: 1, login: "ygor-admin", nome: "Ygor", sistema: "central-1", tipo: 1, perfil: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetCurrentUserTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

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

    expect(envelope).toMatchObject({ data: { user: { login: "ygor-admin" } } });
    expect(auditSink.records[0]).toMatchObject({
      tool: "get_current_user",
      result: "success",
      auth_scheme: "delegated_user",
    });
  });

  it("bloqueia cross-central antes de chamar a API Core (e antes de resolver qualquer token delegado)", async () => {
    const fake = createFakeApiCoreClient({});
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetCurrentUserTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

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
    expect(delegated.getAccessToken).not.toHaveBeenCalled();
  });

  it("tenta renovar um token delegado expirado (via DelegatedTokenManager) antes de responder — sucesso na renovação", async () => {
    // `DelegatedTokenManager.getAccessToken` já encapsula "cache miss/expirado
    // -> renova" (US-046/048, testado isoladamente em
    // tests/foundation/delegated-token-manager.test.ts); aqui confirmamos que
    // a tool apenas depende dele — nunca decide sozinha se deve renovar.
    const fake = createFakeApiCoreClient({ id: 1, login: "ygor-admin", nome: "Ygor", sistema: "central-1" });
    let calls = 0;
    const getAccessToken = async () => {
      calls += 1;
      // Simula: primeira resolução expirada obrigaria uma renovação interna
      // ao DelegatedTokenManager antes de devolver um token válido — do
      // ponto de vista da tool, é uma chamada só que "só funciona depois".
      return "renewed-delegated-token";
    };
    const delegated = { manager: { getAccessToken } as never };
    const { definition } = createGetCurrentUserTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const centralGuard = new CentralAuthorizationGuard(
      new StaticCentralAuthorizationProvider({ "consumer-a": ["central-1"] }),
    );
    const runtime = new ToolRuntime(centralGuard, new AuditLogger(new InMemoryAuditSink()));

    const envelope = await runtime.execute(
      definition,
      { central: "central-1" },
      { consumer: { consumer_id: "consumer-a" }, environment: "homologation" },
    );

    expect(envelope).toMatchObject({ data: { user: { login: "ygor-admin" } } });
    expect(calls).toBe(1);
  });

  it("normaliza falha de credencial delegada inválida (token expirado e renovação rejeitada) para USER_CREDENTIAL_INVALID", async () => {
    const fake = createFakeApiCoreClient({});
    const rejectingDelegated = createRejectingDelegatedTokenManager(
      new McpToolError({
        code: "USER_CREDENTIAL_INVALID",
        message: "The stored user credential was rejected by the Getrak API Core.",
        retryable: false,
      }),
    );
    const { definition } = createGetCurrentUserTool({ apiCoreClient: fake.client, delegatedTokenManager: rejectingDelegated.manager });

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

    expect(envelope).toMatchObject({ error: { code: "USER_CREDENTIAL_INVALID", retryable: false } });
    expect(auditSink.records[0]).toMatchObject({ result: "error", error_code: "USER_CREDENTIAL_INVALID" });
  });

  it("normaliza falha de endpoint indisponível/timeout da API Core no envelope de erro padrão", async () => {
    const fake = createRejectingApiCoreClient(
      new McpToolError({ code: "UPSTREAM_UNAVAILABLE", message: "Upstream service temporarily unavailable.", retryable: true }),
    );
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetCurrentUserTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const centralGuard = new CentralAuthorizationGuard(
      new StaticCentralAuthorizationProvider({ "consumer-a": ["central-1"] }),
    );
    const runtime = new ToolRuntime(centralGuard, new AuditLogger(new InMemoryAuditSink()));

    const envelope = await runtime.execute(
      definition,
      { central: "central-1" },
      { consumer: { consumer_id: "consumer-a" }, environment: "homologation" },
    );

    expect(envelope).toMatchObject({ error: { code: "UPSTREAM_UNAVAILABLE", retryable: true } });
  });
});
