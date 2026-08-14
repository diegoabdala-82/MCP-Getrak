import { describe, expect, it } from "vitest";
import { createGetVehicleClientLinkTool } from "../../../src/domain/vehicles/get-vehicle-client-link.js";
import { createFakeApiCoreClient } from "./test-helpers.js";

const ctx = { requestId: "req-1", central: "central-1", environment: "homologation" as const, consumer: { consumer_id: "c" } };

describe("US-010 — get_vehicle_client_link", () => {
  it("retorna o vínculo com cliente normalizado", async () => {
    const fake = createFakeApiCoreClient([
      { placa: "ABC1234", id_veiculo: "1", cliente: 7, modulo: undefined, nome: "Cliente X", cpfCnpj: "00000000000" },
    ]);
    const { definition } = createGetVehicleClientLinkTool({ apiCoreClient: fake.client });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", vehicle_id: "1" }),
      ctx,
    );

    expect(result.data.links).toEqual([
      { placa: "ABC1234", id_veiculo: "1", cliente: 7, modulo: null, nome: "Cliente X", cpfCnpj: "00000000000" },
    ]);
    expect(result.endpoints).toEqual(["GET /v0.2/veiculos/clientes/integracao"]);
  });

  it("usa o endpoint v0.2 vigente, nunca o v0.1 depreciado (ED-03: Closed)", async () => {
    const fake = createFakeApiCoreClient([]);
    const { definition } = createGetVehicleClientLinkTool({ apiCoreClient: fake.client });
    await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);
    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/v0.2/veiculos/clientes/integracao" }),
    );
  });

  it("traduz a paginação para limit/offset (nome real deste endpoint, diferente de 'limite')", async () => {
    const fake = createFakeApiCoreClient([]);
    const { definition } = createGetVehicleClientLinkTool({ apiCoreClient: fake.client });
    await definition.handler(
      definition.inputSchema.parse({ central: "central-1", page: 3, page_size: 20 }),
      ctx,
    );
    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({ query: expect.objectContaining({ limit: 20, offset: 40 }) }),
    );
  });

  it("envia central como sistema (confirmado no openapi.json e por consistência com endpoints irmãos)", async () => {
    const fake = createFakeApiCoreClient([]);
    const { definition } = createGetVehicleClientLinkTool({ apiCoreClient: fake.client });
    await definition.handler(definition.inputSchema.parse({ central: "central-42" }), ctx);
    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({ query: expect.objectContaining({ sistema: "central-42" }) }),
    );
  });
});
