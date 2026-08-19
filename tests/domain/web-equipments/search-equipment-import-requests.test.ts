import { describe, expect, it } from "vitest";
import { createSearchEquipmentImportRequestsTool } from "../../../src/domain/web-equipments/search-equipment-import-requests.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

describe("US-100 — search_equipment_import_requests", () => {
  it("retorna requisições de importação normalizadas e paginadas, com per_page (não perPage)", async () => {
    const fake = createFakeApiCoreClient({ data: [{ id: 126, status: "done_with_errors" }], page: 1, pages: 1, total: 1 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchEquipmentImportRequestsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", sort_direction: "DESC", page: 1, page_size: 5 }),
      ctx,
    );

    expect(result.data.import_requests).toEqual([{ id: 126, status: "done_with_errors" }]);
    expect(fake.get).toHaveBeenCalledWith(expect.objectContaining({ query: expect.objectContaining({ "order[id]": "DESC", page: 1, per_page: 5 }) }));
  });

  it("retorna lista vazia normalizada quando nenhuma requisição de importação corresponde ao filtro", async () => {
    const fake = createFakeApiCoreClient({ data: [], page: 1, pages: 0, total: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchEquipmentImportRequestsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", created_after: "2099-01-01T00:00:00.000Z" }),
      ctx,
    );

    expect(result.data.import_requests).toEqual([]);
  });
});
