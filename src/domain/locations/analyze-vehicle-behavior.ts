/**
 * US-107 — Analisar comportamento de um veículo em um dia.
 *
 * Tool de COMPOSIÇÃO — nenhum endpoint de origem próprio, novo ou direto.
 * Opera inteiramente sobre `get_vehicle_last_registers` (US-106), única
 * fonte de dado — nunca faz nenhuma chamada adicional à API Core. Consome
 * `fetchAllLastRegistersForDay` (exportado por `./get-vehicle-last-registers.js`),
 * NÃO o `ToolDefinition`/handler dessa tool: essa função pura agrega
 * internamente todas as páginas do dia (até o guardrail de 5 chamadas
 * downstream por tool composta, TD-03), sem expor `page`/`page_size`/
 * `include`/`filters` ao agente, conforme exigido pela spec (US-107,
 * "Business Rules").
 *
 * **CONFLITOS IDENTIFICADOS ENTRE O PROMPT DA TAREFA E O CÓDIGO/ESPEC REAL —
 * sinalizados e resolvidos por decisão explícita do usuário nesta rodada,
 * não inferidos:**
 *
 * 1. **Tipo de `vehicle_id`**: o prompt original descrevia `vehicle_id` como
 *    string; `get_vehicle_last_registers` (US-106, dependência obrigatória e
 *    exclusiva desta tool) usa `z.number().int().positive()`. Decisão do
 *    usuário: **manter `number`, idêntico à US-106, sem coerção** — uma
 *    tool de composição não pode ter um contrato de entrada incompatível com
 *    sua única fonte de dado.
 * 2. **Campo "estado" de origem para `alerts`**: a spec (US-107, "Business
 *    Rules") descreve `alerts` como repasse de um campo `estado` "já
 *    presente nos registros de origem" — esse nome literal não existe em
 *    nenhum lugar do output de US-106 (bruto ou normalizado). Decisão do
 *    usuário: usar `telemetry.type` (derivado do campo bruto `tipo`,
 *    TELEMETRY_FIELD_RENAME em `get-vehicle-last-registers.ts`) como o
 *    campo que cumpre esse papel.
 * 3. **Métrica "satélites"**: a spec exige config de anomalia (multiplicador
 *    de MAD + limiar mínimo absoluto) para 5 métricas nomeadas (tensão de
 *    bateria, % bateria, tensão de bateria reserva, velocidade, satélites),
 *    mas NENHUM campo bruto de contagem de satélites aparece em nenhum
 *    lugar da telemetria confirmada empiricamente por US-106 (nem nos campos
 *    traduzidos, nem nos mantidos como vieram: `can_*`, `ibutton`, `rpm`,
 *    `volts`, `lat`, `lng`, `qi120`) — `last-registers` também está ausente
 *    do `openapi.json` (exceção já documentada em US-106), então não há
 *    fonte alternativa para confirmar o nome real do campo. Decisão do
 *    usuário: **"satellites" permanece presente em `ANOMALY_METRIC_CONFIG`
 *    (com o mesmo placeholder `TODO: calibrar com dados reais` das outras 4
 *    métricas), mas sem nenhum alias de campo bruto mapeado** — a métrica
 *    nunca produz entradas em `summary`/`anomalies` até a Engenharia
 *    confirmar o nome real do campo nesta rodada de origem específica.
 *    Sinalizado explicitamente aqui e em `epicsuserstoriesimplementados.md`
 *    — não escondido silenciosamente.
 *
 * **Decisão de escopo de `summary`/`anomalies` (não um conflito, uma
 * decisão de implementação dentro do contrato):** a spec descreve o default
 * de métricas de interesse como "todas as telemetrias numéricas relevantes
 * retornadas pela US-106", sem definir critério do que conta como
 * "relevante". Em vez de escanear todos os ~20 campos de telemetria
 * (a maioria flags/códigos/categóricos, sem semântica de min/max/avg
 * significativa — ex.: `ignition`, `gps_fix`, `panic`, `type`, `module`),
 * `summary`/`anomalies` foram escopados exclusivamente às 5 métricas
 * nomeadas explicitamente na spec (Seção "Notes for Refinement"): tensão de
 * bateria, % bateria, tensão de bateria reserva, velocidade, satélites (esta
 * última sem dado, ver conflito 3). Ampliar esse conjunto é uma decisão de
 * Produto/Engenharia, não inferida aqui.
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import {
  dateOnlySchema,
  fetchAllLastRegistersForDay,
  type NormalizedLastRegister,
} from "./get-vehicle-last-registers.js";
import { centralSchema } from "../shared.js";
import type { GetrakWebToolDeps } from "../getrak-web-shared.js";

const METRIC_KEYS = ["battery_voltage", "battery_level", "backup_battery_voltage", "speed", "satellites"] as const;
type MetricKey = (typeof METRIC_KEYS)[number];

/**
 * Alias dos campos brutos de telemetria (já traduzidos por US-106) que
 * alimentam cada métrica — mais de um alias quando a mesma grandeza é
 * exposta sob dois nomes de campo diferentes (duplicação real confirmada
 * empiricamente nesta rodada: `battery_voltage`≡`volts`,
 * `backup_battery_level`≡`bat_percent`). Ordem = prioridade de leitura.
 * `satellites` sem nenhum alias — ver conflito 3 no cabeçalho do arquivo.
 */
