import { describe, expect, it } from "vitest";
import { createSearchMaintenanceServicesTool } from "../../../src/domain/maintenance/search-maintenance-services.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

describe("US-055 — search_maintenance_services", () => {
  it("extrai o envelope aninhado real {data, pagination: {total, page, itemsPerPage, totalPages}}", async () => {
    const fake = createFakeApiCoreClient({
      data: [{ id: 2, name: "Troca de óleo", status: "active" }],
      pagination: { total: 13, page: 1, itemsPerPage: 5, totalPages: 3 },
    });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchMaintenanceServicesTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", search_name: "leo", page: 1, page_size: 5 }),
      ctx,
    );

    expect(result.data.services).toEqual([{ id: 2, name: "Troca de óleo", status: "active" }]);
    expect(result.data.pagination).toMatchObject({ page: 1, page_size: 5, total_items: 13, has_more: true });
  });

  it("traduz filtros/ordenação para a query real, com per_page (não perPage)", async () => {
    const fake = createFakeApiCoreClient({ data: [], pagination: { total: 0, page: 1, itemsPerPage: 10, totalPages: 0 } });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchMaintenanceServicesTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const input = definition.inputSchema.parse({
      central: "central-1",
      status: "active",
      sort_by: "value_cents",
      sort_direction: "DESC",
      page: 1,
      page_size: 10,
    });
    await definition.handler(input, ctx);

    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({ "filters[status]": "active", "order[value_cents]": "DESC", page: 1, per_page: 10 }),
      }),
    );
  });

  it("retorna lista vazia normalizada quando nenhum serviço corresponde ao filtro (ex.: status inactive sem cadastro)", async () => {
    const fake = createFakeApiCoreClient({ data: [], pagination: { total: 0, page: 1, itemsPerPage: 25, totalPages: 0 } });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchMaintenanceServicesTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", status: "inactive" }),
      ctx,
    );

    expect(result.data.services).toEqual([]);
    expect(result.data.pagination.total_items).toBe(0);
  });
});
