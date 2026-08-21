/**
 * US-061 — Buscar clientes (Getrak Web).
 * Endpoint: GET /v1.0/client (não depreciado, oauth2Password/GetrakWeb —
 * token delegado). O `x-codeSamples` do openapi.json usa o path plural
 * `/v1.0/clients` — confirmado empiricamente que singular e plural
 * retornam resultado IDÊNTICO (mesmo total, mesmos itens); implementado
 * com o path singular `/v1.0/client`, por ser o que está de fato
 * declarado em `paths` no openapi.json (a fonte de verdade estrutural),
 * não o exemplo de código.
 *
 * ACHADO CRÍTICO — shape de resposta muito mais restrito do que o
 * documentado. O schema de resposta documenta um item completo
 * (`business_phone, city, document, email, id, name, neighborhood, state,
 * status, street_address, street_number, type`), mas:
 *   - Sem `fields[]`, a resposta real traz só `{id, name}`.
 *   - `fields[]` tem um ENUM DOCUMENTADO restrito a só 4 valores (`id`,
 *     `name`, `city`, `createdAt`) — confirmado empiricamente que pedir
 *     um campo fora desse enum (`type`, testado) derruba a chamada
 *     inteira com HTTP 500 (`{"error":"Property \"type\" was not found in
 *     \"Client\". Make sure your query is correct."}`). Ou seja: os
 *     campos de contato/documento (`document`, `email`, `business_phone`,
 *     `neighborhood`, `state`, `status`, `street_address`,
 *     `street_number`, `type`) documentados no schema de resposta **não
 *     são obtíveis via este endpoint** — só `id`, `name`, e,
 *     opcionalmente via `fields[]`, `city`/`created_at`. Implementado com
 *     `fields` restrito ao mesmo enum de 4 valores confirmado seguro, para
 *     não repetir o erro 500 com nenhuma combinação.
 *   - `fields[]=createdAt` (camelCase de entrada) mapeia corretamente para
 *     a chave de saída `created_at` (snake_case) — mesmo padrão
 *     camelCase-de-entrada/snake_case-de-saída já visto em outros
 *     endpoints Getrak Web (ex.: `GET /v1.0/users/{id}`, Epic 16).
 *
 * FILTROS confirmados individualmente:
 *   - `filters[status]` (enum `N`/`S`/`Y`) — confirmado com totais reais
 *     distintos (`Y`→1868, `S`→88), consistentes com
 *     `get_clients_summary` (`active: 1868, suspended: 88`).
 *   - `filters[type]` (`individual`/`legal-entity`) — confirmado com
 *     totais reais distintos (148 / 27).
 *   - `filters[name][inc]`, `filters[city][inc]` — busca por substring,
 *     confirmados funcionando.
 *   - `filters[id][in]` — **exige o sufixo de array `[]`**
 *     (`filters[id][in][]=<id>`, repetido por valor): confirmado com 2
 *     ids reais retornando exatamente os 2 esperados; sem o `[]`, o
 *     filtro é silenciosamente ignorado (retorna o total não filtrado).
 *     Mesmo padrão do Epic 19 (`/v1.0/operations`), oposto do Epic 13
 *     (`/v1.0/report/reports`) — ver `shared.ts`.
 *   - `filters[created_at][gte]`/`[lte]` — intervalo de criação,
 *     confirmado funcionando (total real distinto do total geral).
 *   - `order[id]`/`order[name]` confirmados FUNCIONANDO corretamente nas
 *     duas direções.
 *
 * Filtro sem correspondência retorna lista vazia normalizada
 * (`{data: [], total: 0}`), nunca erro — confirmado com um `id` inventado.
 *
 * SOBREPOSIÇÃO COM US-030 (`search_clients`, Epic 9,
 * `GET /v0.2/clientes/integracao`, `oauth2ClientCredentials`) —
 * investigada conforme instruído. Sem credencial `oauth2ClientCredentials`
 * disponível para testar US-030 ao vivo (mesma limitação já registrada
 * para todo o Epic 2/4/9), a comparação é feita contra o shape já
 * documentado/confirmado de US-030 (`ativo, cel, cel2, cnpj, descricao,
 * email, email2, endereco, ...` — nomes em português, aparentemente o
 * registro de cliente COMPLETO com contato/documento) vs. o shape
 * REALMENTE OBTÍVEL desta tool (`id`, `name`, opcionalmente `city`/
 * `created_at` — nomes em inglês, deliberadamente restrito pelo próprio
 * endpoint via o enum de `fields[]`). Diferente da sobreposição fraca já
 * registrada em US-090/US-020 (Epic 21, campos quase totalmente
 * disjuntos): aqui os dois endpoints parecem representar o MESMO
 * registro de cliente subjacente (mesma central, mesmo conceito de
 * "cliente"), mas com uma diferença real e mensurável de superfície —
 * US-030 aparenta expor o registro completo, US-061 é estruturalmente
 * limitado a um subconjunto mínimo pelo próprio endpoint (não por uma
 * escolha desta implementação). **Não consolidado nem descartado** —
 * decisão de Produto/Engenharia, sinalizada no PR; se o consumidor
 * precisar de CNPJ/telefone/e-mail de cliente, `search_clients` (Epic 9)
 * continua sendo a tool a usar, não esta.
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
  type WebClientsToolDeps,
} from "./shared.js";

const SOURCE_ENDPOINT = "GET /v1.0/client";

const SELECTABLE_FIELDS = ["id", "name", "city", "createdAt"] as const;
const SORTABLE_FIELDS = ["id", "name"] as const;

export const searchWebClientsInputSchema = z.object({
  central: centralSchema,
  name_contains: z.string().optional(),
  city_contains: z.string().optional(),
  status: z.enum(["N", "S", "Y"]).optional(),
  type: z.enum(["individual", "legal-entity"]).optional(),
  ids: z.array(z.number().int()).optional(),
  created_after: z.string().optional(),
  created_before: z.string().optional(),
  fields: z.array(z.enum(SELECTABLE_FIELDS)).optional(),
  sort_by: z.enum(SORTABLE_FIELDS).optional(),
  sort_direction: z.enum(["ASC", "DESC"]).optional(),
  ...paginationInputShape,
});

export type SearchWebClientsInput = z.infer<typeof searchWebClientsInputSchema>;

export interface SearchWebClientsData {
  clients: Record<string, unknown>[];
  pagination: ReturnType<typeof extractPagePerPageEnvelope>["meta"];
}

export function createSearchWebClientsTool(
  deps: WebClientsToolDeps,
): DomainToolRegistration<SearchWebClientsInput, SearchWebClientsData> {
  const definition: ToolDefinition<SearchWebClientsInput, SearchWebClientsData> = {
    name: "search_web_clients",
    risk: "low",
    requiresCentral: true,
    inputSchema: searchWebClientsInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const upstreamPagination = buildPagePerPagePagination(input, "per_page");
      const sortQuery = input.sort_by ? { [`order[${input.sort_by}]`]: input.sort_direction ?? "ASC" } : {};

      const raw = await callGetrakWebEndpoint<unknown>({
        deps,
        path: "/v1.0/client",
        query: {
          "filters[name][inc]": input.name_contains,
          "filters[city][inc]": input.city_contains,
          "filters[status]": input.status,
          "filters[type]": input.type,
          "filters[id][in][]": input.ids,
          "filters[created_at][gte]": input.created_after,
          "filters[created_at][lte]": input.created_before,
          "fields[]": input.fields,
          ...sortQuery,
          ...upstreamPagination.query,
        },
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
      });

      const { items, meta } = extractPagePerPageEnvelope(raw, upstreamPagination.page, upstreamPagination.page_size);

      return {
        data: { clients: items.map(normalizeItem), pagination: meta },
        endpoints: [SOURCE_ENDPOINT],
        authScheme: "oauth2Password",
      };
    },
  };

  return {
    catalogEntry: {
      name: "search_web_clients",
      description:
        "Search clients within an authorized central. Note: this endpoint only exposes id, name, city and created_at — for CNPJ/phone/email use search_clients (Epic 9) instead.",
      intent: "read",
      domain: "web_clients",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
