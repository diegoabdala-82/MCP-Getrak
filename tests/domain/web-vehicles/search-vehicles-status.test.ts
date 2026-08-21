import { describe, expect, it } from "vitest";
import { createSearchVehiclesStatusTool } from "../../../src/domain/web-vehicles/search-vehicles-status.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

describe("US-075 — search_vehicles_status", () => {
  it("retorna status normalizados e paginados dentro da central autorizada", async () => {
    const fake = createFakeApiCoreClient({ data: [{ vehicle_id: 4085381, plate: "NYC1D62" }], page: 1, pages: 1, total: 1 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchVehiclesStatusTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1", plate: "NYC1D62" }), ctx);

    expect(result.data.statuses).toEqual([{ vehicle_id: 4085381, plate: "NYC1D62" }]);
  });

  it("traduz filtros (incluindo arrays repetidos) e ordenação com enum minúsculo (asc/desc), com per_page", async () => {
    const fake = createFakeApiCoreClient({ data: [], page: 1, pages: 1, total: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchVehiclesStatusTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const input = definition.inputSchema.parse({
      central: "central-1",
      communication_range: "less_than_1h",
      statuses: ["active", "restricted"],
      category_vehicle_ids: [1, 2],
      sort_by: "gps_time",
      sort_direction: "desc",
      page: 1,
      page_size: 20,
    });
    await definition.handler(input, ctx);

    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/v1.0/localization/vehicles-status",
        query: expect.objectContaining({
          "filters[communication_range]": "less_than_1h",
          "filters[status]": ["active", "restricted"],
          "filters[category_vehicle_id]": [1, 2],
          "order[gps_time]": "desc",
          page: 1,
          per_page: 20,
        }),
      }),
    );
  });

  it("retorna lista vazia normalizada quando nenhum status corresponde ao filtro", async () => {
    const fake = createFakeApiCoreClient({ data: [], page: 1, pages: 0, total: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchVehiclesStatusTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1", plate: "ZZZZZZZ" }), ctx);

    expect(result.data.statuses).toEqual([]);
  });

  it("rejeita sort_direction fora do enum real (minúsculo)", () => {
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchVehiclesStatusTool({
      apiCoreClient: createFakeApiCoreClient({}).client,
      delegatedTokenManager: delegated.manager,
    });
    expect(() => definition.inputSchema.parse({ central: "central-1", sort_by: "gps_time", sort_direction: "DESC" })).toThrow();
  });
});
