/**
 * US-070 — Buscar veículos (Getrak Web).
 * Endpoint: GET /v1.0/vehicles (não depreciado, oauth2Password/GetrakWeb —
 * token delegado).
 *
 * Confirmado contra chamada real em homologação nesta rodada:
 *   - Resposta é o mesmo envelope de paginação real `{data: [...], page,
 *     pages, total}` (`extractPagePerPageEnvelope`).
 *   - MESMO BUG DE PAGINAÇÃO já visto em Epic 10/16: `perPage` é
 *     silenciosamente ignorado; `per_page` é o nome real. Confirmado
 *     empiricamente antes de escrever este código (25 itens com `perPage=3`,
 *     3 itens com `per_page=3`, mesmo `total`).
 *   - `filters[search]` confirmado funcional (busca por placa/apelido/
 *     serial/chassi, conforme documentado). Filtro sem correspondência
 *     retorna lista vazia normalizada (`{data: [], total: 0, pages: 0,
 *     page: 1}`), nunca erro.
 *   - Registro real é MUITO mais rico que o schema documentado no
 *     openapi.json (`{brand, device_id, id, model, nickname, plate}`) — a
 *     resposta real inclui dezenas de campos de cadastro (vin, renavam,
 *     cor, ano, combustível, timezone, contatos, tag, cliente, categoria,
 *     etc.). Repassado como recebido (normalização mínima, não redução de
 *     campos) — mesma filosofia já aplicada às demais tools deste projeto.
 *
 * SOBREPOSIÇÃO COM US-008 (`search_vehicles`, Epic 2, GET
 * /v0.2/veiculos/integracao, `oauth2ClientCredentials`/`Integracao`) —
 * investigada conforme instruído: **ambas são consultas de CADASTRO de
 * veículo** (nenhuma inclui localização/telemetria em tempo real), então há
 * sobreposição conceitual real de domínio, não só de nome. Porém não foi
 * possível comparar o SHAPE de dados ponto a ponto empiricamente nesta
 * rodada — `search_vehicles` (Epic 2) usa `oauth2ClientCredentials`, e
 * nenhuma credencial desse tipo está disponível neste ambiente (mesma
 * limitação já registrada no CLAUDE.md Seção 0 para todo o Epic 2/4/9).
 * Pelo `openapi.json`, o shape documentado de `/v0.2/veiculos/integracao`
 * é bem mais enxuto que o shape REAL observado aqui para `/v1.0/vehicles`
 * (que já sabemos, por outros achados desta mesma rodada, divergir da
 * documentação). **Não consolidado nem descartado** — decisão de Produto/
 * Engenharia; sinalizado explicitamente no PR.
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

const SOURCE_ENDPOINT = "GET /v1.0/vehicles";

const VEHICLE_STATUSES = ["active", "available", "inactive", "suspended", "unequipped"] as const;

export const searchWebVehiclesInputSchema = z.object({
  central: centralSchema,
  search: z.string().optional(),
  client_id: z.number().int().positive().optional(),
  client_id_is_null: z.boolean().optional(),
  subclient_id: z.number().int().positive().optional(),
  status: z.enum(VEHICLE_STATUSES).optional(),
  brand_contains: z.string().optional(),
  model_contains: z.string().optional(),
  equipment_serial: z.string().optional(),
  vin: z.string().optional(),
  sort_direction: z.enum(["ASC", "DESC"]).optional(),
  ...paginationInputShape,
});

export type SearchWebVehiclesInput = z.infer<typeof searchWebVehiclesInputSchema>;

export interface SearchWebVehiclesData {
  vehicles: Record<string, unknown>[];
  pagination: ReturnType<typeof extractPagePerPageEnvelope>["meta"];
}

export function createSearchWebVehiclesTool(
  deps: WebVehiclesToolDeps,
): DomainToolRegistration<SearchWebVehiclesInput, SearchWebVehiclesData> {
  const definition: ToolDefinition<SearchWebVehiclesInput, SearchWebVehiclesData> = {
    name: "search_web_vehicles",
    risk: "low",
    requiresCentral: true,
    inputSchema: searchWebVehiclesInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const upstreamPagination = buildPagePerPagePagination(input, "per_page");

      const raw = await callGetrakWebEndpoint<unknown>({
        deps,
        path: "/v1.0/vehicles",
        query: {
          "filters[search]": input.search,
          "filters[client_id]": input.client_id,
          "filters[client_id][is_null]": input.client_id_is_null,
          "filters[subclient_id]": input.subclient_id,
          "filters[status]": input.status,
          "filters[brand][like]": input.brand_contains,
          "filters[model][like]": input.model_contains,
          "filters[equipment][eq]": input.equipment_serial,
          "filters[vin][eq]": input.vin,
          "order[vehicle_name]": input.sort_direction,
          ...upstreamPagination.query,
        },
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
      });

      const { items, meta } = extractPagePerPageEnvelope(raw, upstreamPagination.page, upstreamPagination.page_size);

      return {
        data: { vehicles: items.map(normalizeItem), pagination: meta },
        endpoints: [SOURCE_ENDPOINT],
        authScheme: "oauth2Password",
      };
    },
  };

  return {
    catalogEntry: {
      name: "search_web_vehicles",
      description:
        "Search registered vehicles (Getrak Web view) within an authorized central. " +
        "Overlaps conceptually with search_vehicles (Epic 2/Integracao) — see source comments.",
      intent: "read",
      domain: "web_vehicles",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
