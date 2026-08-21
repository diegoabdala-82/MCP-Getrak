/**
 * US-106 — Consultar últimos registros de localização de um veículo, numa
 * data específica, com enriquecimentos/filtros ricos.
 *
 * Endpoint: GET /v1/localization/vehicles/{vehicle_id}/last-registers —
 * `oauth2Password`/`GetrakWeb`, **token DELEGADO** (US-046/047/048), não a
 * credencial técnica usada pelas outras 7 tools deste domínio (Epic 3,
 * US-013 a US-019, modelo anterior — CLAUDE.md Seção 6.2, não migradas
 * nesta rodada). Por isso esta tool importa `callGetrakWebEndpoint`/
 * `GetrakWebToolDeps` diretamente de `../getrak-web-shared.js`, e não do
 * `./shared.js` deste domínio (que continua exclusivamente do modelo
 * antigo) — `registerLocationTools` foi estendida para aceitar também
 * `delegatedTokenManager`, mas as outras 7 tools continuam recebendo só
 * `apiCoreClient` sem uso do parâmetro novo.
 *
 * **EXCEÇÃO DOCUMENTADA — endpoint ausente do `openapi.json`.** Confirmado
 * por busca completa no arquivo: nenhuma ocorrência de "last-registers".
 * Existência, versão (`v1`), parâmetros e shape de resposta foram
 * confirmados diretamente pelo Product Owner/Technical Owner E,
 * adicionalmente, por chamada real contra produção nesta rodada (não
 * apenas repassados sem verificação) — mas não há nenhum lastro na
 * especificação processada. Não é precedente para futuras tools sem
 * endpoint documentado — é uma exceção pontual, sinalizada como pendência
 * de Engenharia (reportar formalmente a ausência ao time da API Core).
 *
 * **Distinta de `get_vehicle_location_history` (US-014).** Endpoints,
 * parâmetros e propósito diferentes: US-014 usa `GET /v0.1/recebidos/
 * {id}/{dataIni}/{dataFim}` (intervalo de datas, sem paginação nativa,
 * credencial técnica antiga); US-106 usa uma data única + paginação real +
 * `include`/`order`/`filters` ricos, via token delegado. Nenhuma
 * sobreposição de dados observada nos testes desta rodada (datasets
 * diferentes) — não consolidada, conforme instruído.
 *
 * CONFIRMADO CONTRA PRODUÇÃO REAL (central "apresentacao", nesta rodada):
 *
 * 1. **Envelope de paginação é `{data, page, totalItems, itemsPerPage,
 *    totalPages, vehicle}`** — nomes de campo DIFERENTES de todo o resto
 *    do projeto (nem `{page,pages,total}` do padrão Getrak Web, nem
 *    `{pagination:{...}}` do Epic 14). Traduzido para o padrão MCP
 *    (`page`/`page_size`/`total_items`/`has_more`) via extrator local
 *    (`extractLastRegistersEnvelope`) — não reaproveita nenhum helper
 *    existente, shape genuinamente único.
 * 2. **O NOME REAL do parâmetro de tamanho de página é `per_page`** —
 *    `itemsPerPage` (o nome do campo de resposta) e `perPage` testados e
 *    confirmados SEM EFEITO (reproduz o mesmo bug recorrente de todo o
 *    projeto, agora também neste endpoint sem lastro na spec).
 * 3. **`include[]` exige valores em camelCase na wire**, DIFERENTE do que
 *    a spec da User Story (e o prompt da tarefa) descreveram em
 *    snake_case: confirmado via erro 422 real (`"include[0]" must be one
 *    of [address, referencePoints, additionalTelemetries, driver]`). O
 *    contrato PÚBLICO da tool continua em snake_case
 *    (`reference_points`/`additional_telemetries`), consistente com o
 *    resto do projeto (CLAUDE.md Seção 3) — a tradução para o valor real
 *    da wire (`referencePoints`/`additionalTelemetries`) é feita
 *    internamente (`INCLUDE_WIRE_VALUE`), nunca exposta ao agente.
 * 4. **`order[date]=ASC|DESC` confirmado funcionando** (ordem cronológica
 *    invertida corretamente); a forma alternativa `order=date:ASC` (sem
 *    colchetes) testada e confirmada SEM EFEITO.
 * 5. **ACHADO CRÍTICO — `filters` só confirmado funcionando para o campo
 *    `ignicao`** (`filters[ignicao][eq]=1|0`, valores numéricos — testado
 *    com resultado exato esperado nos dois casos). Testados também
 *    `filters[panico][eq]` e `filters[velocidade][gte/lte]`: **nenhum erro
 *    HTTP, mas SEMPRE retornam 0 resultados, mesmo quando os dados reais
 *    deveriam corresponder** (`panico`/`velocidade` = 0 em todos os
 *    registros da amostra, e `[eq]=0`/`[gte]=0`/`[lte]=999` ainda assim
 *    zeraram o resultado) — comportamento de "filtro que não erra, mas
 *    também não funciona", diferente de um filtro simplesmente ignorado
 *    (que devolveria o total não filtrado). Por isso esta tool expõe
 *    **só um filtro, `ignition_on` (boolean)**, mapeado para
 *    `filters[ignicao][eq]` com `1`/`0` — não exposto nenhum outro campo
 *    de filtro até confirmação da Engenharia sobre o allow-list real.
 *    `filters[classification][eq]=2` (campo de nível superior, fora de
 *    `data`) também zerou sempre — reforça a hipótese de que `filters` só
 *    enxerga campos dentro do objeto `data` (telemetria), mas mesmo assim
 *    não todos eles.
 * 6. **Vínculo id de veículo inexistente → HTTP 404 limpo**
 *    (`{"status":404,"error":"Vehicle was not found"}`) — mapeado para
 *    `VEHICLE_NOT_FOUND`.
 * 7. **`date` ausente → HTTP 422 limpo** (`"date" is required"`) — a API
 *    já se comporta bem aqui (diferente do padrão recorrente de HTTP 500
 *    genérico em filtro obrigatório ausente visto em outros epics); mesmo
 *    assim `date` é obrigatório no schema Zod da tool (proteção de
 *    validação antes de qualquer chamada, como em toda tool do projeto).
 * 8. **Objeto `vehicle` (com `client` aninhado) vem UMA VEZ por resposta**,
 *    fora do array `data` — não por registro. Contém documento/e-mail/
 *    telefone do `client`, sempre incluídos por decisão de produto já
 *    registrada (Contexto Seção 11.2.1, Decisão 1) — repassado sem
 *    mascaramento/omissão na resposta normalizada, exceção deliberada ao
 *    princípio geral de minimização.
 * 9. **Quatro campos de data confirmados**: `date` (raiz do registro),
 *    `data.timestamp`, `data.datagps`, `data.data` — os dois últimos
 *    representam o MESMO instante GPS em fusos diferentes (`datagps` em
 *    horário local com offset `-03:00`, `data` em UTC/`Z`); `timestamp`
 *    difere ligeiramente (momento de recebimento/processamento pelo
 *    servidor, não o instante do GPS). **Escolha do campo canônico:
 *    `datagps`** (exposto como `gps_at` no nível superior do registro
 *    normalizado) — candidato mais razoável por representar o instante em
 *    que a posição foi de fato capturada pelo equipamento, não quando foi
 *    recebida/processada. As quatro datas brutas são preservadas
 *    integralmente em `raw_timestamps`, sem descarte, até confirmação
 *    formal da semântica exata pela Engenharia.
 * 10. **Nomenclatura de telemetria em português traduzida para inglês**
 *     nos campos claramente identificáveis (`sequencia`→`sequence`,
 *     `velocidade`→`speed`, `saidas`→`outputs`, `entradas`→`inputs`,
 *     `direcao`→`direction`, `gpsfix`→`gps_fix`, `alimentacao`→
 *     `power_supply`, `ignicao`→`ignition`, `eventos`→`events`,
 *     `panico`→`panic`, `tensao_bateria`→`battery_voltage`,
 *     `nivel_bateria_reserva`→`backup_battery_level`, `modulo`→`module`,
 *     `horimetro`→`hourmeter`, `temperatura`→`temperature`, `hodometro`→
 *     `odometer`, `tipo`→`type`, `driverName`→`driver_name`). Campos
 *     ambíguos ou já em inglês/abreviações internacionais (`can_*`,
 *     `ibutton`, `rpm`, `volts`, `lat`, `lng`, `qi120`) foram
 *     deliberadamente MANTIDOS como vieram — não inventada uma tradução
 *     para semântica não confirmada (ex.: `can_fl`, `can_hor`), conforme
 *     instruído.
 * 11. **Campos majoritariamente nulos** (`can_*`, e no objeto `vehicle`:
 *     `vin`, `nickname`, `model`) são esperados e dependem do hardware do
 *     rastreador — tratados como ausência normal, não erro.
 */

