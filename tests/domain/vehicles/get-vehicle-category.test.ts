import { describe, expect, it } from "vitest";
import {
  createGetVehicleCategoryTool,
  getVehicleCategoryInputSchema,
} from "../../../src/domain/vehicles/get-vehicle-category.js";
import { createFakeApiCoreClient } from "./test-helpers.js";

const ctx = { requestId: "req-1", central: "central-1", environment: "homologation" as const, consumer: { consumer_id: "c" } };

describe("US-009 — get_vehicle_category", () => {
  it("lista as categorias normalizadas quando o upstream retorna um array", async () => {
    const fake = createFakeApiCoreClient([
      { id: 1, descricao: "Automóvel" },
      { id: 2, descricao: "Caminhão" },
    ]);
    const { definition } = createGetVehicleCategoryTool({ apiCoreClient: fake.client });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);

    expect(result.data.categories).toEqual([
      { id: 1, descricao: "Automóvel" },
      { id: 2, descricao: "Caminhão" },
    ]);
    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/v0.2/veiculos/categorias", query: {} }),
    );
  });

  it("trata defensivamente uma resposta de objeto único (schema declarado no openapi.json)", async () => {
    const fake = createFakeApiCoreClient({ id: 1, descricao: "Automóvel" });
    const { definition } = createGetVehicleCategoryTool({ apiCoreClient: fake.client });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);
    expect(result.data.categories).toEqual([{ id: 1, descricao: "Automóvel" }]);
  });

  it("não expõe filtro de veículo ou categoria (endpoint real não aceita nenhum parâmetro)", () => {
    expect(Object.keys(getVehicleCategoryInputSchema.shape)).toEqual(["central"]);
  });
});
