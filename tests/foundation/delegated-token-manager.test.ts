import { describe, expect, it, vi } from "vitest";
import { ErrorCodes, McpToolError } from "../../src/domain/errors.js";
import { DelegatedTokenManager, DEFAULT_DELEGATED_SESSION_ID } from "../../src/foundation/auth/delegated-token-manager.js";
import type { OAuth2Client } from "../../src/foundation/auth/oauth2-client.js";
import { TokenRequestFailedError } from "../../src/foundation/auth/oauth2-client.js";
import { buildDelegatedTokenNamespace, InMemoryTokenCache } from "../../src/foundation/auth/token-cache.js";
import {
  EnvUserCredentialsProvider,
  MissingUserCredentialError,
  type UserCredentialsProvider,
} from "../../src/foundation/auth/user-credentials-provider.js";
import { UpstreamNetworkError, UpstreamTimeoutError } from "../../src/foundation/errors/error-normalizer.js";

function fakeUserEnv(overrides: Record<string, string> = {}) {
  return {
    GETRAK_MCP_HOMOLOGATION_OAUTH2PASSWORD_USER_CLAUDE_CODE_CLIENT_ID: "web-client-id",
    GETRAK_MCP_HOMOLOGATION_OAUTH2PASSWORD_USER_CLAUDE_CODE_CLIENT_SECRET: "web-secret",
    GETRAK_MCP_HOMOLOGATION_OAUTH2PASSWORD_USER_CLAUDE_CODE_USERNAME: "diego.abdala",
    GETRAK_MCP_HOMOLOGATION_OAUTH2PASSWORD_USER_CLAUDE_CODE_PASSWORD: "user-pass",
    GETRAK_MCP_HOMOLOGATION_OAUTH2PASSWORD_USER_CLAUDE_CODE_TOKEN_URL: "https://api.getrak.com/newkoauth/oauth/token",
    ...overrides,
  };
}