import { z } from "zod";
import type { Environment } from "../../config/environment.js";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import { MAX_PAGE_SIZE, normalizePagination, type PaginationMeta } from "../../foundation/pagination/pagination.js";
import { callGetrakWebEndpoint, type GetrakWebToolDeps } from "../getrak-web-shared.js";
import { centralSchema, normalizeItem } from "../shared.js";

const SOURCE_ENDPOINT = "GET /v1/localization/vehicles/{vehicle_id}/last-registers";

const INCLUDE_VALUES = ["address", "reference_points", "additional_telemetries", "driver"] as const;

/** Contrato público da tool é snake_case (CLAUDE.md Seção 3); a wire real exige camelCase para 2 dos 4 valores — ver achado 3 no cabeçalho. */
const INCLUDE_WIRE_VALUE: Record<(typeof INCLUDE_VALUES)[number], string> = {
  address: "address",
  reference_points: "referencePoints",
  additional_telemetries: "additionalTelemetries",
  driver: "driver",
};

/** Exportado para reuso por `analyze_vehicle_behavior` (US-107), que exige o mesmo formato de data. */
export const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected date in the format YYYY-MM-DD (e.g. 2026-08-20)");

export const getVehicleLastRegistersInputSchema = z.object({
  central: centralSchema,
  vehicle_id: z.number().int().positive(),
  date: dateOnlySchema,
  include: z.array(z.enum(INCLUDE_VALUES)).optional(),
  /** Único filtro confirmado funcionando contra produção — ver achado 5 no cabeçalho. */
  ignition_on: z.boolean().optional(),
  order_direction: z.enum(["ASC", "DESC"]).optional(),
  page: z.number().int().positive().optional(),
  page_size: z.number().int().positive().optional(),
});

