import { describe, expect, it } from "vitest";
import {
  computeMad,
  computeMedian,
  createAnalyzeVehicleBehaviorTool,
  detectMetricAnomalies,
  summarizeMetricPoints,
  type MetricPoint,
} from "../../../src/domain/locations/analyze-vehicle-behavior.js";
import {
  createFakeDelegatedApiCoreClient,
  createFakeDelegatedTokenManager,
  createRejectingApiCoreClient,
  createSequencedDelegatedApiCoreClient,
  ctx,
} from "./test-helpers.js";

function rawRecord(params: {
  timestamp: string;
  speed: number;
  ignition: number;
  battery_voltage?: number;
  volts?: number;
  bat_percent?: number;
  voltsbkp?: number;
  type?: string;
}): Record<string, unknown> {
  return {
    vehicleId: 6386345,
    date: params.timestamp,
    classification: 2,
    data: {
      timestamp: params.timestamp,
      datagps: params.timestamp,
      data: params.timestamp,
      velocidade: params.speed,
      ignicao: params.ignition,
      tensao_bateria: params.battery_voltage,
      volts: params.volts,
      bat_percent: params.bat_percent,
      voltsbkp: params.voltsbkp,
      tipo: params.type,
    },
  };
}

describe("US-107 — mediana e MAD (baseline robusto, isolado da tool)", () => {
  it("computeMedian: número ímpar de valores retorna o valor central", () => {
    expect(computeMedian([5, 1, 3])).toBe(3);
  });

  it("computeMedian: número par de valores retorna a média dos dois centrais", () => {
    expect(computeMedian([1, 3, 5, 7])).toBe(4);
  });

  it("computeMad: mediana dos desvios absolutos em relação à mediana", () => {
    // valores [1,1,1,1,10] -> mediana 1, desvios [0,0,0,0,9] -> MAD 0
    expect(computeMad([1, 1, 1, 1, 10], 1)).toBe(0);
  });
});

describe("US-107 — detectMetricAnomalies (multiplicador de MAD + limiar mínimo absoluto)", () => {
  it("não avalia anomalias com amostra insuficiente (< 3 pontos)", () => {
    const points: MetricPoint[] = [
      { timestamp: "t1", value: 0 },
      { timestamp: "t2", value: 999 },
    ];
    expect(detectMetricAnomalies("speed", points, { madMultiplier: 3, absoluteMinimumThreshold: 20, unit: "km/h" })).toEqual([]);
  });

  it("reporta um ponto como anomalia só quando excede o múltiplo de MAD E o limiar mínimo absoluto", () => {
    const points: MetricPoint[] = [
      { timestamp: "t1", value: 0 },
      { timestamp: "t2", value: 5 },
      { timestamp: "t3", value: 0 },
      { timestamp: "t4", value: 0 },
      { timestamp: "t5", value: 80 },
      { timestamp: "t6", value: 10 },
    ];
    const anomalies = detectMetricAnomalies("speed", points, { madMultiplier: 3, absoluteMinimumThreshold: 20, unit: "km/h" });

    // mediana=2.5, MAD=2.5 -> limiar múltiplo=7.5; ponto t6 (10) tem desvio 7.5 (< 20 absoluto) -> não reportado.
    // ponto t5 (80) tem desvio 77.5 (>= 7.5 e >= 20) -> reportado.
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]).toMatchObject({ timestamp: "t5", metric: "speed", observed_value: 80, baseline_value: 2.5 });
    expect(anomalies[0].deviation_magnitude).toBeCloseTo(77.5 / 2.5);
  });

  it("quando MAD=0 (métrica quase constante), usa só o limiar mínimo absoluto como critério", () => {
    const points: MetricPoint[] = [
      { timestamp: "t1", value: 13 },
      { timestamp: "t2", value: 13 },
      { timestamp: "t3", value: 13 },
      { timestamp: "t4", value: 13 },
      { timestamp: "t5", value: 13 },
      { timestamp: "t6", value: 20 },
    ];
    const anomalies = detectMetricAnomalies("battery_voltage", points, { madMultiplier: 3, absoluteMinimumThreshold: 1, unit: "V" });

    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]).toMatchObject({ timestamp: "t6", observed_value: 20, baseline_value: 13, deviation_magnitude: 7 });
  });
});