describe("US-046/047/048 — DelegatedTokenManager", () => {
  it("obtém o token delegado usando a credencial do usuário armazenada, não uma credencial técnica", async () => {
    const provider = new EnvUserCredentialsProvider(fakeUserEnv());
    const cache = new InMemoryTokenCache();
    const fetchToken = vi.fn().mockResolvedValue({ access_token: "delegated-token-1", expires_in: 3600 });
    const manager = new DelegatedTokenManager(provider, cache, { fetchToken });

    const token = await manager.getAccessToken({
      environment: "homologation",
      central: "central-1",
      userId: "claude-code",
    });

    expect(token).toBe("delegated-token-1");
    expect(fetchToken).toHaveBeenCalledWith(
      expect.objectContaining({ auth_scheme: "oauth2Password", username: "diego.abdala", password: "user-pass" }),
    );
  });

  it("isola o cache no namespace delegado mcp:{environment}:{central}:oauth2Password:{user_id}:{session_id}", () => {
    const namespace = buildDelegatedTokenNamespace({
      environment: "production",
      central: "central-42",
      userId: "user-7",
      sessionId: "session-9",
    });
    expect(namespace).toBe("mcp:production:central-42:oauth2Password:user-7:session-9");
  });

  it("usa DEFAULT_DELEGATED_SESSION_ID quando nenhum session_id é fornecido", async () => {
    const provider = new EnvUserCredentialsProvider(fakeUserEnv());
    const cache = new InMemoryTokenCache();
    const setSpy = vi.spyOn(cache, "set");
    const fetchToken = vi.fn().mockResolvedValue({ access_token: "t", expires_in: 3600 });
    const manager = new DelegatedTokenManager(provider, cache, { fetchToken });

    await manager.getAccessToken({ environment: "homologation", central: "central-1", userId: "claude-code" });

    expect(setSpy).toHaveBeenCalledWith(
      `mcp:homologation:central-1:oauth2Password:claude-code:${DEFAULT_DELEGATED_SESSION_ID}`,
      expect.anything(),
      expect.anything(),
    );
  });

  it("reutiliza o token em cache enquanto não expirou", async () => {
    const provider = new EnvUserCredentialsProvider(fakeUserEnv());
    const cache = new InMemoryTokenCache();
    const fetchToken = vi.fn().mockResolvedValue({ access_token: "t", expires_in: 3600 });
    const manager = new DelegatedTokenManager(provider, cache, { fetchToken });

    await manager.getAccessToken({ environment: "homologation", central: "central-1", userId: "claude-code" });
    await manager.getAccessToken({ environment: "homologation", central: "central-1", userId: "claude-code" });

    expect(fetchToken).toHaveBeenCalledTimes(1);
  });

  it("renova automaticamente o token quando o cache expirou (margem de 60s), antes de falhar", async () => {
    const provider = new EnvUserCredentialsProvider(fakeUserEnv());
    const cache = new InMemoryTokenCache();
    const fetchToken = vi
      .fn()
      .mockResolvedValueOnce({ access_token: "t1", expires_in: 100 })
      .mockResolvedValueOnce({ access_token: "t2", expires_in: 100 });

    let now = 0;
    const manager = new DelegatedTokenManager(provider, cache, { fetchToken }, () => now);

    const first = await manager.getAccessToken({ environment: "homologation", central: "central-1", userId: "claude-code" });
    expect(first).toBe("t1");

    now = 41_000;
    const renewed = await manager.getAccessToken({ environment: "homologation", central: "central-1", userId: "claude-code" });
    expect(renewed).toBe("t2");
    expect(fetchToken).toHaveBeenCalledTimes(2);
  });

  it("falha de forma controlada com USER_CREDENTIAL_INVALID quando nenhuma credencial de usuário está configurada", async () => {
    const provider = new EnvUserCredentialsProvider({});
    const cache = new InMemoryTokenCache();
    const manager = new DelegatedTokenManager(provider, cache, { fetchToken: vi.fn() });

    await expect(
      manager.getAccessToken({ environment: "homologation", central: "central-1", userId: "unknown-user" }),
    ).rejects.toMatchObject({ code: ErrorCodes.USER_CREDENTIAL_INVALID, retryable: false });
  });

  it("falha de forma controlada com USER_CREDENTIAL_INVALID quando a API Core rejeita a credencial (renovação falhou)", async () => {
    const provider = new EnvUserCredentialsProvider(fakeUserEnv());
    const cache = new InMemoryTokenCache();
    const oauth2Client: OAuth2Client = {
      fetchToken: vi.fn().mockRejectedValue(new TokenRequestFailedError(401)),
    };
    const manager = new DelegatedTokenManager(provider, cache, oauth2Client);

    await expect(
      manager.getAccessToken({ environment: "homologation", central: "central-1", userId: "claude-code" }),
    ).rejects.toMatchObject({ code: ErrorCodes.USER_CREDENTIAL_INVALID, retryable: false });
  });

  it("não tenta indefinidamente — uma única tentativa de renovação falhada já retorna o erro", async () => {
    const provider = new EnvUserCredentialsProvider(fakeUserEnv());
    const cache = new InMemoryTokenCache();
    const fetchToken = vi.fn().mockRejectedValue(new TokenRequestFailedError(400));
    const manager = new DelegatedTokenManager(provider, cache, { fetchToken });

    await expect(
      manager.getAccessToken({ environment: "homologation", central: "central-1", userId: "claude-code" }),
    ).rejects.toBeInstanceOf(McpToolError);
    expect(fetchToken).toHaveBeenCalledTimes(1);
  });

  it("distingue falha transitória de rede/timeout (retryable) de credencial inválida (não retryable)", async () => {
    const provider = new EnvUserCredentialsProvider(fakeUserEnv());
    const cache = new InMemoryTokenCache();
    const fetchToken = vi.fn().mockRejectedValue(new UpstreamTimeoutError(5000));
    const manager = new DelegatedTokenManager(provider, cache, { fetchToken });

    await expect(
      manager.getAccessToken({ environment: "homologation", central: "central-1", userId: "claude-code" }),
    ).rejects.toMatchObject({ code: ErrorCodes.TIMEOUT, retryable: true });
  });

  it("propaga erro de rede como transitório/retryable, não como USER_CREDENTIAL_INVALID", async () => {
    const provider = new EnvUserCredentialsProvider(fakeUserEnv());
    const cache = new InMemoryTokenCache();
    const fetchToken = vi.fn().mockRejectedValue(new UpstreamNetworkError(new Error("ECONNRESET")));
    const manager = new DelegatedTokenManager(provider, cache, { fetchToken });

    await expect(
      manager.getAccessToken({ environment: "homologation", central: "central-1", userId: "claude-code" }),
    ).rejects.toMatchObject({ code: ErrorCodes.UPSTREAM_UNAVAILABLE, retryable: true });
  });

  it("nunca inclui o valor do token em nenhuma estrutura pública além do retorno em si", async () => {
    const provider: UserCredentialsProvider = {
      getCredential: vi.fn().mockResolvedValue({
        client_id: "c",
        client_secret: "s",
        username: "u",
        password: "p",
        token_url: "https://x",
      }),
    };
    const cache = new InMemoryTokenCache();
    const manager = new DelegatedTokenManager(provider, cache, {
      fetchToken: vi.fn().mockResolvedValue({ access_token: "super-secret-delegated-token", expires_in: 3600 }),
    });

    const token = await manager.getAccessToken({ environment: "homologation", central: "central-1", userId: "u1" });
    expect(typeof token).toBe("string");
  });
});

describe("US-046 — EnvUserCredentialsProvider / MissingUserCredentialError", () => {
  it("resolve a credencial do usuário a partir de variáveis de ambiente por usuário", async () => {
    const provider = new EnvUserCredentialsProvider(fakeUserEnv());
    const credential = await provider.getCredential("homologation", "claude-code");
    expect(credential).toEqual({
      client_id: "web-client-id",
      client_secret: "web-secret",
      username: "diego.abdala",
      password: "user-pass",
      token_url: "https://api.getrak.com/newkoauth/oauth/token",
    });
  });

  it("falha explicitamente (MissingUserCredentialError) quando o usuário nunca configurou a credencial", async () => {
    const provider = new EnvUserCredentialsProvider({});
    await expect(provider.getCredential("homologation", "someone")).rejects.toBeInstanceOf(MissingUserCredentialError);
  });
});
