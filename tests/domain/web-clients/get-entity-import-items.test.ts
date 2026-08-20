import { describe, expect, it } from "vitest";
import { createGetEntityImportItemsTool } from "../../../src/domain/web-clients/get-entity-import-items.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

describe("US-066 — get_entity_import_items", () => {
  it("retorna os itens normalizados e paginados de uma requisição de importação existente", async () => {
    const fake = createFakeApiCoreClient({ data: [{ id: 37, file_line: 2, name: "Luiz Fabio", status: "failure" }], page: 1, pages: 1, total: 1 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetEntityImportItemsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", id: 55, status: "failure" }),
      ctx,
    );

    expect(result.data.items).toEqual([{ id: 37, file_line: 2, name: "Luiz Fabio", status: "failure" }]);
    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/v1.0/clients/import-entity/55/items", notFoundCode: "ENTITY_IMPORT_NOT_FOUND" }),
    );
  });

  it("retorna lista vazia normalizada quando nenhum item corresponde ao filtro", async () => {
    const fake = createFakeApiCoreClient({ data: [], page: 1, pages: 0, total: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetEntityImportItemsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", id: 55, search: "totalmente-inventado" }),
      ctx,
    );

    expect(result.data.items).toEqual([]);
  });
});
