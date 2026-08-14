/**
 * US-018 — Consultar tratamentos de veículos offline.
 * Endpoint: GET /v1.0/localization/offline-treatment (v1.0, vigente,
 * oauth2Password/GetrakWeb). Confirmado contra reference/openapi.json
 * (incluindo os code samples reais do endpoint): filtro por `filters[]`,
 * um query param repetido cujo valor é um objeto JSON de um único filtro,
 * ex.: `filters[]={"vehicle_id":123}`. Paginação nativa `page`/`per_page`
 * (mesmo nome do padrão MCP — tradução direta). Resposta paginada real:
 * `{data: [...], page, pages, total}`, permitindo `total_items`/`has_more`
 * exatos (diferente da maioria dos outros endpoints deste projeto).
 *
 * CONFIRMADO em teste real contra produção (2026-08-14, central
 * "apresentacao", credencial com escopo completo): sem `fields[]`
 * explícito, o endpoint retorna cada item com APENAS `{id}` — nenhum outro
 * campo, mesmo com registros reais existentes. Isso tornaria a tool quase
 * inútil por padrão (o agente só receberia IDs, sem status/veículo/datas).
 * Por isso `fields[]` é sempre enviado com o conjunto completo de campos
 * documentados no openapi.json, para que a normalização seja estável e
 * realmente útil (US-003) sem exigir que o consumidor conheça essa
 * particularidade do endpoint. `include[]` continua fora do escopo desta
 * tool (ver nota abaixo).
 *
 * O endpoint também suporta `include[]` e `order[...]` — não expostos
 * nesta tool porque não fazem parte do contrato da spec de US-018
 * ("entrada: identificador de veículo"); `include[]=offline_treatment_history`
 * em particular é deliberadamente deixado de fora para não sobrepor o
 * escopo de US-019, que consulta o histórico como tool separada.
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import type { PaginationMeta } from "../../foundation/pagination/pagination.js";
import { normalizePagination } from "../../foundation/pagination/pagination.js";
import {
  callLocationsEndpoint,
  centralSchema,
  normalizeItem,
  paginationInputShape,
  type LocationsToolDeps,
} from "./shared.js";

const SOURCE_ENDPOINT = "GET /v1.0/localization/offline-treatment";

/** Campos documentados em reference/openapi.json para o parâmetro `fields[]` deste endpoint. */
const ALL_FIELDS = [
  "id",
  "vehicle_id",
  "status",
  "central_id",
  "created_at",
  "finished_at",
  "finished_by",
  "ignore_until",
  "reason",
  "started_by",
] as const;

export const getOfflineTreatmentsInputSchema = z.object({
  central: centralSchema,
  vehicle_id: z.string().optional(),
  ...paginationInputShape,
});

export type GetOfflineTreatmentsInput = z.infer<typeof getOfflineTreatmentsInputSchema>;

export interface GetOfflineTreatmentsData {
  treatments: Record<string, unknown>[];
  pagination: PaginationMeta;
}

interface RawOfflineTreatmentsResponse {
  data?: Record<string, unknown>[];
  page?: number;
  pages?: number;
  total?: number;
}

export function createGetOfflineTreatmentsTool(
  deps: LocationsToolDeps,
): DomainToolRegistration<GetOfflineTreatmentsInput, GetOfflineTreatmentsData> {
  const definition: ToolDefinition<GetOfflineTreatmentsInput, GetOfflineTreatmentsData> = {
    name: "get_offline_treatments",
    risk: "low",
    requiresCentral: true,
    inputSchema: getOfflineTreatmentsInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const { page, page_size } = normalizePagination(input);

      const raw = await callLocationsEndpoint<RawOfflineTreatmentsResponse>({
        apiCoreClient: deps.apiCoreClient,
        path: "/v1.0/localization/offline-treatment",
        query: {
          page,
          per_page: page_size,
          "filters[]": input.vehicle_id ? [JSON.stringify({ vehicle_id: input.vehicle_id })] : undefined,
          "fields[]": [...ALL_FIELDS],
        },
        environment: ctx.environment,
        central: input.central,
      });

      const treatments = (raw.data ?? []).map(normalizeItem);

      return {
        data: {
          treatments,
          pagination: {
            page: raw.page ?? page,
            page_size,
            total_items: raw.total ?? null,
            has_more: raw.page !== undefined && raw.pages !== undefined ? raw.page < raw.pages : null,
          },
        },
        endpoints: [SOURCE_ENDPOINT],
      };
    },
  };

  return {
    catalogEntry: {
      name: "get_offline_treatments",
      description: "List offline treatments applied to vehicles, optionally filtered by vehicle.",
      intent: "read",
      domain: "locations",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
