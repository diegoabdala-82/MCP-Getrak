/**
 * US-072 — Consultar histórico de equipamentos do veículo.
 * Endpoint: GET /v1.0/vehicles/{id}/equipments-history (não depreciado,
 * oauth2Password/GetrakWeb — token delegado).
 *
 * Confirmado contra chamada real em homologação nesta rodada:
 *   - Resposta real: `{data: [...], total, pages}` — SEM a chave `page`
 *     (diferente do envelope `{data, page, pages, total}` visto em todo o
 *     resto do Epic 10/16/17). Inofensivo para `extractPagePerPageEnvelope`
 *     (que usa o `page`/`page_size` já calculados a partir do input, não os
 *     lê da resposta) — mas divergência real, sinalizada aqui.
 *   - `per_page`/`page` (paginação) usados desde o início, mesmo bug já
 *     confirmado em todo o resto do Epic 10/16/17 (não testado de novo
 *     isoladamente aqui — mesma família de endpoint, mesmo `$ref`
 *     `#/components/parameters/perPage` no openapi.json).
 *   - Cada registro: `{id, linked_at, serial_number, unlinked_at,
 *     vehicle_id}` — bate com o documentado; `unlinked_at: null` para o
 *     vínculo ainda ativo, confirmado.
 *   - 404 confirmado para `id` de veículo inexistente:
 *     `{"status":404,"error":"vehicle"}` — normalizado para
 *     `VEHICLE_NOT_FOUND`.
 *
 * `filter[search][inc]` (singular "filter", conforme documentado
 * literalmente no openapi.json — diferente do "filters" plural usado na
 * maioria dos outros endpoints) — usado aqui fielmente ao nome documentado,
 * mas o teste real feito nesta rodada não conseguiu discriminar se
 * "filter"/"filters" faz diferença de fato (o veículo de teste só tinha um
 * serial_number distinto no histórico, então o filtro "funcionou" com
 * qualquer um dos dois nomes, o que não prova nada) — item residual para
 * confirmação futura, não uma suposição não sinalizada.
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import {
  buildPagePerPagePagination,
  callGetrakWebEndpoint,
  centralSchema,
  extractPagePerPageEnvelope,
  normalizeItem,
  paginationInputShape,
  type WebVehiclesToolDeps,
} from "./shared.js";

const SOURCE_ENDPOINT = "GET /v1.0/vehicles/{id}/equipments-history";

export const getVehicleEquipmentHistoryInputSchema = z.object({
  central: centralSchema,
  vehicle_id: z.number().int().positive(),
  serial_number_contains: z.string().optional(),
  ...paginationInputShape,
});

export type GetVehicleEquipmentHistoryInput = z.infer<typeof getVehicleEquipmentHistoryInputSchema>;

export interface GetVehicleEquipmentHistoryData {
  history: Record<string, unknown>[];
  pagination: ReturnType<typeof extractPagePerPageEnvelope>["meta"];
}

export function createGetVehicleEquipmentHistoryTool(
  deps: WebVehiclesToolDeps,
): DomainToolRegistration<GetVehicleEquipmentHistoryInput, GetVehicleEquipmentHistoryData> {
  const definition: ToolDefinition<GetVehicleEquipmentHistoryInput, GetVehicleEquipmentHistoryData> = {
    name: "get_vehicle_equipment_history",
    risk: "low",
    requiresCentral: true,
    inputSchema: getVehicleEquipmentHistoryInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const upstreamPagination = buildPagePerPagePagination(input, "per_page");

      const raw = await callGetrakWebEndpoint<unknown>({
        deps,
        path: `/v1.0/vehicles/${encodeURIComponent(String(input.vehicle_id))}/equipments-history`,
        query: {
          "filter[search][inc]": input.serial_number_contains,
          ...upstreamPagination.query,
        },
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
        notFoundCode: "VEHICLE_NOT_FOUND",
      });

      const { items, meta } = extractPagePerPageEnvelope(raw, upstreamPagination.page, upstreamPagination.page_size);

      return {
        data: { history: items.map(normalizeItem), pagination: meta },
        endpoints: [SOURCE_ENDPOINT],
        authScheme: "oauth2Password",
      };
    },
  };

  return {
    catalogEntry: {
      name: "get_vehicle_equipment_history",
      description: "Get the history of equipments linked/unlinked to a vehicle over time, within an authorized central.",
      intent: "read",
      domain: "web_vehicles",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