describe("US-107 — summarizeMetricPoints", () => {
  it("retorna null para lista vazia (métrica ausente do dia)", () => {
    expect(summarizeMetricPoints("speed", [])).toBeNull();
  });

  it("calcula min/max/avg/count", () => {
    const points: MetricPoint[] = [
      { timestamp: "t1", value: 0 },
      { timestamp: "t2", value: 10 },
      { timestamp: "t3", value: 20 },
    ];
    expect(summarizeMetricPoints("speed", points)).toEqual({ metric: "speed", min: 0, max: 20, avg: 10, count: 3 });
  });
});

describe("US-107 — analyze_vehicle_behavior — handler", () => {
  const TIMESTAMPS = [
    "2026-08-07T08:00:00.000-03:00",
    "2026-08-07T09:00:00.000-03:00",
    "2026-08-07T10:00:00.000-03:00",
    "2026-08-07T11:00:00.000-03:00",
    "2026-08-07T12:00:00.000-03:00",
    "2026-08-07T13:00:00.000-03:00",
  ];

  function buildDayRecords(): Record<string, unknown>[] {
    const speeds = [0, 5, 0, 0, 80, 10];
    const ignitions = [1, 1, 0, 0, 1, 1];
    const types = ["Normal", "Normal", "Parada", "Parada", "Movimento", "Normal"];
    return TIMESTAMPS.map((timestamp, i) =>
      rawRecord({
        timestamp,
        speed: speeds[i],
        ignition: ignitions[i],
        battery_voltage: 13,
        bat_percent: 80,
        voltsbkp: 12,
        type: types[i],
      }),
    );
  }

  it("caminho feliz: agrega summary, anomalies, alerts e ignition_segments a partir dos registros do dia", async () => {
    const fake = createFakeDelegatedApiCoreClient({
      data: buildDayRecords(),
      page: 1,
      totalItems: 6,
      itemsPerPage: 100,
      totalPages: 1,
      vehicle: { id: 6386345, plate: "JEN4321" },
    });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createAnalyzeVehicleBehaviorTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", vehicle_id: 6386345, date: "2026-08-07" }),
      ctx,
    );

    // summary: só as métricas com campo confirmado nesta amostra (speed, battery_voltage via bat_percent alias como battery_level, backup_battery_voltage) — nunca 'satellites'.
    const byMetric = Object.fromEntries(result.data.summary.map((s) => [s.metric, s]));
    expect(byMetric.speed).toMatchObject({ min: 0, max: 80, count: 6 });
    expect(byMetric.battery_voltage).toMatchObject({ min: 13, max: 13, count: 6 });
    expect(byMetric.battery_level).toMatchObject({ min: 80, max: 80, count: 6 });
    expect(byMetric.backup_battery_voltage).toMatchObject({ min: 12, max: 12, count: 6 });
    expect(byMetric.satellites).toBeUndefined();

    expect(result.data.anomalies).toHaveLength(1);
    expect(result.data.anomalies[0]).toMatchObject({ timestamp: TIMESTAMPS[4], metric: "speed", observed_value: 80 });

    expect(result.data.alerts).toEqual([
      { timestamp: TIMESTAMPS[0], state: "Normal" },
      { timestamp: TIMESTAMPS[1], state: "Normal" },
      { timestamp: TIMESTAMPS[2], state: "Parada" },
      { timestamp: TIMESTAMPS[3], state: "Parada" },
      { timestamp: TIMESTAMPS[4], state: "Movimento" },
      { timestamp: TIMESTAMPS[5], state: "Normal" },
    ]);

    expect(result.data.ignition_segments).toEqual([
      { start: TIMESTAMPS[0], end: TIMESTAMPS[1], state: true },
      { start: TIMESTAMPS[2], end: TIMESTAMPS[3], state: false },
      { start: TIMESTAMPS[4], end: TIMESTAMPS[5], state: true },
    ]);

    expect(result.warnings ?? []).toEqual([]);
    expect(result.partial).toBe(false);
    expect(result.endpoints).toEqual(["GET /v1/localization/vehicles/{vehicle_id}/last-registers"]);
  });

  it("veículo sem registros na data: retorna summary/anomalies/alerts/ignition_segments vazios, não erro", async () => {
    const fake = createFakeDelegatedApiCoreClient({ data: [], page: 1, totalItems: 0, itemsPerPage: 100, totalPages: 0, vehicle: null });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createAnalyzeVehicleBehaviorTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", vehicle_id: 6386345, date: "2099-01-01" }),
      ctx,
    );

    expect(result.data).toEqual({ summary: [], anomalies: [], alerts: [], ignition_segments: [] });
  });

  it("veículo inexistente/não autorizado: propaga o erro padronizado (VEHICLE_NOT_FOUND), sem tentar calcular análise", async () => {
    const { McpToolError } = await import("../../../src/domain/errors.js");
    const fake = createRejectingApiCoreClient(
      new McpToolError({ code: "VEHICLE_NOT_FOUND", message: "Vehicle was not found.", retryable: false }),
    );
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createAnalyzeVehicleBehaviorTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    await expect(
      definition.handler(definition.inputSchema.parse({ central: "central-1", vehicle_id: 999999999, date: "2026-08-07" }), ctx),
    ).rejects.toMatchObject({ code: "VEHICLE_NOT_FOUND" });
  });

  it("'satellites' pedido explicitamente: nunca aparece em summary, gera warning explicando a pendência de Engenharia", async () => {
    const fake = createFakeDelegatedApiCoreClient({
      data: buildDayRecords(),
      page: 1,
      totalItems: 6,
      itemsPerPage: 100,
      totalPages: 1,
      vehicle: null,
    });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createAnalyzeVehicleBehaviorTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", vehicle_id: 6386345, date: "2026-08-07", metrics: ["satellites"] }),
      ctx,
    );

    expect(result.data.summary).toEqual([]);
    expect(result.data.anomalies).toEqual([]);
    expect(result.warnings?.some((w) => w.includes("satellites"))).toBe(true);
  });

  it("'satellites' não pedido explicitamente (default): nenhum warning de pendência (evita ruído em toda chamada padrão)", async () => {
    const fake = createFakeDelegatedApiCoreClient({
      data: buildDayRecords(),
      page: 1,
      totalItems: 6,
      itemsPerPage: 100,
      totalPages: 1,
      vehicle: null,
    });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createAnalyzeVehicleBehaviorTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", vehicle_id: 6386345, date: "2026-08-07" }),
      ctx,
    );

    expect(result.warnings ?? []).toEqual([]);
  });

  it("agrega TODAS as páginas do dia internamente, sem expor page/page_size ao agente", async () => {
    const page1Records = [buildDayRecords()[0], buildDayRecords()[1]];
    const page2Records = [buildDayRecords()[2]];
    const fake = createSequencedDelegatedApiCoreClient([
      { data: page1Records, page: 1, totalItems: 3, itemsPerPage: 100, totalPages: 2, vehicle: null },
      { data: page2Records, page: 2, totalItems: 3, itemsPerPage: 100, totalPages: 2, vehicle: null },
    ]);
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createAnalyzeVehicleBehaviorTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", vehicle_id: 6386345, date: "2026-08-07" }),
      ctx,
    );

    expect(fake.get).toHaveBeenCalledTimes(2);
    const speedSummary = result.data.summary.find((s) => s.metric === "speed");
    expect(speedSummary?.count).toBe(3);
    expect(result.partial).toBe(false);
    for (const call of fake.get.mock.calls) {
      expect((call[0] as { query: Record<string, unknown> }).query).not.toHaveProperty("include[]");
    }
  });

  it("sinaliza partial:true e um warning quando o dia excede o guardrail de chamadas downstream (TD-03)", async () => {
    const alwaysMorePage = { data: [buildDayRecords()[0]], page: 1, totalItems: 10_000, itemsPerPage: 100, totalPages: 9_999, vehicle: null };
    const fake = createSequencedDelegatedApiCoreClient([alwaysMorePage]);
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createAnalyzeVehicleBehaviorTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", vehicle_id: 6386345, date: "2026-08-07" }),
      ctx,
    );

    expect(fake.get).toHaveBeenCalledTimes(5);
    expect(result.partial).toBe(true);
    expect(result.warnings?.some((w) => w.toLowerCase().includes("partial") || w.toLowerCase().includes("downstream"))).toBe(true);
  });
});
