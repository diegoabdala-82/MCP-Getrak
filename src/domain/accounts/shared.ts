/**
 * Helpers compartilhados pelas tools do domínio Accounts (Epic 9 —
 * Clientes, Subclientes, Perfis e Centrais; US-030, US-031, US-033, US-034).
 * Os 4 endpoints usam `oauth2ClientCredentials`, escopo `Integracao` — mesmo
 * esquema já usado em Veículos (Epic 2) e Equipamentos (Epic 4), confirmado
 * individualmente contra `reference/openapi.json` para cada um dos 4
 * (versão v0.2, não depreciada; os 4 equivalentes v0.1 estão `deprecated: true`).
 *
 * Nome do domínio ("accounts") é uma decisão de categorização do catálogo
 * MCP (`foundation/catalog/tool-catalog.ts`), não uma nomenclatura definida
 * em spec — as 4 entidades (clientes, subclientes, perfis, centrais) não têm
 * um nome de domínio único e explícito nas fontes disponíveis; agrupadas
 * aqui por serem, em conjunto, entidades de cadastro/conta e não
 * operacionais (ao contrário de veículo/localização/equipamento/ordem de
 * serviço). Sinalizado no PR — reavaliar se uma spec futura definir nome
 * diferente.
 *
 * US-032 (GET /v0.2/usuarios/integracao, consultar usuários) foi
 * deliberadamente deixada fora deste domínio nesta rodada: o openapi.json
 * documenta esse endpoint sob `oauth2Password` + escopo `Integracao`
 * (GAP-018, CLAUDE.md Seção 9) — combinação atípica frente ao modelo híbrido
 * de identidade (TD-05, CLAUDE.md Seção 6) que ainda não foi esclarecida
 * pela Engenharia.
 */

import type { Environment } from "../../config/environment.js";
import type { ApiCoreClient, ApiCoreQueryValue } from "../../foundation/http/api-core-client.js";
import { buildLimitOffsetPagination } from "../shared.js";

export { centralSchema, paginationInputShape, normalizeItem, extractArray, buildPaginationMeta } from "../shared.js";

export const ACCOUNTS_AUTH_SCHEME = "oauth2ClientCredentials" as const;

export interface AccountsToolDeps {
  apiCoreClient: ApiCoreClient;
}

/**
 * Nome do parâmetro de limite varia por endpoint dentro do próprio domínio
 * (`limit` em clientes/subclientes, `limite` em perfis) — confirmado
 * individualmente contra reference/openapi.json, mesma heterogeneidade já
 * prevista em ED-01 e observada em Veículos/Equipamentos.
 */
export function buildUpstreamPagination(
  input: { page?: number; page_size?: number },
  limitParamName: "limit" | "limite",
): { query: Record<string, number>; page: number; page_size: number } {
  return buildLimitOffsetPagination(input, limitParamName);
}

export interface CallAccountsEndpointParams {
  apiCoreClient: ApiCoreClient;
  path: string;
  query: Record<string, ApiCoreQueryValue>;
  environment: Environment;
  central: string;
}

export function callAccountsEndpoint<T>(params: CallAccountsEndpointParams): Promise<T> {
  return params.apiCoreClient.get<T>({
    path: params.path,
    query: params.query,
    environment: params.environment,
    central: params.central,
    authScheme: ACCOUNTS_AUTH_SCHEME,
  });
}
