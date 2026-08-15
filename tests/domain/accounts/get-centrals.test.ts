import { describe, expect, it } from "vitest";
import { createGetCentralsTool } from "../../../src/domain/accounts/get-centrals.js";
import { createFakeApiCoreClient, ctx } from "./test-helpers.js";

describe("US-034 — get_centrals", () => {
  it("retorna centrais normalizadas", async () => {
    const fake = createFakeApiCoreClient([
      { id_central: "123", sistema: "Getrak LTDA", site_sis: "getrak" },
    ]);
    const { definition } = createGetCentralsTool({ apiCoreClient: fake.client });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);

    expect(result.data.centrals).toEqual([{ id_central: "123", sistema: "Getrak LTDA", site_sis: "getrak" }]);
    expect(result.endpoints).toEqual(["GET /v0.2/centrais/integracao"]);
  });

  it("não envia nenhum query param (endpoint real não aceita nenhum)", async () => {
    const fake = createFakeApiCoreClient([]);
    const { definition } = createGetCentralsTool({ apiCoreClient: fake.client });
    await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);
    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/v0.2/centrais/integracao", query: {} }),
    );
  });

  it("aplica paginação client-side (endpoint não pagina nativamente)", async () => {
    const fake = createFakeApiCoreClient(
      Array.from({ length: 5 }, (_, i) => ({ id_central: String(i), sistema: `Central ${i}` })),
    );
    const { definition } = createGetCentralsTool({ apiCoreClient: fake.client });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", page: 1, page_size: 2 }),
      ctx,
    );

    expect(result.data.centrals).toEqual([
      { id_central: "0", sistema: "Central 0" },
      { id_central: "1", sistema: "Central 1" },
    ]);
    expect(result.data.pagination).toMatchObject({ page: 1, page_size: 2, total_items: 5, has_more: true });
  });

  it("retorna lista vazia normalizada (não erro) quando não há centrais", async () => {
    const fake = createFakeApiCoreClient([]);
    const { definition } = createGetCentralsTool({ apiCoreClient: fake.client });
    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);
    expect(result.data.centrals).toEqual([]);
  });

  it("exige central", () => {
    const { definition } = createGetCentralsTool({ apiCoreClient: createFakeApiCoreClient([]).client });
    expect(() => definition.inputSchema.parse({})).toThrow();
  });
});