const METRIC_FIELD_ALIASES: Record<MetricKey, readonly string[]> = {
  battery_voltage: ["battery_voltage", "volts"],
  battery_level: ["backup_battery_level", "bat_percent"],
  backup_battery_voltage: ["voltsbkp"],
  speed: ["speed"],
  satellites: [],
};

export interface AnomalyMetricConfig {
  /** Múltiplo do MAD (desvio absoluto mediano) acima do qual um ponto é candidato a anomalia. */
  madMultiplier: number;
  /**
   * Desvio absoluto mínimo (na unidade nativa da métrica) para que um ponto
   * seja reportado, mesmo que o múltiplo de MAD já tenha sido excedido —
   * evita reportar desvios estatisticamente "significativos" mas
   * operacionalmente irrelevantes (ex.: MAD≈0 quando a métrica é quase
   * constante no dia).
   */
  absoluteMinimumThreshold: number;
  unit: string;
}

/**
 * Requer validação do time de Engenharia (US-107, "Notes for Refinement"):
 * valores de partida, não calibrados com análise estatística de dados
 * reais — apenas para permitir que a lógica de detecção seja
 * implementada/testada de ponta a ponta. Config isolada e versionável, não
 * hardcoded inline na lógica de detecção — recalibração futura não é
 * mudança de contrato da tool (US-107, "Business Rules").
 */
export const ANOMALY_METRIC_CONFIG: Record<MetricKey, AnomalyMetricConfig> = {
  battery_voltage: { madMultiplier: 3, absoluteMinimumThreshold: 1, unit: "V" }, // TODO: calibrar com dados reais (Engenharia)
  battery_level: { madMultiplier: 3, absoluteMinimumThreshold: 10, unit: "%" }, // TODO: calibrar com dados reais (Engenharia)
  backup_battery_voltage: { madMultiplier: 3, absoluteMinimumThreshold: 1, unit: "V" }, // TODO: calibrar com dados reais (Engenharia)
  speed: { madMultiplier: 3, absoluteMinimumThreshold: 20, unit: "km/h" }, // TODO: calibrar com dados reais (Engenharia)
  satellites: { madMultiplier: 3, absoluteMinimumThreshold: 3, unit: "count" }, // TODO: calibrar com dados reais (Engenharia) — sem campo bruto confirmado, ver conflito 3 no cabeçalho
};

/** Amostra mínima para que mediana/MAD tenham significado estatístico — abaixo disso, a métrica ainda aparece em `summary` (se houver ao menos 1 ponto), mas não é avaliada para anomalias. */
const MIN_SAMPLE_SIZE_FOR_ANOMALY_DETECTION = 3;

export function computeMedian(values: number[]): number {
  if (values.length === 0) {
    throw new Error("computeMedian requires at least one value.");
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
  }
  return sorted[mid] as number;
}

/** MAD = mediana dos desvios absolutos em relação à mediana — baseline robusto (US-107 AC), não média/desvio padrão. */
export function computeMad(values: number[], median: number): number {
  return computeMedian(values.map((value) => Math.abs(value - median)));
}

export interface MetricPoint {
  timestamp: string;
  value: number;
}

export interface MetricSummary {
  metric: string;
  min: number;
  max: number;
  avg: number;
  count: number;
}

