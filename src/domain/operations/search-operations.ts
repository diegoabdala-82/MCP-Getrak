/**
 * US-079 — Consultar operações (audit trail de mudanças internas).
 * Endpoint: GET /v1.0/operations (não depreciado, oauth2Password/GetrakWeb —
 * token delegado). Único endpoint de leitura da tag `Operations` no
 * `openapi.json` — confirmado que nenhum outro path usa essa tag (nenhum
 * risco de replicar acidentalmente uma operação de escrita adjacente).
 *
 * FILTROS OBRIGATÓRIOS — confirmado tanto no `openapi.json`
 * (`filters[operation_type][in]`, `filters[entity_id]` e `filters[date]`
 * marcados `required: true`) quanto EMPIRICAMENTE contra homologação nesta
 * rodada, antes de codificar:
 *   - Omitir qualquer um dos 3 (isoladamente ou em combinação) não produz um
 *     HTTP 400 limpo — produz **HTTP 500 `{"error":"Internal error"}`**, um
 *     erro genérico de servidor sem nenhuma informação de qual filtro
 *     faltou. Isso confirma, de forma concreta (não hipotética), a
 *     instrução da tarefa de validar os 3 filtros no MCP ANTES de chamar a
 *     API Core — sem essa validação client-side, o consumidor receberia um
 *     `UPSTREAM_ERROR` genérico e enganoso em vez de um erro de validação
 *     claro. A validação client-side já é obtida "de graça": os 3 campos
 *     são obrigatórios no schema Zod da tool, e `ToolRuntime.execute()`
 *     roda `inputSchema.parse()` ANTES de invocar `handler` (portanto antes
 *     de qualquer chamada à API Core) — um Zod `required` ausente vira
 *     `VALIDATION_ERROR` sem nenhum round-trip à rede.
 *   - **Formato real de wire para `filters[operation_type][in]` exige o
 *     sufixo de array `[]`** — `filters[operation_type][in][]=<valor>`
 *     (repetido por valor, para múltiplos tipos). Sem o `[]` (só
 *     `filters[operation_type][in]=device`), a API retorna o MESMO HTTP 500
 *     genérico acima, mesmo com os 3 filtros logicamente presentes —
 *     confirmado isolando esse único fator antes de assumir o formato do
 *     `openapi.json` (que não deixa claro se o `[]` faz parte do nome real
 *     do parâmetro). Implementado com o array mapeado para a chave de query
 *     `"filters[operation_type][in][]"` (o serializador de query do
 *     `ApiCoreClient` já repete a chave por item de array — comportamento
 *     compatível, confirmado com múltiplos valores reais).
 *
 * `order[date]` (documentado, opcional) — CONFIRMADO QUEBRADO NO BACKEND,
 * NÃO EXPOSTO NESTA TOOL: todo valor testado (`ASC`, `DESC`, `asc`) produziu
 * HTTP 500 com erro de banco/validação vazando bruto
 * (`"Unknown column 'distinctAlias.operation_data' in 'field list'"` para
 * valores válidos; `"SelectQueryBuilder.addOrderBy \"order\" can accept
 * only \"ASC\" and \"DESC\" values."` para valor inválido). Diferente de
 * "não testado" — é uma falha CONFIRMADA e repetível do endpoint real para
 * TODO valor tentado. Repassar esse parâmetro sempre quebraria a chamada;
 * por isso não é exposto como parâmetro de entrada da tool (CLAUDE.md Seção
 * 3: nunca repassar erro bruto da API Core — a única forma de cumprir isso
 * aqui é não oferecer o parâmetro que sempre dispara esse erro).
 * Sinalizado para Engenharia/Produto — se a ordenação for necessária no
 * futuro, precisa de correção no backend antes de ser exposta pelo MCP.
 *
 * PAGINAÇÃO — não reconfirmada com dados reais nesta rodada (diferente dos
 * Epics 10/16/17/18, onde a distinção `perPage`/`per_page` foi observada
 * com resultados não vazios): nenhuma combinação de tipo/entidade/data
 * tentada nesta central de demonstração retornou nenhum registro
 * (`total: 0`), então não foi possível observar truncamento real de página.
 * `per_page`/`page` foram aceitos sem erro (200, envelope padrão). Aplicado
 * `per_page` (não `perPage`) por forte precedente já confirmado repetidas
 * vezes em todo o restante do domínio Getrak Web (Epic 10/16/17/18) — não
 * reconfirmado de forma independente para este endpoint específico com
 * resultado não vazio; sinalizado aqui em vez de apresentado como
 * confirmação nova.
 *
 * Envelope de sucesso real confirmado como o padrão `{data, page, pages,
 * total}` do resto do domínio Getrak Web — `extractPagePerPageEnvelope`
 * aplicado sem alteração. Filtro sem correspondência retorna lista vazia
 * normalizada (`{data: [], total: 0, pages: 0, page: 1}`), nunca erro —
 * confirmado nesta mesma rodada de testes (dezenas de combinações
 * tipo/entidade/data, todas HTTP 200 com lista vazia).
 *
 * `fields[]` (documentado, opcional) não é exposto como parâmetro da tool —
 * não testado nesta rodada (fora do escopo obrigatório da tarefa) e mais de
 * um outro endpoint Getrak Web já mostrou comportamento de erro (HTTP 500)
 * para seletores de campo mal formados (Epic 16/`get_user_details`, Epic
 * 9/`search_accessories`); reduzir a superfície de risco em vez de
 * adivinhar contra produção.
 *
 * Nomenclatura: o filtro de entrada documentado é `operation_type`
 * (singular, com modificador `[in]` para múltiplos valores); exposto aqui
 * como `operation_types` (plural) para refletir que a tool sempre aceita
 * uma lista. O campo de saída correspondente no item de resposta é `type`,
 * não `operation_type`/`operation_types` — repassado como veio (sem
 * renomear a resposta upstream).
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
  type OperationsToolDeps,
} from "./shared.js";

const SOURCE_ENDPOINT = "GET /v1.0/operations";

const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

export const searchOperationsInputSchema = z.object({
  central: centralSchema,
  operation_types: z
    .array(z.string().min(1))
    .min(1, "operation_types is required and must contain at least one value"),
  entity_id: z.string().min(1, "entity_id is required"),
  date: z
    .string()
    .regex(DATE_FORMAT, "date is required and must be in YYYY-MM-DD format"),
  ...paginationInputShape,
});

export type SearchOperationsInput = z.infer<typeof searchOperationsInputSchema>;

export interface SearchOperationsData {
  operations: Record<string, unknown>[];
  pagination: ReturnType<typeof extractPagePerPageEnvelope>["meta"];
}

export function createSearchOperationsTool(
  deps: OperationsToolDeps,
): DomainToolRegistration<SearchOperationsInput, SearchOperationsData> {
  const definition: ToolDefinition<SearchOperationsInput, SearchOperationsData> = {
    name: "search_operations",
    risk: "low",
    requiresCentral: true,
    inputSchema: searchOperationsInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const upstreamPagination = buildPagePerPagePagination(input, "per_page");

      const raw = await callGetrakWebEndpoint<unknown>({
        deps,
        path: "/v1.0/operations",
        query: {
          "filters[operation_type][in][]": input.operation_types,
          "filters[entity_id]": input.entity_id,
          "filters[date]": input.date,
          ...upstreamPagination.query,
        },
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
      });

      const { items, meta } = extractPagePerPageEnvelope(raw, upstreamPagination.page, upstreamPagination.page_size);

      return {
        data: { operations: items.map(normalizeItem), pagination: meta },
        endpoints: [SOURCE_ENDPOINT],
        authScheme: "oauth2Password",
      };
    },
  };

  return {
    catalogEntry: {
      name: "search_operations",
      description:
        "Search internal audit-trail operations (change history) for an entity within an authorized central. Requires operation_types, entity_id, and date filters.",
      intent: "read",
      domain: "operations",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
