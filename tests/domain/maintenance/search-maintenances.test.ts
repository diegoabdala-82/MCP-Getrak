import { describe, expect, it } from "vitest";
import { createSearchMaintenancesTool } from "../../../src/domain/maintenance/search-maintenances.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

describe("US-057 — search_maintenances", () => {
  it("retorna manutenções normalizadas e paginadas dentro da central autorizada", async () => {
    const fake = createFakeApiCoreClient({ data: [{ id: 1, name: "Troca de óleo", status: "finished" }], page: 1, pages: 1, total: 1 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchMaintenancesTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", statuses: ["finished"] }),
      ctx,
    );

    expect(result.data.maintenances).toEqual([{ id: 1, name: "Troca de óleo", status: "finished" }]);
    expect(result.authScheme).toBe("oauth2Password");
  });

  it("traduz filtros/include/paginação para a query real, com per_page (não perPage)", async () => {
    const fake = createFakeApiCoreClient({ data: [], page: 1, pages: 1, total: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchMaintenancesTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const input = definition.inputSchema.parse({
      central: "central-1",
      vehicle_ids: [12660533],
      statuses: ["scheduled", "overdue"],
      type: "periodic",
      include: ["last_execution", "services"],
      sort_by: "scheduled_date",
      sort_direction: "DESC",
      page: 2,
      page_size: 10,
    });
    await definition.handler(input, ctx);

    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          "filters[vehicle_id][in][]": [12660533],
          "filters[status][in][]": ["scheduled", "overdue"],
          "filters[type]": "periodic",
          "include[]": ["last_execution", "services"],
          "order[scheduled_date]": "DESC",
          page: 2,
          per_page: 10,
        }),
      }),
    );
  });

  it("retorna lista vazia normalizada quando um vehicle_id inexistente é usado como filtro (sem erro)", async () => {
    const fake = createFakeApiCoreClient({ data: [], page: 1, pages: 0, total: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchMaintenancesTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", vehicle_ids: [999999999] }),
      ctx,
    );

    expect(result.data.maintenances).toEqual([]);
  });
});