export interface MetricAnomaly {
  timestamp: string;
  metric: string;
  observed_value: number;
  baseline_value: number;
  deviation_magnitude: number;
}

export function summarizeMetricPoints(metric: string, points: MetricPoint[]): MetricSummary | null {
  if (points.length === 0) {
    return null;
  }
  const values = points.map((point) => point.value);
  const sum = values.reduce((acc, value) => acc + value, 0);
  return {
    metric,
    min: Math.min(...values),
    max: Math.max(...values),
    avg: sum / values.length,
    count: values.length,
  };
}

/**
 * US-107 AC: baseline por mediana+MAD (não média/delta bruto entre pontos
 * consecutivos); critério de anomalia = multiplicador de MAD **combinado**
 * a um limiar mínimo absoluto. Quando MAD=0 (métrica quase constante no
 * dia — comum, ex.: velocidade 0 na maior parte de um dia parado), o
 * multiplo de MAD deixa de ser um critério útil (0 × qualquer coisa = 0,
 * marcaria qualquer desvio como anomalia); nesse caso o limiar mínimo
 * absoluto passa a ser o único critério real — comportamento explícito, não
 * um efeito colateral silencioso.
 */
export function detectMetricAnomalies(
  metric: string,
  points: MetricPoint[],
  config: AnomalyMetricConfig,
): MetricAnomaly[] {
  if (points.length < MIN_SAMPLE_SIZE_FOR_ANOMALY_DETECTION) {
    return [];
  }

  const values = points.map((point) => point.value);
  const median = computeMedian(values);
  const mad = computeMad(values, median);

  const anomalies: MetricAnomaly[] = [];
  for (const point of points) {
    const deviation = Math.abs(point.value - median);
    if (deviation < config.absoluteMinimumThreshold) {
      continue;
    }
    const exceedsMadThreshold = mad > 0 ? deviation >= config.madMultiplier * mad : true;
    if (!exceedsMadThreshold) {
      continue;
    }
    anomalies.push({
      timestamp: point.timestamp,
      metric,
      observed_value: point.value,
      baseline_value: median,
      deviation_magnitude: mad > 0 ? deviation / mad : deviation,
    });
  }
  return anomalies;
}

function extractMetricSeries(registers: NormalizedLastRegister[], key: MetricKey): MetricPoint[] {
  const aliases = METRIC_FIELD_ALIASES[key];
  const points: MetricPoint[] = [];
  for (const register of registers) {
    if (register.gps_at === null) {
      continue;
    }
    for (const alias of aliases) {
      const value = register.telemetry[alias];
      if (typeof value === "number" && Number.isFinite(value)) {
        points.push({ timestamp: register.gps_at, value });
        break;
      }
    }
  }
  return points;
}

export interface AlertEntry {
  timestamp: string;
  /** Repasse normalizado de `telemetry.type` (raw `tipo`) — ver conflito 2 no cabeçalho. Sem detecção/heurística própria desta tool. */
  state: unknown;
}

function buildAlerts(registers: NormalizedLastRegister[]): AlertEntry[] {
  const alerts: AlertEntry[] = [];
  for (const register of registers) {
    if (register.gps_at === null) {
      continue;
    }
    const state = register.telemetry.type;
    if (state === null || state === undefined) {
      continue;
    }
    alerts.push({ timestamp: register.gps_at, state });
  }
  return alerts;
}

export interface IgnitionSegment {
  start: string;
  end: string;
  state: boolean;
}

/** `ignicao` chega como 0/1 (documentado como flag inteira em endpoints correlatos) — tratado defensivamente também para boolean/string "0"/"1". */
function normalizeIgnitionState(raw: unknown): boolean | null {
  if (typeof raw === "boolean") {
    return raw;
  }
  if (typeof raw === "number") {
    return raw !== 0;
  }
  if (raw === "0") {
    return false;
  }
  if (raw === "1") {
    return true;
  }
  return null;
}

/**
 * Intervalos semânticos (`start`/`end`/`state`) por agrupamento de registros
 * consecutivos com o mesmo estado de ignição — SEM nenhuma geometria de
 * gráfico (paths, pixels, coordenadas), conforme US-107 "Business Rules".
 * Registros com estado de ignição desconhecido são ignorados (não fundem
 * segmentos adjacentes através da lacuna) — não há dado para inferir o que
 * aconteceu nesse intervalo, então não é inventado.
 */
