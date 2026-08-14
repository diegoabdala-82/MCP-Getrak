import { describe, expect, it } from "vitest";
import { createGetSuspendedVehiclesTool } from "../../../src/domain/vehicles/get-suspended-vehicles.js";
import { createFakeApiCoreClient } from "./test-helpers.js";

const ctx = { requestId: "req-1", central: "central-1", environment: "homologation" as const, consumer: { consumer_id: "c" } };

describe("US-012 — get_suspended_vehicles", () => {
  it("retorna a lista de veículos suspensos normalizada e paginada", async () => {
    const fake = createFakeApiCoreClient([{ id_veiculo: 1, placa: "ABC1234", ativo: "S" }]);
    const { definition } = createGetSuspendedVehiclesTool({ apiCoreClient: fake.client });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);

    expect(result.data.vehicles).toEqual([{ id_veiculo: 1, placa: "ABC1234", ativo: "S" }]);
    expect(result.data.pagination).toEqual({ page: 1, page_size: 50, total_items: null, has_more: false });
    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/v0.2/veiculos/integracao/veiculoSuspenderIntegracao" }),
    );
  });

  it("trata defensivamente a resposta de objeto único declarada no openapi.json", async () => {
    const fake = createFakeApiCoreClient({ id_veiculo: 1, placa: "ABC1234" });
    const { definition } = createGetSuspendedVehiclesTool({ apiCoreClient: fake.client });
    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);
    expect(result.data.vehicles).toEqual([{ id_veiculo: 1, placa: "ABC1234" }]);
  });

  it("não expõe ação de suspender/reativar — somente consulta (fora de escopo, alto risco)", () => {
    // Nenhum campo de escrita existe no schema de entrada da tool.
    const { definition } = createGetSuspendedVehiclesTool({ apiCoreClient: createFakeApiCoreClient([]).client });
    const shape = definition.inputSchema.parse({ central: "central-1" });
    expect(Object.keys(shape)).not.toContain("action");
  });

  it("envia central como sistema (confirmado no openapi.json e por consistência com endpoints irmãos)", async () => {
    const fake = createFakeApiCoreClient([]);
    const { definition } = createGetSuspendedVehiclesTool({ apiCoreClient: fake.client });
    await definition.handler(definition.inputSchema.parse({ central: "central-42" }), ctx);
    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({ query: expect.objectContaining({ sistema: "central-42" }) }),
    );
  });
});
