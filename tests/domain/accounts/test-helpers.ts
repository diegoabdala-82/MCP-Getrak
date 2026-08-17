import { vi } from "vitest";
import type { ApiCoreClient, ApiCoreGetParams } from "../../../src/foundation/http/api-core-client.js";

export interface FakeApiCoreClient {
  client: ApiCoreClient;
  get: ReturnType<typeof vi.fn>;
}

export function createFakeApiCoreClient(response: unknown): FakeApiCoreClient {
  const get = vi.fn(async (_params: ApiCoreGetParams) => response);
  return { client: { get } as unknown as ApiCoreClient, get };
}

export function createRejectingApiCoreClient(error: unknown): FakeApiCoreClient {
  const get = vi.fn(async (_params: ApiCoreGetParams) => {
    throw error;
  });
  return { client: { get } as unknown as ApiCoreClient, get };
}

export const ctx = {
  requestId: "req-1",
  central: "central-1",
  environment: "homologation" as const,
  consumer: { consumer_id: "c" },
};
