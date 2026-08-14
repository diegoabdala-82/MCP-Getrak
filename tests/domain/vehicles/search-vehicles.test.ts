import { describe, expect, it } from "vitest";
import { createSearchVehiclesTool, searchVehiclesInputSchema } from "../../../src/domain/vehicles/search-vehicles.js";
import { createFakeApiCoreClient } from "./test-helpers.js";

const ctx = { requestId: "req-1", central: "central-1", environment: "homologation" as const, consumer: { consumer_id: "c" } };

describe("US-008 — search_vehicles", () => {
  it("retorna veículos normalizados dentro da central autorizada", async () => {
    const fake = createFakeApiCoreClient([
      { id: 1, placa: "ABC1234", modelo: undefined, categoria: { id: 2, descricao: "Automóvel" } },
    ]);
    const { definition } = createSearchVehiclesTool({ apiCoreClient: fake.client });

    const input = definition.inputSchema.parse({ central: "central-1", plate: "ABC1234" });
    const result = await definition.handler(input, ctx);

    expect(result.data.vehicles).toEqual([
      { id: 1, placa: "ABC1234", modelo: null, categoria: { id: 2, descricao: "Automóvel" } },
    ]);
    expect(result.endpoints).toEqual(["GET /v0.2/veiculos/integracao"]);
  });

  it("retorna lista vazia normalizada (não erro) quando nenhum veículo corresponde", async () => {
    const fake = createFakeApiCoreClient([]);
    const { definition } = createSearchVehiclesTool({ apiCoreClient: fake.client });

    const input = definition.inputSchema.parse({ central: "central-1", plate: "ZZZ0000" });
    const result = await definition.handler(input, ctx);

    expect(result.data.vehicles).toEqual([]);
  });

  it("traduz os filtros da tool para os query params reais do endpoint (openapi.json)", async () => {
    const fake = createFakeApiCoreClient([]);
    const { definition } = createSearchVehiclesTool({ apiCoreClient: fake.client });

    const input = definition.inputSchema.parse({
      central: "central-1",
      id: "42",
      plate: "ABC1234",
      active_status: "Y",
      client_cnpj: "00.000.000/0001-00",
      client_id: "7",
      subclient_id: "9",
      sort: "id_veiculo",
      page: 2,
      page_size: 10,
    });
    await definition.handler(input, ctx);

    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/v0.2/veiculos/integracao",
        query: {
          sistema: "central-1",
          id: "42",
          placa: "ABC1234",
          ativo: "Y",
          cnpjCliente: "00.000.000/0001-00",
          cliente: "7",
          subcliente: "9",
          ordem: "id_veiculo",
          limite: 10,
          offset: 10,
        },
        central: "central-1",
        authScheme: "oauth2ClientCredentials",
      }),
    );
  });

  it("aplica o default de 50 itens e o máximo de 100 (US-004) via limite/offset", async () => {
    const fake = createFakeApiCoreClient([]);
    const { definition } = createSearchVehiclesTool({ apiCoreClient: fake.client });

    await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);
    expect(fake.get).toHaveBeenCalledWith(expect.objectContaining({ query: expect.objectContaining({ limite: 50, offset: 0 }) }));

    fake.get.mockClear();
    await definition.handler(definition.inputSchema.parse({ central: "central-1", page_size: 500 }), ctx);
    expect(fake.get).toHaveBeenCalledWith(expect.objectContaining({ query: expect.objectContaining({ limite: 100 }) }));
  });

  it("rejeita active_status fora do enum documentado (Y/D/I/S)", () => {
    expect(() => searchVehiclesInputSchema.parse({ central: "central-1", active_status: "X" })).toThrow();
  });

  it("nunca declara environment, credenciais técnicas, tokens ou URLs como parâmetro de entrada", () => {
    // client_id aqui é o filtro de negócio "cliente" (customer id) do endpoint,
    // não a credencial OAuth — client_secret/token/api_url é que são proibidos.
    const shape = searchVehiclesInputSchema.shape;
    for (const forbidden of ["environment", "client_secret", "token", "access_token", "api_url"]) {
      expect(Object.prototype.hasOwnProperty.call(shape, forbidden)).toBe(false);
    }
  });
});