function buildIgnitionSegments(registers: NormalizedLastRegister[]): IgnitionSegment[] {
  const segments: IgnitionSegment[] = [];
  let current: IgnitionSegment | null = null;

  for (const register of registers) {
    if (register.gps_at === null) {
      continue;
    }
    const state = normalizeIgnitionState(register.telemetry.ignition);
    if (state === null) {
      continue;
    }
    if (current === null || current.state !== state) {
      if (current) {
        segments.push(current);
      }
      current = { start: register.gps_at, end: register.gps_at, state };
    } else {
      current.end = register.gps_at;
    }
  }
  if (current) {
    segments.push(current);
  }
  return segments;
}

export const analyzeVehicleBehaviorInputSchema = z.object({
  central: centralSchema,
  /** Idêntico à US-106 (dependência exclusiva e obrigatória) — ver conflito 1 no cabeçalho. */
  vehicle_id: z.number().int().positive(),
  date: dateOnlySchema,
  /** Default = as métricas nomeadas na spec (ver decisão de escopo no cabeçalho) — nunca todas as telemetrias brutas. */
  metrics: z.array(z.enum(METRIC_KEYS)).optional(),
});

export type AnalyzeVehicleBehaviorInput = z.infer<typeof analyzeVehicleBehaviorInputSchema>;

export interface AnalyzeVehicleBehaviorData {
  summary: MetricSummary[];
  anomalies: MetricAnomaly[];
  alerts: AlertEntry[];
  ignition_segments: IgnitionSegment[];
}

export function createAnalyzeVehicleBehaviorTool(
  deps: GetrakWebToolDeps,
): DomainToolRegistration<AnalyzeVehicleBehaviorInput, AnalyzeVehicleBehaviorData> {
  const definition: ToolDefinition<AnalyzeVehicleBehaviorInput, AnalyzeVehicleBehaviorData> = {
    name: "analyze_vehicle_behavior",
    risk: "low",
    requiresCentral: true,
    inputSchema: analyzeVehicleBehaviorInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const fetched = await fetchAllLastRegistersForDay({
        deps,
        central: input.central,
        vehicleId: input.vehicle_id,
        date: input.date,
        environment: ctx.environment,
        userId: ctx.consumer.consumer_id,
      });

      // Ordenação cronológica explícita — US-106 não garante (nem expõe,
      // nesta composição) nenhuma ordem específica de retorno.
      const registers = [...fetched.registers].sort((a, b) => {
        if (a.gps_at === null) return 1;
        if (b.gps_at === null) return -1;
        return a.gps_at.localeCompare(b.gps_at);
      });

      const requestedMetrics = input.metrics ?? METRIC_KEYS;
      const warnings = [...fetched.warnings];

      const summary: MetricSummary[] = [];
      const anomalies: MetricAnomaly[] = [];

      for (const key of requestedMetrics) {
        const points = extractMetricSeries(registers, key);
        if (points.length === 0) {
          if (key === "satellites" && input.metrics?.includes("satellites")) {
            warnings.push(
              "Metric 'satellites' has no confirmed raw telemetry field in get_vehicle_last_registers (US-106) — pending Engineering validation (see US-107 traceability notes); it never produces summary/anomalies until confirmed.",
            );
          }
          continue;
        }
        const metricSummary = summarizeMetricPoints(key, points);
        if (metricSummary) {
          summary.push(metricSummary);
        }
        anomalies.push(...detectMetricAnomalies(key, points, ANOMALY_METRIC_CONFIG[key]));
      }
      anomalies.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

      return {
        data: {
          summary,
          anomalies,
          alerts: buildAlerts(registers),
          ignition_segments: buildIgnitionSegments(registers),
        },
        endpoints: fetched.endpoints,
        warnings,
        partial: fetched.partial,
        authScheme: "oauth2Password",
      };
    },
  };

  return {
    catalogEntry: {
      name: "analyze_vehicle_behavior",
      description:
        "Analyze a vehicle's behavior on a specific date: per-metric summary (min/max/avg), median+MAD-based anomalies, source-state alerts, and ignition segments. Composes over get_vehicle_last_registers — makes no direct API Core call.",
      intent: "read",
      domain: "locations",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
