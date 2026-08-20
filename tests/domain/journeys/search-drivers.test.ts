import { describe, expect, it } from "vitest";
import { ErrorCodes, McpToolError } from "../../../src/domain/errors.js";
import { createSearchDriversTool } from "../../../src/domain/journeys/search-drivers.js";
import {
  createFakeApiCoreClient,
  createFakeDelegatedTokenManager,
  createFallbackApiCoreClient,
  ctx,
} from "./test-helpers.js";

describe("US-083 — search_drivers", () => {
  it("consulta v2.0 e retorna motoristas normalizados e paginados", async () => {
    const fake = createFakeApiCoreClient({ data: [{ id: 364020, name: "....k" }], page: 1, pages: 1, total: 1 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchDriversTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);

    expect(result.data.drivers).toEqual([{ id: 364020, name: "....k" }]);
    expect(result.endpoints).toEqual(["GET /v2.0/journeys/drivers"]);
    expect(fake.get).toHaveBeenCalledWith(expect.objectContaining({ path: "/v2.0/journeys/drivers" }));
  });

  it("traduz filtros/paginação para a query real de v2.0, sem expor um filtro de múltiplos ids confirmadamente quebrado", async () => {
    const fake = createFakeApiCoreClient({ data: [], page: 1, pages: 0, total: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchDriversTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const input = definition.inputSchema.parse({
      central: "central-1",
      search: "Jose",
      status: "Y",
      has_identifier: true,
      sort_by: "name",
      sort_direction: "ASC",
      page: 2,
      page_size: 10,
    });
    await definition.handler(input, ctx);

    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/v2.0/journeys/drivers",
        query: expect.objectContaining({
          "filters[search]": "Jose",
          "filters[status]": "Y",
          "filters[has_identifier]": true,
          "order[name]": "ASC",
          page: 2,
          per_page: 10,
        }),
      }),
    );
    expect("ids" in definition.inputSchema.shape).toBe(false);
  });

  it("retorna lista vazia normalizada quando nenhum motorista corresponde ao filtro", async () => {
    const fake = createFakeApiCoreClient({ data: [], page: 1, pages: 0, total: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchDriversTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", search: "nome-que-nao-existe" }),
      ctx,
    );

    expect(result.data.drivers).toEqual([]);
  });

  it("GAP-020: recorre a v1.0 internamente quando v2.0 falha, mesmo sabendo que o endpoint v1.0 real está confirmadamente quebrado em produção", async () => {
    const fake = createFallbackApiCoreClient({
      v2Error: new McpToolError({ code: ErrorCodes.UPSTREAM_UNAVAILABLE, message: "boom", retryable: true }),
      v1Response: { data: [{ id: 197911, name: "Rafael Cardoso" }], page: 1, pages: 1, total: 1 },
    });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchDriversTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);

    expect(result.data.drivers).toEqual([{ id: 197911, name: "Rafael Cardoso" }]);
    expect(result.endpoints).toEqual(["GET /v1.0/journeys/drivers (fallback)"]);
    expect(result.warnings?.[0]).toMatch(/v1\.0 fallback/);
    expect(fake.get).toHaveBeenCalledTimes(2);
    expect(fake.get.mock.calls[1][0]).toMatchObject({ path: "/v1.0/journeys/drivers" });
  });

  it("propaga o erro normalizado quando v2.0 falha E o fallback v1.0 também falha (cenário real em produção — v1.0/journeys/drivers está sempre quebrado)", async () => {
    const fake = createFallbackApiCoreClient({
      v2Error: new McpToolError({ code: ErrorCodes.UPSTREAM_ERROR, message: "v2 down", retryable: false }),
      v1Response: undefined,
    });
    // Sobrescreve o comportamento padrão para simular o v1.0 500 real confirmado em produção.
    fake.get.mockImplementation(async (params: { path: string; delegatedTokenProvider?: () => Promise<string> }) => {
      await params.delegatedTokenProvider?.();
      throw new McpToolError({ code: ErrorCodes.UPSTREAM_ERROR, message: "Internal error", retryable: false });
    });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchDriversTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    await expect(
      definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx),
    ).rejects.toMatchObject({ code: ErrorCodes.UPSTREAM_ERROR });
    expect(fake.get).toHaveBeenCalledTimes(2);
  });
});
