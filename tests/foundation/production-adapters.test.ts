import { describe, expect, it, vi } from "vitest";
import { RedisTokenCache, type RedisLikeClient } from "../../src/foundation/auth/redis-token-cache.js";
import { AwsSecretsManagerProvider } from "../../src/foundation/auth/aws-secrets-provider.js";
import { MissingSecretError } from "../../src/foundation/auth/secrets-provider.js";

describe("TD-04 — RedisTokenCache (produção)", () => {
  function fakeRedis(): RedisLikeClient & { store: Map<string, string> } {
    const store = new Map<string, string>();
    return {
      store,
      get: async (key) => store.get(key) ?? null,
      set: async (key, value) => {
        store.set(key, value);
        return "OK";
      },
      del: async (key) => {
        store.delete(key);
        return 1;
      },
    };
  }

  it("grava e recupera um token através do cliente Redis injetado", async () => {
    const redis = fakeRedis();
    const cache = new RedisTokenCache(redis);

    await cache.set("mcp:homologation:central-1:oauth2ClientCredentials:client-a", {
      access_token: "tok-1",
      expires_at: 123,
    }, 60);

    const cached = await cache.get("mcp:homologation:central-1:oauth2ClientCredentials:client-a");
    expect(cached).toEqual({ access_token: "tok-1", expires_at: 123 });
  });

  it("não grava quando o TTL efetivo já é zero/negativo", async () => {
    const redis = fakeRedis();
    const cache = new RedisTokenCache(redis);
    await cache.set("ns", { access_token: "tok-1", expires_at: 0 }, 0);
    expect(redis.store.size).toBe(0);
  });

  it("remove um token do cache", async () => {
    const redis = fakeRedis();
    const cache = new RedisTokenCache(redis);
    await cache.set("ns", { access_token: "tok-1", expires_at: 123 }, 60);
    await cache.delete("ns");
    expect(await cache.get("ns")).toBeNull();
  });
});

describe("TD-02 — AwsSecretsManagerProvider (produção)", () => {
  it("resolve um segredo oauth2ClientCredentials do Secrets Manager", async () => {
    const send = vi.fn().mockResolvedValue({
      SecretString: JSON.stringify({
        client_id: "cc-id",
        client_secret: "cc-secret",
        token_url: "https://api.getrak.com/oauth/token",
      }),
    });
    const provider = new AwsSecretsManagerProvider({ send } as never);

    const secret = await provider.getSecret("production", "oauth2ClientCredentials");
    expect(secret).toEqual({
      auth_scheme: "oauth2ClientCredentials",
      client_id: "cc-id",
      client_secret: "cc-secret",
      token_url: "https://api.getrak.com/oauth/token",
    });
  });

  it("resolve um segredo oauth2Password com username/password", async () => {
    const send = vi.fn().mockResolvedValue({
      SecretString: JSON.stringify({
        client_id: "pw-id",
        client_secret: "pw-secret",
        token_url: "https://api.getrak.com/oauth/token",
        username: "agent",
        password: "pass",
      }),
    });
    const provider = new AwsSecretsManagerProvider({ send } as never);

    const secret = await provider.getSecret("production", "oauth2Password");
    expect(secret).toMatchObject({ auth_scheme: "oauth2Password", username: "agent" });
  });

  it("lança MissingSecretError quando o Secrets Manager não retorna SecretString", async () => {
    const send = vi.fn().mockResolvedValue({});
    const provider = new AwsSecretsManagerProvider({ send } as never);

    await expect(provider.getSecret("production", "oauth2ClientCredentials")).rejects.toBeInstanceOf(
      MissingSecretError,
    );
  });
});
