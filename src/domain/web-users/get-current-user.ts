/**
 * US-069 — Consultar dados do usuário autenticado.
 * Endpoint: GET /oauth/usuario (não depreciado, oauth2Password/GetrakWeb —
 * token delegado; também exposto em /newkoauth/usuario, não usado aqui).
 *
 * "Sem parâmetros de entrada" (Tool Contract da spec) refere-se a parâmetros
 * de NEGÓCIO (nenhum id, nenhum filtro) — a tool sempre resolve a sessão
 * delegada ativa. `central` continua sendo exigido como entrada mesmo assim:
 * é o gate de autorização transversal e a chave de resolução/cache do token
 * delegado (CLAUDE.md Seção 3/US-048) — mesmo padrão já aplicado em
 * `get_accessories_summary`/`get_centrals`, endpoints que também não
 * recebem nenhum parâmetro de negócio. Reconciliação sinalizada aqui, não
 * uma suposição silenciosa: CLAUDE.md (regra transversal) prevalece sobre a
 * leitura literal da spec quando as duas conflitam (CLAUDE.md, Seção 11).
 *
 * ACHADO REAL contra homologação nesta rodada (mesma disciplina do Epic
 * 3/10, CLAUDE.md Seção 7) — a resposta real tem MUITO mais campos que o
 * documentado no openapi.json (`{id, login, nome, sistema, timezone,
 * permissao, email}`):
 *
 *   Resposta real: `{id, login, nome, sistema, centralId, email, timezone,
 *   permissao, perfil, ativo, senhatemp, tipo, uid, acessoWs}`.
 *
 * GAP DO EPIC 10 (US-040/US-042 — como o MCP obtém o papel do usuário para
 * a regra de visibilidade ADMIN/OPERADOR vs. CLIENTE/SUBCLIENTE):
 *   - `permissao` (documentado) é um array de flags de permissão GRANULARES
 *     por funcionalidade (`#/components/schemas/permission` — ex.: 6=Fence,
 *     2=Reference point, 28=Administrative panel), não uma classificação de
 *     papel do usuário. NÃO resolve o gap.
 *   - `tipo` (inteiro, ex.: `1`) e `perfil` (inteiro, ex.: `0`) são campos
 *     REAIS e NÃO DOCUMENTADOS no openapi.json. São candidatos fortes: o
 *     endpoint `GET /v1.1/users` (US-068) documenta um filtro `type` com
 *     exatamente a taxonomia do gap (`admin|operator|client|subclient|
 *     atende`), sugerindo que o `tipo` inteiro aqui seja a mesma
 *     classificação em forma numérica; `perfil` pode corresponder a
 *     `profile_id` (mesmo filtro de US-068, ou ao domínio `get_user_profiles`
 *     do Epic 9). NENHUMA fonte disponível (openapi.json, PRD, Technical
 *     Brief, nenhuma spec) confirma o mapeamento inteiro→papel — por
 *     instrução explícita desta tarefa, esse mapeamento NÃO foi inventado.
 *   - CONCLUSÃO: o gap do Epic 10 **permanece aberto** — mas com uma pista
 *     concreta e nova (campos exatos + endpoint) que não existia antes desta
 *     rodada. `tipo`/`perfil` são expostos como estão na resposta
 *     normalizada (não usados para nenhuma lógica de filtragem no MCP);
 *     recomenda-se à Engenharia confirmar o mapeamento de `tipo` antes de
 *     qualquer tentativa futura de fechar o gap com base nele. Nenhuma
 *     mudança feita em `search_geofences`/`search_reference_points`.
 *
 * MINIMIZAÇÃO (CLAUDE.md Seção 8): `uid` (string hexadecimal longa,
 * formato de identificador de sessão/dispositivo) é OMITIDO da resposta
 * normalizada — divergente do precedente geral de "repassar como recebido"
 * (ex.: `credentials.token` em `search_central_integrations`, cnpj/email em
 * Epic 9), decisão pontual porque este campo específico não tem valor de
 * negócio conhecido para o consumidor e tem formato de credencial/token
 * opaco (CLAUDE.md lista "tokens"/"identificadores" como sensíveis);
 * sinalizado aqui, não uma aplicação silenciosa de uma regra nova.
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import { callGetrakWebEndpoint, centralSchema, normalizeItem, type WebUsersToolDeps } from "./shared.js";

const SOURCE_ENDPOINT = "GET /oauth/usuario";

/** Campos omitidos deliberadamente da resposta normalizada — ver comentário do topo do arquivo. */
const OMITTED_FIELDS = new Set(["uid"]);

export const getCurrentUserInputSchema = z.object({
  central: centralSchema,
});

export type GetCurrentUserInput = z.infer<typeof getCurrentUserInputSchema>;

export interface GetCurrentUserData {
  user: Record<string, unknown>;
}

export function createGetCurrentUserTool(
  deps: WebUsersToolDeps,
): DomainToolRegistration<GetCurrentUserInput, GetCurrentUserData> {
  const definition: ToolDefinition<GetCurrentUserInput, GetCurrentUserData> = {
    name: "get_current_user",
    risk: "low",
    requiresCentral: true,
    inputSchema: getCurrentUserInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const raw = await callGetrakWebEndpoint<Record<string, unknown>>({
        deps,
        path: "/oauth/usuario",
        query: {},
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
      });

      const filtered = Object.fromEntries(
        Object.entries(raw && typeof raw === "object" ? raw : {}).filter(([key]) => !OMITTED_FIELDS.has(key)),
      );
      const user = normalizeItem(filtered);

      return {
        data: { user },
        endpoints: [SOURCE_ENDPOINT],
        authScheme: "oauth2Password",
      };
    },
  };

  return {
    catalogEntry: {
      name: "get_current_user",
      description:
        "Get the data of the currently authenticated Getrak Web user (the owner of the active delegated session). Takes no business parameters.",
      intent: "read",
      domain: "web_users",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
