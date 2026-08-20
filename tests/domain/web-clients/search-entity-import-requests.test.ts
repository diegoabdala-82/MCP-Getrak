import { describe, expect, it } from "vitest";
import { createSearchEntityImportRequestsTool } from "../../../src/domain/web-clients/search-entity-import-requests.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

describe("US-064 — search_entity_import_requests", () => {
  it("retorna requisições de importação normalizadas e paginadas, com per_page (não perPage)", async () => {
    const fake = createFakeApiCoreClient({ data: [{ id: 55, entity: "client", status: "done_with_errors" }], page: 1, pages: 1, total: 1 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchEntityImportRequestsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", entity: "client", page: 1, page_size: 5 }),
      ctx,
    );

    expect(result.data.import_requests).toEqual([{ id: 55, entity: "client", status: "done_with_errors" }]);
    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({ query: expect.objectContaining({ "filters[entity]": "client", page: 1, per_page: 5 }) }),
    );
  });

  it("retorna lista vazia normalizada quando nenhuma requisição de importação corresponde ao filtro", async () => {
    const fake = createFakeApiCoreClient({ data: [], page: 1, pages: 0, total: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchEntityImportRequestsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", user_id: 999999999 }),
      ctx,
    );

    expect(result.data.import_requests).toEqual([]);
  });
});
