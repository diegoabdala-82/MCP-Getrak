import { describe, expect, it } from "vitest";
import { createSearchFuelSuppliesTool } from "../../../src/domain/maintenance/search-fuel-supplies.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

describe("US-051 — search_fuel_supplies", () => {
  it("retorna abastecimentos normalizados e paginados dentro da central autorizada", async () => {
    const fake = createFakeApiCoreClient({ data: [{ id: 101, fuel_type: "gasoline" }], page: 1, pages: 1, total: 1 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchFuelSuppliesTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", fuel_types: ["gasoline"] }),
      ctx,
    );

    expect(result.data.fuel_supplies).toEqual([{ id: 101, fuel_type: "gasoline" }]);
    expect(result.authScheme).toBe("oauth2Password");
  });

  it("traduz filtros/paginação para a query real, com sufixo [] em filters[fuel_type][in] e per_page (não perPage)", async () => {
    const fake = createFakeApiCoreClient({ data: [], page: 1, pages: 1, total: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchFuelSuppliesTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const input = definition.inputSchema.parse({
      central: "central-1",
      vehicle_id: 9910097,
      fuel_types: ["gasoline", "ethanol"],
      supply_date_after: "2026-01-01T00:00:00Z",
      supply_date_before: "2026-12-31T23:59:59Z",
      sort_by: "supply_date",
      sort_direction: "DESC",
      page: 2,
      page_size: 10,
    });
    await definition.handler(input, ctx);

    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/v2.0/maintenance/fuel-supply",
        query: expect.objectContaining({
          "filters[vehicle_id]": 9910097,
          "filters[fuel_type][in][]": ["gasoline", "ethanol"],
          "filters[supply_date][gte]": "2026-01-01T00:00:00Z",
          "filters[supply_date][lte]": "2026-12-31T23:59:59Z",
          "order[supply_date]": "DESC",
          page: 2,
          per_page: 10,
        }),
        notFoundCode: "VEHICLE_NOT_FOUND",
      }),
    );
  });

  it("retorna lista vazia normalizada quando nenhum abastecimento corresponde ao filtro de data", async () => {
    const fake = createFakeApiCoreClient({ data: [], page: 1, pages: 0, total: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchFuelSuppliesTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", supply_date_after: "2099-01-01T00:00:00Z" }),
      ctx,
    );

    expect(result.data.fuel_supplies).toEqual([]);
  });
});