export type GetVehicleLastRegistersInput = z.infer<typeof getVehicleLastRegistersInputSchema>;

export interface GetVehicleLastRegistersData {
  registers: NormalizedLastRegister[];
  pagination: PaginationMeta;
  vehicle: Record<string, unknown> | null;
}

/** Campos claramente identificáveis como português, traduzidos para inglês — ver achado 10 no cabeçalho. Ambíguos/já em inglês são mantidos como vieram. */
const TELEMETRY_FIELD_RENAME: Record<string, string> = {
  sequencia: "sequence",
  velocidade: "speed",
  saidas: "outputs",
  entradas: "inputs",
  direcao: "direction",
  gpsfix: "gps_fix",
  alimentacao: "power_supply",
  ignicao: "ignition",
  eventos: "events",
  panico: "panic",
  tensao_bateria: "battery_voltage",
  nivel_bateria_reserva: "backup_battery_level",
  modulo: "module",
  horimetro: "hourmeter",
  temperatura: "temperature",
  hodometro: "odometer",
  tipo: "type",
  driverName: "driver_name",
};

/** As 3 datas brutas dentro de `data.*` (a 4ª, `date`, está na raiz do registro) — nunca repassadas como telemetria comum. */
const RAW_NESTED_DATE_FIELDS = new Set(["timestamp", "datagps", "data"]);

