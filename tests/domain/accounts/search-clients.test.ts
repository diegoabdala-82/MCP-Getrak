import { describe, expect, it } from "vitest";
import { createSearchClientsTool } from "../../../src/domain/accounts/search-clients.js";
import { createFakeApiCoreClient, ctx } from "./test-helpers.js";

describe("US-030 — search_clients", () => {
  it("retorna clientes normalizados dentro da central autorizada", async () => {
    const fake = createFakeApiCoreClient([
      { id: 1, descricao: "Cliente 1", cnpj: "42577753000104", ativo: "Y" },
    ]);
    const { definition } = createSearchClientsTool({ apiCoreClient: fake.client });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", name: "Cliente" }),
      ctx,
    );

    expect(result.data.clients).toEqual([
      { id: 1, descricao: "Cliente 1", cnpj: "42577753000104", ativo: "Y" },
    ]);
    expect(result.endpoints).toEqual(["GET /v0.2/clientes/integracao"]);
  });

  it("envia central como sistema, e traduz os demais filtros para os query params reais", async () => {
    const fake = createFakeApiCoreClient([]);
    const { definition } = createSearchClientsTool({ apiCoreClient: fake.client });

    const input = definition.inputSchema.parse({
      central: "central-1",
      id: 42,
      name: "Cliente",
      cnpj: "42577753000104",
      vehicle_id: "V1",
      sort: "id ASC",
      page: 2,
      page_size: 10,
    });
    await definition.handler(input, ctx);

    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/v0.2/clientes/integracao",
        query: {
          sistema: "central-1",
          id: 42,
          name: "Cliente",
          cnpj: "42577753000104",
          id_veiculo: "V1",
          ordem: "id ASC",
          limit: 10,
          offset: 10,
        },
        central: "central-1",
        authScheme: "oauth2ClientCredentials",
      }),
    );
  });

  it("retorna lista vazia normalizada (não erro) quando nenhum cliente corresponde", async () => {
    const fake = createFakeApiCoreClient([]);
    const { definition } = createSearchClientsTool({ apiCoreClient: fake.client });
    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);
    expect(result.data.clients).toEqual([]);
  });

  it("exige central", () => {
    const { definition } = createSearchClientsTool({ apiCoreClient: createFakeApiCoreClient([]).client });
    expect(() => definition.inputSchema.parse({})).toThrow();
  });
});
