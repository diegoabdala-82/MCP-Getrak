import { describe, expect, it } from "vitest";
import { createGetVehicleLastRegistersTool } from "../../../src/domain/locations/get-vehicle-last-registers.js";
import {
  createFakeDelegatedApiCoreClient,
  createFakeDelegatedTokenManager,
  createRejectingApiCoreClient,
  ctx,
} from "./test-helpers.js";

const RAW_RECORD = {
  vehicleId: 6386345,
  date: "2026-08-07T15:47:59.000-03:00",
  classification: 2,
  data: {
    sequencia: "",
    timestamp: "2026-08-07T15:47:59.253-03:00",
    datagps: "2026-08-07T15:47:59.000-03:00",
    data: "2026-08-07T18:47:59.000Z",
    lat: 0,
    lng: 0,
    velocidade: 0,
    saidas: "0000",
    entradas: "10000",
    direcao: 261,
    gpsfix: 2,
    alimentacao: 1,
    ignicao: 1,
    eventos: [],
    ibutton: "00000000000000",
    can_v: null,
    panico: 0,
    tensao_bateria: 13,
    nivel_bateria_reserva: null,
    modulo: "CE236598741",
    rpm: 11,
    horimetro: "06:02:57",
    temperatura: 41,
    volts: "130",
    hodometro: 0,
    tipo: "Normal",
  },
};

const RAW_VEHICLE = {
  id: 6386345,
  plate: "JEN4321",
  nickname: "Jennifer cont",
  vin: "9BFZZZ54ZLB066039",
  client: {
    id: 1040356,
    name: "Jennifer",
    document: "43.130.771/0001-06",
    email: "jennifer.brito@getrak.com.br",
    businessPhone: "(38)9915-82942",
  },
};

