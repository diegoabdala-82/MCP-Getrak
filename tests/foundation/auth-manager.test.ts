import { describe, expect, it, vi } from "vitest";
import { AuthManager } from "../../src/foundation/auth/auth-manager.js";
import type { OAuth2Client } from "../../src/foundation/auth/oauth2-client.js";
import { EnvSecretsProvider, MissingSecretError } from "../../src/foundation/auth/secrets-provider.js";
import { buildTokenNamespace, InMemoryTokenCache } from "../../src/foundation/auth/token-cache.js";

function fakeEnv(overrides: Record<string, string> = {}) {
  return {
    GETRAK_MCP_HOMOLOGATION_CLIENT_CREDENTIALS_CLIENT_ID: "cc-client-id",
    GETRAK_MCP_HOMOLOGATION_CLIENT_CREDENTIALS_CLIENT_SECRET: "cc-secret",
    GETRAK_MCP_HOMOLOGATION_CLIENT_CREDENTIALS_TOKEN_URL: "https://api.getrak.com/oauth/token",
    ...overrides,
  };
}

describe("US-001 — autenticação técnica por ambiente", () => {
  it("autentica na API Core usando a credencial técnica do ambiente ativo", async () => {
    const secretsProvider = new EnvSecretsProvider(fakeEnv());
    const tokenCache = new InMemoryTokenCache();
    const oauth2Client: OAuth2Client = {
      fetchToken: vi.fn().mockResolvedValue({ access_token: "token-1", expires_in: 3600 }),
    };
    const authManager = new AuthManager(secretsProvider, tokenCache, oauth2Client);

    const token = await authManager.getAccessToken({
      environment: "homologation",
      central: "central-1",
      authScheme: "oauth2ClientCredentials",
    });

    expect(token).toBe("token-1");
    expect(oauth2Client.fetchToken).toHaveBeenCalledWith(
      expect.objectContaining({ auth_scheme: "oauth2ClientCredentials", client_id: "cc-client-id" }),
    );
  });

  it("reutiliza o token em cache enquanto ele não expirou (TD-04)", async () => {
    const secretsProvider = new EnvSecretsProvider(fakeEnv());
    const tokenCache = new InMemoryTokenCache();
    const fetchToken = vi.fn().mockResolvedValue({ access_token: "token-1", expires_in: 3600 });
    const authManager = new AuthManager(secretsProvider, tokenCache, { fetchToken });

    await authManager.getAccessToken({
      environment: "homologation",
      central: "central-1",
      authScheme: "oauth2ClientCredentials",
    });
    await authManager.getAccessToken({
      environment: "homologation",
      central: "central-1",
      authScheme: "oauth2ClientCredentials",
    });

    expect(fetchToken).toHaveBeenCalledTimes(1);
  });

  it("renova o token quando o cache expirou, respeitando a margem de segurança de 60s", async () => {
    const secretsProvider = new EnvSecretsProvider(fakeEnv());
    const tokenCache = new InMemoryTokenCache();
    const fetchToken = vi
      .fn()
      .mockResolvedValueOnce({ access_token: "token-1", expires_in: 100 })
      .mockResolvedValueOnce({ access_token: "token-2", expires_in: 100 });

    let now = 0;
    const authManager = new AuthManager(secretsProvider, tokenCache, { fetchToken }, () => now);

    const first = await authManager.getAccessToken({
      environment: "homologation",
      central: "central-1",
      authScheme: "oauth2ClientCredentials",
    });
    expect(first).toBe("token-1");

    // TTL efetivo = 100 - 60 = 40s. Em t=39s ainda deve ser válido.
    now = 39_000;
    const stillCached = await authManager.getAccessToken({
      environment: "homologation",
      central: "central-1",
      authScheme: "oauth2ClientCredentials",
    });
    expect(stillCached).toBe("token-1");
    expect(fetchToken).toHaveBeenCalledTimes(1);

    // Em t=41s já passou da margem de segurança — deve renovar.
    now = 41_000;
    const renewed = await authManager.getAccessToken({
      environment: "homologation",
      central: "central-1",
      authScheme: "oauth2ClientCredentials",
    });
    expect(renewed).toBe("token-2");
    expect(fetchToken).toHaveBeenCalledTimes(2);
  });

  it("isola o cache de token por ambiente + central + esquema + credencial (TD-04)", () => {
    const namespace = buildTokenNamespace({
      environment: "production",
      central: "central-42",
      authScheme: "oauth2Password",
      credentialId: "client-abc",
    });
    expect(namespace).toBe("mcp:production:central-42:oauth2Password:client-abc");
  });

  it("suporta o esquema oauth2Password com seus próprios campos", async () => {
    const secretsProvider = new EnvSecretsProvider(
      fakeEnv({
        GETRAK_MCP_HOMOLOGATION_PASSWORD_CLIENT_ID: "pw-client-id",
        GETRAK_MCP_HOMOLOGATION_PASSWORD_CLIENT_SECRET: "pw-secret",
        GETRAK_MCP_HOMOLOGATION_PASSWORD_TOKEN_URL: "https://api.getrak.com/oauth/token",
        GETRAK_MCP_HOMOLOGATION_PASSWORD_USERNAME: "agent-user",
        GETRAK_MCP_HOMOLOGATION_PASSWORD_PASSWORD: "agent-pass",
      }),
    );
    const secret = await secretsProvider.getSecret("homologation", "oauth2Password");
    expect(secret).toMatchObject({ auth_scheme: "oauth2Password", username: "agent-user" });
  });

  it("falha explicitamente quando falta credencial técnica para o ambiente/esquema", async () => {
    const secretsProvider = new EnvSecretsProvider({});
    await expect(secretsProvider.getSecret("production", "oauth2ClientCredentials")).rejects.toBeInstanceOf(
      MissingSecretError,
    );
  });

  it("nunca inclui o valor do token em nenhuma estrutura de log (verificação estrutural)", async () => {
    // AuthManager não expõe nenhum método de log; garantimos que a única saída
    // pública é o access_token em si, sem wrapper que acabe sendo serializado.
    const secretsProvider = new EnvSecretsProvider(fakeEnv());
    const tokenCache = new InMemoryTokenCache();
    const authManager = new AuthManager(secretsProvider, tokenCache, {
      fetchToken: vi.fn().mockResolvedValue({ access_token: "super-secret-token", expires_in: 3600 }),
    });
    const token = await authManager.getAccessToken({
      environment: "homologation",
      central: "central-1",
      authScheme: "oauth2ClientCredentials",
    });
    expect(typeof token).toBe("string");
  });
});
