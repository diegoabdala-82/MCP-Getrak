import { describe, expect, it, vi } from "vitest";
import { ErrorCodes, McpToolError } from "../../src/domain/errors.js";
import { AuthManager } from "../../src/foundation/auth/auth-manager.js";
import { TokenRequestFailedError } from "../../src/foundation/auth/oauth2-client.js";
import { MissingSecretError } from "../../src/foundation/auth/secrets-provider.js";
import { InMemoryTokenCache } from "../../src/foundation/auth/token-cache.js";
import { ApiCoreClient } from "../../src/foundation/http/api-core-client.js";
import { UpstreamTimeoutError } from "../../src/foundation/errors/error-normalizer.js";

const baseParams = {
  path: "/v0.2/veiculos/integracao",
  query: {},
  environment: "homologation" as const,
  central: "central-1",
  authScheme: "oauth2ClientCredentials" as const,
};

describe("ApiCoreClient — normalização de erro de autenticação (bug encontrado via smoke test manual)", () => {
  it("nunca relata credencial técnica ausente como falha de rede/upstream indisponível", async () => {
    const secretsProvider = { getSecret: vi.fn().mockRejectedValue(new MissingSecretError("homologation", "oauth2ClientCredentials", "X")) };
    const authManager = new AuthManager(secretsProvider, new InMemoryTokenCache(), { fetchToken: vi.fn() });
    const client = new ApiCoreClient("https://api.example.com", authManager, vi.fn());

    await expect(client.get(baseParams)).rejects.toMatchObject({
      code: ErrorCodes.INTERNAL_ERROR,
      retryable: false,
    });
  });

  it("mapeia falha do token endpoint por status HTTP (401 -> UNAUTHORIZED, não retryable)", async () => {
    const secretsProvider = { getSecret: vi.fn().mockResolvedValue({ auth_scheme: "oauth2ClientCredentials", client_id: "a", client_secret: "b", token_url: "https://x/token" }) };
    const oauth2Client = { fetchToken: vi.fn().mockRejectedValue(new TokenRequestFailedError(401)) };
    const authManager = new AuthManager(secretsProvider, new InMemoryTokenCache(), oauth2Client);
    const client = new ApiCoreClient("https://api.example.com", authManager, vi.fn());

    await expect(client.get(baseParams)).rejects.toMatchObject({
      code: ErrorCodes.UNAUTHORIZED,
      retryable: false,
    });
  });

  it("mapeia falha transitória do token endpoint (503) como retryable (UPSTREAM_UNAVAILABLE)", async () => {
    const secretsProvider = { getSecret: vi.fn().mockResolvedValue({ auth_scheme: "oauth2ClientCredentials", client_id: "a", client_secret: "b", token_url: "https://x/token" }) };
    const oauth2Client = { fetchToken: vi.fn().mockRejectedValue(new TokenRequestFailedError(503)) };
    const authManager = new AuthManager(secretsProvider, new InMemoryTokenCache(), oauth2Client);
    const client = new ApiCoreClient("https://api.example.com", authManager, vi.fn());

    await expect(client.get(baseParams)).rejects.toMatchObject({
      code: ErrorCodes.UPSTREAM_UNAVAILABLE,
      retryable: true,
    });
  });

  it("mapeia timeout/erro de rede na obtenção do token como transitório (retryable)", async () => {
    const secretsProvider = { getSecret: vi.fn().mockResolvedValue({ auth_scheme: "oauth2ClientCredentials", client_id: "a", client_secret: "b", token_url: "https://x/token" }) };
    const oauth2Client = { fetchToken: vi.fn().mockRejectedValue(new UpstreamTimeoutError(5000)) };
    const authManager = new AuthManager(secretsProvider, new InMemoryTokenCache(), oauth2Client);
    const client = new ApiCoreClient("https://api.example.com", authManager, vi.fn());

    await expect(client.get(baseParams)).rejects.toMatchObject({
      code: ErrorCodes.TIMEOUT,
      retryable: true,
    });
  });

  it("continua normalizando corretamente uma falha HTTP do próprio endpoint de dados (não do token)", async () => {
    const secretsProvider = { getSecret: vi.fn().mockResolvedValue({ auth_scheme: "oauth2ClientCredentials", client_id: "a", client_secret: "b", token_url: "https://x/token" }) };
    const oauth2Client = { fetchToken: vi.fn().mockResolvedValue({ access_token: "tok", expires_in: 3600 }) };
    const authManager = new AuthManager(secretsProvider, new InMemoryTokenCache(), oauth2Client);
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    const client = new ApiCoreClient("https://api.example.com", authManager, fetchImpl);

    await expect(client.get({ ...baseParams, notFoundCode: "VEHICLE_NOT_FOUND" })).rejects.toMatchObject({
      code: "VEHICLE_NOT_FOUND",
      retryable: false,
    });
  });

  it("Epic 20/US-084: trata HTTP 204 (sem corpo) como ausência de dado, sem tentar fazer parse de JSON vazio", async () => {
    const secretsProvider = { getSecret: vi.fn().mockResolvedValue({ auth_scheme: "oauth2ClientCredentials", client_id: "a", client_secret: "b", token_url: "https://x/token" }) };
    const oauth2Client = { fetchToken: vi.fn().mockResolvedValue({ access_token: "tok", expires_in: 3600 }) };
    const authManager = new AuthManager(secretsProvider, new InMemoryTokenCache(), oauth2Client);
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const client = new ApiCoreClient("https://api.example.com", authManager, fetchImpl);

    await expect(client.get(baseParams)).resolves.toBeUndefined();
  });

  it("nunca deixa um erro McpToolError já normalizado ser re-envolvido", async () => {
    const secretsProvider = { getSecret: vi.fn().mockRejectedValue(new McpToolError({ code: "CUSTOM", message: "x", retryable: false })) };
    const authManager = new AuthManager(secretsProvider, new InMemoryTokenCache(), { fetchToken: vi.fn() });
    const client = new ApiCoreClient("https://api.example.com", authManager, vi.fn());

    await expect(client.get(baseParams)).rejects.toMatchObject({ code: "CUSTOM" });
  });
});
