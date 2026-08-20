import { describe, expect, it } from "vitest";
import { createGetEntityImportDetailsTool } from "../../../src/domain/web-clients/get-entity-import-details.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

describe("US-065 — get_entity_import_details", () => {
  it("retorna a requisição de importação normalizada para um id existente", async () => {
    const fake = createFakeApiCoreClient({ id: 55, entity: "client", status: "done_with_errors" });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetEntityImportDetailsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1", id: 55 }), ctx);

    expect(result.data.import_request).toEqual({ id: 55, entity: "client", status: "done_with_errors" });
    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/v1.0/clients/import-entity/55", notFoundCode: "ENTITY_IMPORT_NOT_FOUND" }),
    );
  });
});
