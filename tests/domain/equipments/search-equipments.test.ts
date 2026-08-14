import { describe, expect, it } from "vitest";
import { createSearchEquipmentsTool } from "../../../src/domain/equipments/search-equipments.js";
import { createFakeApiCoreClient, ctx } from "./test-helpers.js";

describe("US-020 — search_equipments", () => {
  it("retorna equipamentos normalizados dentro da central autorizada", async () => {
    const fake = createFakeApiCoreClient([
      { equipamento: "EQP1", modulo: "M1", sistema: "central-1", chip: { iccid: "123" } },
    ]);
    const { definition } = createSearchEquipmentsTool({ apiCoreClient: fake.client });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", module: "M1" }),
      ctx,
    );

    expect(result.data.equipments).toEqual([
      { equipamento: "EQP1", modulo: "M1", sistema: "central-1", chip: { iccid: "123" } },
    ]);
    expect(result.endpoints).toEqual(["GET /v0.2/equipamentos/integracao"]);
  });

  it("envia central como sistema, e traduz os demais filtros para os query params reais", async () => {
    const fake = createFakeApiCoreClient([]);
    const { definition } = createSearchEquipmentsTool({ apiCoreClient: fake.client });

    const input = definition.inputSchema.parse({
      central: "central-1",
      module: "M1",
      linked: "Y",
      sort: "equipamento",
      page: 2,
      page_size: 10,
    });
    await definition.handler(input, ctx);

    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/v0.2/equipamentos/integracao",
        query: {
          sistema: "central-1",
          modulo: "M1",
          ativo: "Y",
          ordem: "equipamento",
          limit: 10,
          offset: 10,
        },
        central: "central-1",
        authScheme: "oauth2ClientCredentials",
      }),
    );
  });

  it("retorna lista vazia normalizada (não erro) quando nenhum equipamento corresponde", async () => {
    const fake = createFakeApiCoreClient([]);
    const { definition } = createSearchEquipmentsTool({ apiCoreClient: fake.client });
    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);
    expect(result.data.equipments).toEqual([]);
  });

  it("rejeita linked fora do enum documentado (Y/N)", () => {
    const { definition } = createSearchEquipmentsTool({ apiCoreClient: createFakeApiCoreClient([]).client });
    expect(() => definition.inputSchema.parse({ central: "central-1", linked: "X" })).toThrow();
  });
});
