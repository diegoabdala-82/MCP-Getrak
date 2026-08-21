/**
 * Helpers compartilhados pelas 10 tools do domínio Journeys (Epic 20,
 * Release 3, novo 20/08/2026 — US-080 a US-089). Domínio novo — nome de
 * catálogo `journeys` (sem prefixo `web_`), mesma convenção já usada para
 * `operations`/`reports`/`notifications`/`maintenance` (domínios GetrakWeb
 * sem contraparte técnica a desambiguar). Todos os 10 endpoints usam
 * `oauth2Password`/`GetrakWeb` (token delegado — ver
 * `domain/getrak-web-shared.ts`).
 *
 * GAP-020 — DUAS versões vigentes simultaneamente (`v1.0` e `v2.0`) para
 * `GET /journeys` e `GET /journeys/drivers`, exceção real à regra geral do
 * projeto de "só existe uma versão vigente por vez" (confirmado no
 * `openapi.json`: nenhuma das duas tem `deprecated: true`). Resolvido por
 * decisão de Engenharia (16/08/2026, "Opção A", ver specs US-080/US-083):
 * `search_journeys`/`search_drivers` são tools ÚNICAS — v2.0 como fonte
 * primária, com fallback interno para v1.0 só em caso de falha/lacuna de
 * v2.0. A versão nunca é exposta como parâmetro de tool nem escolhida pelo
 * agente — ver `callWithV1Fallback` abaixo.
 *
 * A tag `Journeys` do openapi.json também documenta várias operações de
 * ESCRITA (`POST`/`PUT`/`DELETE` de viagens, motoristas, identificadores,
 * reprocessamento, fechamento de viagem, vínculo em lote de veículos a
 * motorista) — confirmado por inspeção completa da tag antes de codificar;
 * NENHUMA delas foi implementada aqui, conforme instruído.
 *
 * ACHADO CRÍTICO — o endpoint de FALLBACK de `search_drivers` está
 * QUEBRADO: `GET /v1.0/journeys/drivers` retorna HTTP 500
 * (`{"error":"Internal error"}`) para QUALQUER chamada testada, inclusive
 * sem nenhum parâmetro. Não é um filtro específico quebrado (como em
 * outros achados do projeto) — é o endpoint inteiro. Confirmado que os
 * endpoints vizinhos `/v1.0/journeys/drivers/summary` e
 * `/v1.0/journeys/drivers/{id}` (ambos v1.0) funcionam normalmente — só a
 * LISTA v1.0 está quebrada. O fallback para `search_drivers` foi
 * implementado mesmo assim, exatamente como pedido pela spec/tarefa (a
 * decisão de arquitetura não condiciona a implementação a v1.0 estar
 * saudável), mas isso significa que, na prática, se `v2.0/journeys/drivers`
 * algum dia falhar de verdade em produção, o fallback vai FALHAR TAMBÉM
 * (retorna o erro normalizado da falha do v1.0, nunca um crash — mas não
 * há ganho real de resiliência até a Getrak corrigir o endpoint v1.0). Não
 * inventado nenhum valor para mascarar isso — sinalizado aqui e no PR.
 *
 * ACHADO — `include[]=driver` tem SHAPE DIFERENTE entre v1.0 e v2.0 de
 * `GET /journeys`: v1.0 devolve `{id, name, email, document, system,
 * device}`; v2.0 devolve só `{id, name}`. Ou seja, o fallback NÃO é
 * schema-transparente para esse include específico — um consumidor que
 * dependesse dos campos extras do v1.0 (email/document/system/device)
 * veria menos campos quando a chamada é servida por v2.0 (o caso normal).
 * Não corrigido/normalizado artificialmente (não inventar campos que a API
 * não devolveu) — apenas documentado.
 *
 * ACHADO — `GET /v2.0/journeys`, `filters[client_id]`: documentado como
 * "Admin/operator only: ... Ignored for client/subclient users" — mas
 * testado contra produção real (usuário de teste não-admin) e confirmado
 * que qualquer valor de `client_id` diferente de `0` retorna HTTP 500
 * (`client_id=0` retorna 200 normalmente). Ou seja, o filtro NÃO é
 * silenciosamente ignorado como a documentação promete — quebra a chamada.
 * Por isso `client_id` NÃO é exposto como parâmetro de `search_journeys`
 * (mesmo padrão de "não expor parâmetro confirmadamente quebrado" já usado
 * no Epic 19 para `order[date]`).
 *
 * ACHADO — `GET /v2.0/journeys/drivers`, `filters[id][in][]` (e a variante
 * sem o sufixo `[]`): confirmado que o filtro é SILENCIOSAMENTE IGNORADO —
 * a chamada retorna 200 com o total não filtrado, não os ids pedidos. Por
 * isso `search_drivers` não expõe um filtro de múltiplos ids (o filtro
 * singular `filters[id]`, exato, funciona e não está documentado, mas não
 * foi pedido por nenhuma User Story deste epic — não exposto).
 *
 * PAGINAÇÃO — confirmado empiricamente que TODOS os endpoints paginados
 * deste domínio usam o mesmo envelope `{data, page, pages, total}` já visto
 * no resto do domínio Getrak Web, com o mesmo bug de sempre (`perPage`
 * ignorado, `per_page` respeitado) — em ambas as versões (v1.0 e v2.0) dos
 * dois endpoints com fallback. Exceção: `GET /v1.0/journeys/vehicles/
 * available` não pagina sob nenhuma convenção testada (`page`, `per_page`)
 * — sempre retorna a lista completa (`{data: [...]}`, sem chaves de
 * paginação) — tratado com `createClientSideSliceAdapter` (mesmo padrão de
 * `get_centrals`/`search_equipment_tags`).
 *
 * ACHADO — `GET /v2.0/journeys/drivers/{id}` (US-084) responde HTTP 204
 * (sem corpo) para um id inexistente, não 404. Corrigido na fundação
 * (`ApiCoreClient.get`, ver comentário lá) para tratar 204 como "sem
 * corpo" em vez de tentar fazer parse de JSON vazio (que virava
 * INTERNAL_ERROR genérico); a tool de detalhe verifica isso e lança
 * `DRIVER_NOT_FOUND` explicitamente.
 */

