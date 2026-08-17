import { describe, expect, it } from "vitest";
import { createSearchWebVehiclesTool } from "../../../src/domain/web-vehicles/search-web-vehicles.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

describe("US-070 — search_web_vehicles", () => {
  it("retorna veículos normalizados e paginados dentro da central autorizada", async () => {
    const fake = createFakeApiCoreClient({ data: [{ id: 1, plate: "NYC1D62" }], page: 1, pages: 1, total: 1 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchWebVehiclesTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", search: "NYC1D62" }),
      ctx,
    );

    expect(result.data.vehicles).toEqual([{ id: 1, plate: "NYC1D62" }]);
    expect(result.authScheme).toBe("oauth2Password");
  });

  it("traduz filtros/paginação para a query real, com per_page (não perPage)", async () => {
    const fake = createFakeApiCoreClient({ data: [], page: 1, pages: 1, total: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchWebVehiclesTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const input = definition.inputSchema.parse({
      central: "central-1",
      search: "teste",
      client_id: 10,
      status: "active",
      brand_contains: "Honda",
      model_contains: "CB",
      vin: "9C2NC4310CR044107",
      page: 2,
      page_size: 10,
    });
    await definition.handler(input, ctx);

    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/v1.0/vehicles",
        query: {
          "filters[search]": "teste",
          "filters[client_id]": 10,
          "filters[client_id][is_null]": undefined,
          "filters[subclient_id]": undefined,
          "filters[status]": "active",
          "filters[brand][like]": "Honda",
          "filters[model][like]": "CB",
          "filters[equipment][eq]": undefined,
          "filters[vin][eq]": "9C2NC4310CR044107",
          "order[vehicle_name]": undefined,
          page: 2,
          per_page: 10,
        },
        authScheme: "oauth2Password",
      }),
    );
  });

  it("retorna lista vazia normalizada quando nenhum veículo corresponde ao filtro", async () => {
    const fake = createFakeApiCoreClient({ data: [], page: 1, pages: 0, total: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchWebVehiclesTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", search: "NAOEXISTEVEICULOXYZ999" }),
      ctx,
    );

    expect(result.data.vehicles).toEqual([]);
    expect(result.data.pagination).toMatchObject({ total_items: 0 });
  });

  it("rejeita status fora do enum documentado", () => {
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchWebVehiclesTool({
      apiCoreClient: createFakeApiCoreClient({}).client,
      delegatedTokenManager: delegated.manager,
    });
    expect(() => definition.inputSchema.parse({ central: "central-1", status: "deleted" })).toThrow();
  });
});
