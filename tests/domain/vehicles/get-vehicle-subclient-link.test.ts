import { describe, expect, it } from "vitest";
import { createGetVehicleSubclientLinkTool } from "../../../src/domain/vehicles/get-vehicle-subclient-link.js";
import { createFakeApiCoreClient } from "./test-helpers.js";

const ctx = { requestId: "req-1", central: "central-1", environment: "homologation" as const, consumer: { consumer_id: "c" } };

describe("US-011 — get_vehicle_subclient_link", () => {
  it("retorna o vínculo com subcliente normalizado", async () => {
    const fake = createFakeApiCoreClient([{ placa: "ABC1234", id_veiculo: 1, modulo: "M1", subcliente: 9 }]);
    const { definition } = createGetVehicleSubclientLinkTool({ apiCoreClient: fake.client });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", vehicle_id: "1" }),
      ctx,
    );

    expect(result.data.links).toEqual([{ placa: "ABC1234", id_veiculo: 1, modulo: "M1", subcliente: 9 }]);
    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/v0.2/veiculos/subclientes/integracao",
        query: expect.objectContaining({ id_veiculo: "1" }),
      }),
    );
  });

  it("retorna lista vazia normalizada quando não há vínculo", async () => {
    const fake = createFakeApiCoreClient([]);
    const { definition } = createGetVehicleSubclientLinkTool({ apiCoreClient: fake.client });
    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);
    expect(result.data.links).toEqual([]);
  });

  it("envia central como sistema (confirmado no openapi.json e por consistência com endpoints irmãos)", async () => {
    const fake = createFakeApiCoreClient([]);
    const { definition } = createGetVehicleSubclientLinkTool({ apiCoreClient: fake.client });
    await definition.handler(definition.inputSchema.parse({ central: "central-42" }), ctx);
    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({ query: expect.objectContaining({ sistema: "central-42" }) }),
    );
  });
});
