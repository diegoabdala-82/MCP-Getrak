import { vi } from "vitest";
import type { ApiCoreClient, ApiCoreGetParams } from "../../../src/foundation/http/api-core-client.js";

export interface FakeApiCoreClient {
  client: ApiCoreClient;
  get: ReturnType<typeof vi.fn>;
}

/** Fake do ApiCoreClient — captura os parâmetros da chamada e retorna uma resposta fixa. */
export function createFakeApiCoreClient(response: unknown): FakeApiCoreClient {
  const get = vi.fn(async (_params: ApiCoreGetParams) => response);
  return { client: { get } as unknown as ApiCoreClient, get };
}
