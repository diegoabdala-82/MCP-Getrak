import { vi } from "vitest";
import type { DelegatedTokenManager } from "../../../src/foundation/auth/delegated-token-manager.js";
import type { ApiCoreClient, ApiCoreGetParams } from "../../../src/foundation/http/api-core-client.js";

export interface FakeApiCoreClient {
  client: ApiCoreClient;
  get: ReturnType<typeof vi.fn>;
}

export function createFakeApiCoreClient(response: unknown): FakeApiCoreClient {
  const get = vi.fn(async (params: ApiCoreGetParams) => {
    await params.delegatedTokenProvider?.();
    return response;
  });
  return { client: { get } as unknown as ApiCoreClient, get };
}

export interface FakeDelegatedTokenManager {
  manager: DelegatedTokenManager;
  getAccessToken: ReturnType<typeof vi.fn>;
}

export function createFakeDelegatedTokenManager(token = "delegated-token"): FakeDelegatedTokenManager {
  const getAccessToken = vi.fn(async () => token);
  return { manager: { getAccessToken } as unknown as DelegatedTokenManager, getAccessToken };
}

export const ctx = {
  requestId: "req-1",
  central: "central-1",
  environment: "homologation" as const,
  consumer: { consumer_id: "c" },
};