function normalizeTelemetry(rawData: Record<string, unknown>): Record<string, unknown> {
  const telemetry: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rawData)) {
    if (RAW_NESTED_DATE_FIELDS.has(key)) {
      continue;
    }
    telemetry[TELEMETRY_FIELD_RENAME[key] ?? key] = value;
  }
  return normalizeItem(telemetry);
}

/** Formato de retorno de `normalizeRegister` — exportado para reuso tipado por `analyze_vehicle_behavior` (US-107). */
export interface NormalizedLastRegister {
  vehicle_id: number | null;
  gps_at: string | null;
  classification: number | null;
  telemetry: Record<string, unknown>;
  raw_timestamps: Record<string, unknown>;
}

function normalizeRegister(raw: Record<string, unknown>): NormalizedLastRegister {
  const nested = raw.data && typeof raw.data === "object" ? (raw.data as Record<string, unknown>) : {};

  return {
    vehicle_id: (raw.vehicleId as number | undefined) ?? null,
    // Campo de data canônico escolhido (achado 9 no cabeçalho) — candidato
    // mais razoável até confirmação formal da Engenharia.
    gps_at: (nested.datagps as string | undefined) ?? null,
    classification: (raw.classification as number | undefined) ?? null,
    telemetry: normalizeTelemetry(nested),
    raw_timestamps: {
      record_date: raw.date ?? null,
      received_at: nested.timestamp ?? null,
      gps_at: nested.datagps ?? null,
      gps_at_utc: nested.data ?? null,
    },
  };
}

function extractLastRegistersEnvelope(
  raw: unknown,
  page: number,
  page_size: number,
): { items: Record<string, unknown>[]; meta: PaginationMeta; vehicle: Record<string, unknown> | null } {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const items = Array.isArray(obj.data) ? (obj.data as Record<string, unknown>[]) : [];
  const totalPages = typeof obj.totalPages === "number" ? obj.totalPages : null;
  const totalItems = typeof obj.totalItems === "number" ? obj.totalItems : null;
  const vehicle = obj.vehicle && typeof obj.vehicle === "object" ? (obj.vehicle as Record<string, unknown>) : null;

  return {
    items,
    meta: {
      page,
      page_size,
      total_items: totalItems,
      has_more: totalPages !== null ? page < totalPages : items.length >= page_size,
    },
    vehicle,
  };
}

/** Máximo de chamadas downstream por tool composta (TD-03, CLAUDE.md Seção 4) — usado só pela agregação de página única (`fetchAllLastRegistersForDay`), nunca pela tool US-106 propriamente (que expõe page/page_size normalmente ao agente). */
const MAX_DOWNSTREAM_CALLS_PER_COMPOSITE_TOOL = 5;

export interface FetchAllLastRegistersForDayParams {
  deps: GetrakWebToolDeps;
  central: string;
  vehicleId: number;
  date: string;
  environment: Environment;
  userId: string;
}

export interface FetchAllLastRegistersForDayResult {
  registers: NormalizedLastRegister[];
  vehicle: Record<string, unknown> | null;
  /** `true` quando o dia tem mais registros do que o limite de chamadas downstream (TD-03) permitiu buscar. */
  partial: boolean;
  warnings: string[];
  endpoints: string[];
}

/**
 * Reusado por `analyze_vehicle_behavior` (US-107) para obter TODOS os
 * registros de um veículo em um dia, agregando internamente todas as
 * páginas — nunca expondo `page`/`page_size`/`include`/`filters` ao agente
 * (contrato da US-107). Chama a mesma função pura de normalização usada por
 * `get_vehicle_last_registers` (US-106), mas NÃO invoca o `ToolDefinition`/
 * `handler` dessa tool diretamente (que não foi desenhado para chamada
 * reentrante por outra tool — validação de entrada, resolução de central e
 * auditoria já são responsabilidade exclusiva do `ToolRuntime` da tool
 * chamadora, US-107). Página fixa em `MAX_PAGE_SIZE` (100, TD-03) para
 * minimizar o número de chamadas necessárias; interrompe após
 * `MAX_DOWNSTREAM_CALLS_PER_COMPOSITE_TOOL` chamadas (5, TD-03) mesmo se
 * ainda houver mais páginas, sinalizando `partial: true` e um warning — não
 * há relato empírico de um veículo com mais de 500 registros em um único
 * dia nesta rodada, mas o guardrail existe para não violar o limite de
 * chamadas downstream/timeout de tool composta (TD-03) em nenhum cenário.
 */