describe("US-106 — get_vehicle_last_registers", () => {
  it("retorna registros normalizados, traduz telemetria PT->EN e expõe o campo de data canônico (datagps -> gps_at)", async () => {
    const fake = createFakeDelegatedApiCoreClient({
      data: [RAW_RECORD],
      page: 1,
      totalItems: 1,
      itemsPerPage: 25,
      totalPages: 1,
      vehicle: RAW_VEHICLE,
    });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetVehicleLastRegistersTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", vehicle_id: 6386345, date: "2026-08-07" }),
      ctx,
    );

    expect(result.data.registers).toHaveLength(1);
    const record = result.data.registers[0];
    expect(record.vehicle_id).toBe(6386345);
    expect(record.gps_at).toBe("2026-08-07T15:47:59.000-03:00");
    expect(record.raw_timestamps).toEqual({
      record_date: "2026-08-07T15:47:59.000-03:00",
      received_at: "2026-08-07T15:47:59.253-03:00",
      gps_at: "2026-08-07T15:47:59.000-03:00",
      gps_at_utc: "2026-08-07T18:47:59.000Z",
    });
    expect(record.telemetry).toMatchObject({
      speed: 0,
      outputs: "0000",
      inputs: "10000",
      direction: 261,
      gps_fix: 2,
      power_supply: 1,
      ignition: 1,
      events: [],
      panic: 0,
      battery_voltage: 13,
      module: "CE236598741",
      hourmeter: "06:02:57",
      temperature: 41,
      odometer: 0,
      type: "Normal",
    });
    // Campos ambíguos/já em inglês mantidos como vieram, sem tradução inventada.
    expect((record.telemetry as Record<string, unknown>).can_v).toBe(null);
    expect((record.telemetry as Record<string, unknown>).ibutton).toBe("00000000000000");
    expect((record.telemetry as Record<string, unknown>).rpm).toBe(11);
    // As 4 datas brutas nunca aparecem duplicadas dentro de `telemetry`.
    expect((record.telemetry as Record<string, unknown>).timestamp).toBeUndefined();
    expect((record.telemetry as Record<string, unknown>).datagps).toBeUndefined();

    expect(result.data.vehicle).toMatchObject({
      id: 6386345,
      plate: "JEN4321",
      client: { document: "43.130.771/0001-06", email: "jennifer.brito@getrak.com.br" },
    });
  });

  it("traduz a paginação de origem (page/itemsPerPage/totalItems/totalPages) para o padrão do MCP", async () => {
    const fake = createFakeDelegatedApiCoreClient({
      data: [RAW_RECORD],
      page: 2,
      totalItems: 11,
      itemsPerPage: 5,
      totalPages: 3,
      vehicle: RAW_VEHICLE,
    });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetVehicleLastRegistersTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", vehicle_id: 6386345, date: "2026-08-07", page: 2, page_size: 5 }),
      ctx,
    );

    expect(result.data.pagination).toEqual({ page: 2, page_size: 5, total_items: 11, has_more: true });
    expect(fake.get).toHaveBeenCalledWith(expect.objectContaining({ query: expect.objectContaining({ page: 2, per_page: 5 }) }));
  });

  it("traduz include[] de snake_case (contrato público) para os valores reais em camelCase exigidos pela API", async () => {
    const fake = createFakeDelegatedApiCoreClient({ data: [], page: 1, totalItems: 0, itemsPerPage: 25, totalPages: 0, vehicle: null });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetVehicleLastRegistersTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    await definition.handler(
      definition.inputSchema.parse({
        central: "central-1",
        vehicle_id: 6386345,
        date: "2026-08-07",
        include: ["reference_points", "additional_telemetries", "driver"],
      }),
      ctx,
    );

    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/v1/localization/vehicles/6386345/last-registers",
        query: expect.objectContaining({ "include[]": ["referencePoints", "additionalTelemetries", "driver"] }),
      }),
    );
  });

  it("traduz ignition_on para filters[ignicao][eq] com valor numérico 1/0 (único filtro confirmado funcionando)", async () => {
    const fake = createFakeDelegatedApiCoreClient({ data: [], page: 1, totalItems: 0, itemsPerPage: 25, totalPages: 0, vehicle: null });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetVehicleLastRegistersTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    await definition.handler(
      definition.inputSchema.parse({ central: "central-1", vehicle_id: 6386345, date: "2026-08-07", ignition_on: true }),
      ctx,
    );

    expect(fake.get).toHaveBeenCalledWith(expect.objectContaining({ query: expect.objectContaining({ "filters[ignicao][eq]": 1 }) }));
  });

  it("retorna lista vazia normalizada quando o veículo não tem registros na data informada", async () => {
    const fake = createFakeDelegatedApiCoreClient({ data: [], page: 1, totalItems: 0, itemsPerPage: 25, totalPages: 0, vehicle: RAW_VEHICLE });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetVehicleLastRegistersTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", vehicle_id: 6386345, date: "2099-01-01" }),
      ctx,
    );

    expect(result.data.registers).toEqual([]);
  });

  it("rejeita datas fora do formato yyyy-MM-dd antes de qualquer chamada à API Core", () => {
    const { definition } = createGetVehicleLastRegistersTool({
      apiCoreClient: createFakeDelegatedApiCoreClient({}).client,
      delegatedTokenManager: createFakeDelegatedTokenManager().manager,
    });

    expect(() =>
      definition.inputSchema.parse({ central: "central-1", vehicle_id: 6386345, date: "07/08/2026" }),
    ).toThrow();
  });
});

describe("US-106 — get_vehicle_last_registers — não encontrado", () => {
  it("normaliza veículo inexistente/não autorizado para VEHICLE_NOT_FOUND", async () => {
    const { McpToolError } = await import("../../../src/domain/errors.js");
    const fake = createRejectingApiCoreClient(
      new McpToolError({ code: "VEHICLE_NOT_FOUND", message: "Vehicle was not found.", retryable: false }),
    );
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetVehicleLastRegistersTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    await expect(
      definition.handler(
        definition.inputSchema.parse({ central: "central-1", vehicle_id: 999999999, date: "2026-08-07" }),
        ctx,
      ),
    ).rejects.toMatchObject({ code: "VEHICLE_NOT_FOUND" });
  });
});