import { ErrorCodes, McpToolError } from "../errors.js";
import type { ApiCoreQueryValue } from "../../foundation/http/api-core-client.js";

export { GETRAK_WEB_AUTH_SCHEME, GETRAK_WEB_SCOPE, callGetrakWebEndpoint } from "../getrak-web-shared.js";
export type { GetrakWebToolDeps as JourneysToolDeps } from "../getrak-web-shared.js";
export {
  centralSchema,
  paginationInputShape,
  normalizeItem,
  extractPagePerPageEnvelope,
  buildPagePerPagePagination,
} from "../shared.js";
export { normalizePagination, createClientSideSliceAdapter } from "../../foundation/pagination/pagination.js";

import { callGetrakWebEndpoint, type GetrakWebToolDeps } from "../getrak-web-shared.js";
import type { Environment } from "../../config/environment.js";

/** Códigos de erro upstream que justificam tentar o fallback v1.0 — falha real da API, não erro de validação/autorização do MCP. */
const FALLBACK_ELIGIBLE_CODES: readonly string[] = [
  ErrorCodes.UPSTREAM_ERROR,
  ErrorCodes.UPSTREAM_UNAVAILABLE,
  ErrorCodes.TIMEOUT,
];

function isFallbackEligible(err: unknown): boolean {
  return err instanceof McpToolError && FALLBACK_ELIGIBLE_CODES.includes(err.code);
}

export interface CallWithV1FallbackParams {
  deps: GetrakWebToolDeps;
  environment: Environment;
  central: string;
  userId: string;
  v2: { path: string; query: Record<string, ApiCoreQueryValue | ApiCoreQueryValue[]> };
  v1: { path: string; query: Record<string, ApiCoreQueryValue | ApiCoreQueryValue[]> };
}

export interface CallWithV1FallbackResult<T> {
  raw: T;
  /** true quando a chamada foi efetivamente servida por v1.0 (v2.0 falhou antes). Nunca exposto ao agente — só para warnings internos/observabilidade. */
  usedFallback: boolean;
}

/**
 * GAP-020 (US-080/US-083) — tenta `v2.0` primeiro; se a falha for uma falha
 * real de upstream (não validação/autorização, que nem chegam aqui — o
 * `ToolRuntime` já bloqueia antes do handler), tenta `v1.0` internamente.
 * A escolha de versão nunca é exposta ao agente chamador — apenas o
 * resultado final, normalizado da mesma forma independente de qual versão
 * respondeu.
 */
export async function callWithV1Fallback<T>(params: CallWithV1FallbackParams): Promise<CallWithV1FallbackResult<T>> {
  try {
    const raw = await callGetrakWebEndpoint<T>({
      deps: params.deps,
      path: params.v2.path,
      query: params.v2.query,
      environment: params.environment,
      central: params.central,
      userId: params.userId,
    });
    return { raw, usedFallback: false };
  } catch (err) {
    if (!isFallbackEligible(err)) {
      throw err;
    }
    const raw = await callGetrakWebEndpoint<T>({
      deps: params.deps,
      path: params.v1.path,
      query: params.v1.query,
      environment: params.environment,
      central: params.central,
      userId: params.userId,
    });
    return { raw, usedFallback: true };
  }
}
