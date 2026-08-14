import { describe, expect, it } from "vitest";
import { createGetEquipmentBenchPositionTool } from "../../../src/domain/equipments/get-equipment-bench-position.js";
import { createFakeApiCoreClient, ctx } from "./test-helpers.js";

describe("US-021 — get_equipment_bench_position", () => {
  it("retorna as posições de bancada normalizadas", async () => {
    const fake = createFakeApiCoreClient([{ id: "1", dia: 20260101, hora: "10:00:00", d: { x: 1 } }]);
    const { definition } = createGetEquipmentBenchPositionTool({ apiCoreClient: fake.client });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", module: "M1" }),
      ctx,
    );

    expect(result.data.positions).toEqual([{ id: "1", dia: 20260101, hora: "10:00:00", d: { x: 1 } }]);
    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/v0.2/equipamentos/integracao/posicaobancada/M1",
        query: {},
      }),
    );
  });

  it("não envia sistema/central como query param (endpoint real não aceita)", async () => {
    const fake = createFakeApiCoreClient([]);
    const { definition } = createGetEquipmentBenchPositionTool({ apiCoreClient: fake.client });
    await definition.handler(definition.inputSchema.parse({ central: "central-1", module: "M1" }), ctx);
    expect(fake.get).toHaveBeenCalledWith(expect.objectContaining({ query: {} }));
  });

  it("exige module (parâmetro de path obrigatório)", () => {
    const { definition } = createGetEquipmentBenchPositionTool({ apiCoreClient: createFakeApiCoreClient([]).client });
    expect(() => definition.inputSchema.parse({ central: "central-1" })).toThrow();
  });

  it("codifica o módulo no path (caracteres especiais)", async () => {
    const fake = createFakeApiCoreClient([]);
    const { definition } = createGetEquipmentBenchPositionTool({ apiCoreClient: fake.client });
    await definition.handler(definition.inputSchema.parse({ central: "central-1", module: "M/1 2" }), ctx);
    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/v0.2/equipamentos/integracao/posicaobancada/M%2F1%202" }),
    );
  });
});
