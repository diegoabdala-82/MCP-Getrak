import { describe, expect, it } from "vitest";
import { createSearchSubclientsTool } from "../../../src/domain/accounts/search-subclients.js";
import { createFakeApiCoreClient, ctx } from "./test-helpers.js";

describe("US-031 — search_subclients", () => {
  it("retorna subclientes normalizados dentro da central autorizada", async () => {
    const fake = createFakeApiCoreClient([
      { id: 1, cliente: 1234, descricao: "Subcliente 1", ativo: "Y" },
    ]);
    const { definition } = createSearchSubclientsTool({ apiCoreClient: fake.client });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", client_id: 1234 }),
      ctx,
    );

    expect(result.data.subclients).toEqual([
      { id: 1, cliente: 1234, descricao: "Subcliente 1", ativo: "Y" },
    ]);
    expect(result.endpoints).toEqual(["GET /v0.2/subclientes/integracao"]);
  });

  it("envia central como sistema (obrigatório neste endpoint), e traduz os demais filtros", async () => {
    const fake = createFakeApiCoreClient([]);
    const { definition } = createSearchSubclientsTool({ apiCoreClient: fake.client });

    const input = definition.inputSchema.parse({
      central: "central-1",
      id: 10,
      vehicle_id: 20,
      client_id: 1234,
      cnpj: "42577753000104",
      name: "Subcliente",
      page: 2,
      page_size: 10,
    });
    await definition.handler(input, ctx);

    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/v0.2/subclientes/integracao",
        query: {
          sistema: "central-1",
          id: 10,
          id_veiculo: 20,
          cliente: 1234,
          cnpj: "42577753000104",
          nome: "Subcliente",
          limit: 10,
          offset: 10,
        },
        central: "central-1",
        authScheme: "oauth2ClientCredentials",
      }),
    );
  });

  it("retorna lista vazia normalizada (não erro) quando nenhum subcliente corresponde", async () => {
    const fake = createFakeApiCoreClient([]);
    const { definition } = createSearchSubclientsTool({ apiCoreClient: fake.client });
    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);
    expect(result.data.subclients).toEqual([]);
  });

  it("id_veiculo é integer neste endpoint (diferente de search_clients, onde é string)", () => {
    const { definition } = createSearchSubclientsTool({ apiCoreClient: createFakeApiCoreClient([]).client });
    expect(() => definition.inputSchema.parse({ central: "central-1", vehicle_id: "not-a-number" })).toThrow();
  });
});
