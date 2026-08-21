import { describe, expect, it } from "vitest";
import { ErrorCodes, McpToolError } from "../../../src/domain/errors.js";
import { createSearchJourneysTool } from "../../../src/domain/journeys/search-journeys.js";
import {
  createFakeApiCoreClient,
  createFakeDelegatedTokenManager,
  createFallbackApiCoreClient,
  createRejectingApiCoreClient,
  ctx,
} from "./test-helpers.js";

describe("US-080 — search_journeys", () => {
  it("consulta v2.0 e retorna viagens normalizadas e paginadas", async () => {
    const fake = createFakeApiCoreClient({ data: [{ id: 12, status: "F" }], page: 1, pages: 1, total: 1 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchJourneysTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);

    expect(result.data.journeys).toEqual([{ id: 12, status: "F" }]);
    expect(result.endpoints).toEqual(["GET /v2.0/journeys"]);
    expect(result.warnings).toEqual([]);
    expect(fake.get).toHaveBeenCalledWith(expect.objectContaining({ path: "/v2.0/journeys" }));
  });

  it("traduz filtros/paginação para a query real de v2.0, com sufixo [] em filters[status][in] e per_page (não perPage)", async () => {
    const fake = createFakeApiCoreClient({ data: [], page: 1, pages: 0, total: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchJourneysTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const input = definition.inputSchema.parse({
      central: "central-1",
      vehicle_id: 4507546,
      driver_id: 42,
      statuses: ["A", "F"],
      start_date_after: "2026-01-01T00:00:00Z",
      start_date_before: "2026-12-31T23:59:59Z",
      sort_by: "start_date",
      sort_direction: "DESC",
      page: 2,
      page_size: 10,
    });
    await definition.handler(input, ctx);

    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/v2.0/journeys",
        query: expect.objectContaining({
          "filters[vehicle_id]": 4507546,
          "filters[driver_id]": 42,
          "filters[status][in][]": ["A", "F"],
          "filters[start_date][gte]": "2026-01-01T00:00:00Z",
          "filters[start_date][lte]": "2026-12-31T23:59:59Z",
          "order[start_date]": "DESC",
          page: 2,
          per_page: 10,
        }),
      }),
    );
  });

  it("retorna lista vazia normalizada quando nenhuma viagem corresponde ao filtro", async () => {
    const fake = createFakeApiCoreClient({ data: [], page: 1, pages: 0, total: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchJourneysTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", vehicle_id: 999999999 }),
      ctx,
    );

    expect(result.data.journeys).toEqual([]);
  });

  it("nunca aceita 'version' como parâmetro de tool (não existe no schema)", () => {
    const { definition } = createSearchJourneysTool({
      apiCoreClient: createFakeApiCoreClient({}).client,
      delegatedTokenManager: createFakeDelegatedTokenManager().manager,
    });
    expect("version" in definition.inputSchema.shape).toBe(false);
  });

  it("GAP-020: recorre a v1.0 internamente quando v2.0 falha com um erro real de upstream, sem expor a versão ao chamador", async () => {
    const fake = createFallbackApiCoreClient({
      v2Error: new McpToolError({ code: ErrorCodes.UPSTREAM_ERROR, message: "boom", retryable: false }),
      v1Response: { data: [{ id: 33974551, status: "F" }], page: 1, pages: 1, total: 1 },
    });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchJourneysTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);

    expect(result.data.journeys).toEqual([{ id: 33974551, status: "F" }]);
    expect(result.endpoints).toEqual(["GET /v1.0/journeys (fallback)"]);
    expect(result.warnings?.[0]).toMatch(/v1\.0 fallback/);
    expect(fake.get).toHaveBeenCalledTimes(2);
    expect(fake.get.mock.calls[0][0]).toMatchObject({ path: "/v2.0/journeys" });
    expect(fake.get.mock.calls[1][0]).toMatchObject({ path: "/v1.0/journeys" });
  });

  it("não recorre a v1.0 quando a falha de v2.0 não é elegível para fallback (ex.: erro de validação/domínio)", async () => {
    const fake = createRejectingApiCoreClient(
      new McpToolError({ code: "SOME_DOMAIN_ERROR", message: "x", retryable: false }),
    );
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchJourneysTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    await expect(
      definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx),
    ).rejects.toMatchObject({ code: "SOME_DOMAIN_ERROR" });
    expect(fake.get).toHaveBeenCalledTimes(1);
  });
});
