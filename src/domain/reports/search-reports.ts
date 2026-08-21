/**
 * US-049 — Buscar relatórios gerados.
 * Endpoint: GET /v1.0/report/reports (não depreciado, oauth2Password/
 * GetrakWeb — token delegado).
 *
 * PAGINAÇÃO — ACHADO CRÍTICO, diferente de todo o resto do domínio Getrak
 * Web já implementado (Epic 10/16/17/18/19): `page` e `per_page` (nome real
 * de wire, já confirmado pelo próprio `x-codeSamples` do openapi.json —
 * `?page=1&per_page=10` — e reconfirmado empiricamente) não são apenas
 * "opcionais com padrão no servidor" — **omitir QUALQUER um dos dois
 * (isoladamente, ou os dois juntos) produz HTTP 500 `{"error":"Internal
 * error"}`**, não uma página padrão. Confirmado isolando cada caso: sem
 * nenhum parâmetro, só `page`, só `per_page` — todos os três HTTP 500;
 * `page` + `per_page` juntos, mesmo com valores triviais (`page=1&per_page
 * =2`) — HTTP 200 normal. Isso NÃO exige nenhuma validação adicional na
 * tool: `buildPagePerPagePagination`/`normalizePagination` (usado por todo
 * o domínio Getrak Web) já preenche `page`/`page_size` com um padrão
 * concreto (1/50) quando o consumidor não os informa — ou seja, a tool
 * SEMPRE envia os dois à API Core, mesmo quando o consumidor da tool não
 * passou paginação nenhuma. Documentado aqui porque é a primeira vez neste
 * projeto que a ausência de paginação quebra a chamada (em vez de aplicar
 * um padrão do lado do servidor) — outro adapter que reutilizasse esses
 * helpers sem essa garantia teria esse mesmo problema.
 *
 * FILTROS — confirmados empiricamente, com um achado que inverte o padrão
 * do Epic 19 (Operations):
 *   - `filters[report_type][in]` e `filters[status]` aceitam múltiplos
 *     valores repetindo a MESMA chave de query, **SEM sufixo de array
 *     `[]`** (ex.: `filters[report_type][in]=km_traveled&filters
 *     [report_type][in]=speed`) — confirmado com union real: filtro
 *     isolado por `km_traveled` retornou `total=80`, isolado por `speed`
 *     retornou `total=254`, e os dois juntos (chave repetida) retornaram
 *     exatamente `total=334` (80+254, sem sobreposição). **Adicionar o
 *     sufixo `[]` (`filters[report_type][in][]=...`) FAZ O FILTRO SER
 *     SILENCIOSAMENTE IGNORADO** — retorna o total não filtrado (1203) em
 *     vez de erro. Ou seja, o OPOSTO exato do achado do Epic 19
 *     (`/v1.0/operations`, onde faltar o `[]` quebrava a chamada com HTTP
 *     500). Confirma, de forma concreta, a disciplina do projeto de nunca
 *     assumir o formato de wire de um endpoint por analogia com outro já
 *     implementado — cada um foi validado isoladamente antes de codificar.
 *     Implementado com a chave de query `"filters[report_type][in]"`
 *     (SEM `[]`) mapeada a um array — o serializador de query do
 *     `ApiCoreClient` já repete a chave por item de array sem adicionar
 *     `[]`, compatível com o formato real confirmado aqui.
 *   - `filters[status]` segue exatamente o mesmo padrão (`status=1` sozinho
 *     → `total=50`; `status=3` sozinho → `total=905`; os dois juntos,
 *     chave repetida sem `[]` → `total=955`, exatamente a soma).
 *   - `filters[created_at_start]`/`filters[created_at_end]` (intervalo de
 *     criação) confirmados funcionando com valores ISO 8601 reais.
 *   - `order[created_at]` (ASC/DESC) CONFIRMADO FUNCIONANDO corretamente
 *     (ordenação real observada nas duas direções) — diferente do
 *     `order[date]` do Epic 19, que estava quebrado no backend. Exposto
 *     como `sort_direction`.
 *   - `filters[user_id]`, `filters[report_scheduling_id]` (+ `[is_null]`)
 *     e `include[]` (documentados, opcionais) não são expostos como
 *     parâmetros da tool nesta rodada — não testados (fora dos filtros
 *     citados como exemplo pela spec: tipo, período, status); reduzir a
 *     superfície de risco em vez de adivinhar contra produção, mesma
 *     disciplina já aplicada a `fields[]`/parâmetros não testados em
 *     outros domínios Getrak Web.
 *
 * Envelope de sucesso confirmado como o padrão `{data, page, pages, total}`
 * do resto do domínio Getrak Web — `extractPagePerPageEnvelope` aplicado
 * sem alteração. Filtro sem correspondência retorna lista vazia normalizada
 * (`{data: [], total: 0}`), nunca erro — confirmado com um `user_id`
 * inexistente e um `report_type` inventado, ambos HTTP 200.
 *
 * O item de resposta inclui `link` — uma URL S3 pré-assinada (com
 * assinatura/expiração) para baixar o arquivo do relatório quando pronto
 * (`status`, `error`) — repassado como veio, sem tratamento especial; é o
 * mesmo padrão de "repassar como recebido" já usado para outros campos
 * tipo-URL/credencial em outros domínios (ex.: `credentials.token` em
 * `search_central_integrations`), não um dado de acesso a sistemas
 * internos do MCP.
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
  type ReportsToolDeps,
} from "./shared.js";

const SOURCE_ENDPOINT = "GET /v1.0/report/reports";

export const searchReportsInputSchema = z.object({
  central: centralSchema,
  report_types: z.array(z.string().min(1)).optional(),
  statuses: z.array(z.number().int()).optional(),
  created_after: z.string().optional(),
  created_before: z.string().optional(),
  sort_direction: z.enum(["ASC", "DESC"]).optional(),
  ...paginationInputShape,
});

export type SearchReportsInput = z.infer<typeof searchReportsInputSchema>;

export interface SearchReportsData {
  reports: Record<string, unknown>[];
  pagination: ReturnType<typeof extractPagePerPageEnvelope>["meta"];
}

export function createSearchReportsTool(
  deps: ReportsToolDeps,
): DomainToolRegistration<SearchReportsInput, SearchReportsData> {
  const definition: ToolDefinition<SearchReportsInput, SearchReportsData> = {
    name: "search_reports",
    risk: "low",
    requiresCentral: true,
    inputSchema: searchReportsInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const upstreamPagination = buildPagePerPagePagination(input, "per_page");

      const raw = await callGetrakWebEndpoint<unknown>({
        deps,
        path: "/v1.0/report/reports",
        query: {
          "filters[report_type][in]": input.report_types,
          "filters[status]": input.statuses,
          "filters[created_at_start]": input.created_after,
          "filters[created_at_end]": input.created_before,
          "order[created_at]": input.sort_direction,
          ...upstreamPagination.query,
        },
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
      });

      const { items, meta } = extractPagePerPageEnvelope(raw, upstreamPagination.page, upstreamPagination.page_size);

      return {
        data: { reports: items.map(normalizeItem), pagination: meta },
        endpoints: [SOURCE_ENDPOINT],
        authScheme: "oauth2Password",
      };
    },
  };

  return {
    catalogEntry: {
      name: "search_reports",
      description: "Search generated reports (type, status, creation period) within an authorized central.",
      intent: "read",
      domain: "reports",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