export async function fetchAllLastRegistersForDay(
  params: FetchAllLastRegistersForDayParams,
): Promise<FetchAllLastRegistersForDayResult> {
  const registers: NormalizedLastRegister[] = [];
  let vehicle: Record<string, unknown> | null = null;
  let page = 1;
  let hasMore = true;
  let callsMade = 0;

  while (hasMore && callsMade < MAX_DOWNSTREAM_CALLS_PER_COMPOSITE_TOOL) {
    const raw = await callGetrakWebEndpoint<unknown>({
      deps: params.deps,
      path: `/v1/localization/vehicles/${params.vehicleId}/last-registers`,
      query: { date: params.date, page, per_page: MAX_PAGE_SIZE },
      environment: params.environment,
      central: params.central,
      userId: params.userId,
      notFoundCode: "VEHICLE_NOT_FOUND",
    });
    callsMade += 1;

    const { items, meta, vehicle: pageVehicle } = extractLastRegistersEnvelope(raw, page, MAX_PAGE_SIZE);
    registers.push(...items.map(normalizeRegister));
    if (pageVehicle) {
      vehicle = normalizeItem(pageVehicle);
    }
    hasMore = meta.has_more === true;
    page += 1;
  }

  const partial = hasMore;
  const warnings = partial
    ? [
        `Vehicle has more than ${MAX_DOWNSTREAM_CALLS_PER_COMPOSITE_TOOL * MAX_PAGE_SIZE} registers on this date — analysis is based on a partial dataset (TD-03 downstream call limit for composite tools).`,
      ]
    : [];

  return { registers, vehicle, partial, warnings, endpoints: [SOURCE_ENDPOINT] };
}

export function createGetVehicleLastRegistersTool(
  deps: GetrakWebToolDeps,
): DomainToolRegistration<GetVehicleLastRegistersInput, GetVehicleLastRegistersData> {
  const definition: ToolDefinition<GetVehicleLastRegistersInput, GetVehicleLastRegistersData> = {
    name: "get_vehicle_last_registers",
    risk: "low",
    requiresCentral: true,
    inputSchema: getVehicleLastRegistersInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const { page, page_size } = normalizePagination(input);
      const includeWire = input.include?.map((value) => INCLUDE_WIRE_VALUE[value]);

      const raw = await callGetrakWebEndpoint<unknown>({
        deps,
        path: `/v1/localization/vehicles/${input.vehicle_id}/last-registers`,
        query: {
          date: input.date,
          page,
          per_page: page_size,
          "include[]": includeWire,
          "filters[ignicao][eq]": input.ignition_on === undefined ? undefined : input.ignition_on ? 1 : 0,
          "order[date]": input.order_direction,
        },
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
        notFoundCode: "VEHICLE_NOT_FOUND",
      });

      const { items, meta, vehicle } = extractLastRegistersEnvelope(raw, page, page_size);

      return {
        data: {
          registers: items.map(normalizeRegister),
          pagination: meta,
          vehicle: vehicle ? normalizeItem(vehicle) : null,
        },
        endpoints: [SOURCE_ENDPOINT],
        authScheme: "oauth2Password",
      };
    },
  };

  return {
    catalogEntry: {
      name: "get_vehicle_last_registers",
      description:
        "Get a vehicle's location/telemetry registers for a specific date, with optional address/reference-point/driver enrichment.",
      intent: "read",
      domain: "locations",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
