import { vi } from "vitest";
import type { DelegatedTokenManager } from "../../../src/foundation/auth/delegated-token-manager.js";
import type { ApiCoreClient, ApiCoreGetParams } from "../../../src/foundation/http/api-core-client.js";

export interface FakeApiCoreClient {
  client: ApiCoreClient;
  get: ReturnType<typeof vi.fn>;
}

/**
 * Se `params.delegatedTokenProvider` for fornecido, resolve-o antes de
 * responder — espelha o comportamento real de `ApiCoreClient.get()` (que
 * sempre obtém o token antes de chamar o endpoint), para que falhas de
 * resolução de token delegado se propaguem corretamente nos testes.
 */
export function createFakeApiCoreClient(response: unknown): FakeApiCoreClient {
  const get = vi.fn(async (params: ApiCoreGetParams) => {
    await params.delegatedTokenProvider?.();
    return response;
  });
  return { client: { get } as unknown as ApiCoreClient, get };
}

export function createRejectingApiCoreClient(error: unknown): FakeApiCoreClient {
  const get = vi.fn(async (_params: ApiCoreGetParams) => {
    throw error;
  });
  return { client: { get } as unknown as ApiCoreClient, get };
}

/**
 * Epic 20 (GAP-020) — simula o cenário de fallback v2.0 -> v1.0: a
 * primeira chamada (v2.0, identificada pelo path) rejeita com o erro
 * fornecido; qualquer chamada subsequente (v1.0) resolve com a resposta de
 * fallback fornecida. Usado para testar `callWithV1Fallback` de forma
 * determinística sem depender da ordem real de chamadas do adapter.
 */
export function createFallbackApiCoreClient(params: {
  v2Error: unknown;
  v1Response: unknown;
}): FakeApiCoreClient {
  const get = vi.fn(async (apiParams: ApiCoreGetParams) => {
    await apiParams.delegatedTokenProvider?.();
    if (apiParams.path.startsWith("/v2.0/")) {
      throw params.v2Error;
    }
    return params.v1Response;
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

export function createRejectingDelegatedTokenManager(error: unknown): FakeDelegatedTokenManager {
  const getAccessToken = vi.fn(async () => {
    throw error;
  });
  return { manager: { getAccessToken } as unknown as DelegatedTokenManager, getAccessToken };
}

export const ctx = {
  requestId: "req-1",
  central: "central-1",
  environment: "homologation" as const,
  consumer: { consumer_id: "c" },
};
