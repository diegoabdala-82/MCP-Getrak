/**
 * Helpers compartilhados pelas tools do domínio Ordens de Serviço (Epic 5,
 * US-022 a US-025).
 *
 * DECISÃO DE IMPLEMENTAÇÃO (sinalizada, não uma suposição silenciosa): os 4
 * endpoints reais aceitam AMBOS os esquemas de autenticação — confirmado em
 * reference/openapi.json, `security: [{oauth2Password: [GetrakWeb,
 * ...]}, {oauth2ClientCredentials: [Integracao]}]` — e nem a spec de
 * nenhuma User Story nem o CLAUDE.md determinam qual priorizar
 * (CLAUDE.md Seção 6 apenas reconhece que "algumas tools... aceitam ambos
 * dependendo do escopo"). A arquitetura da fundação (`ToolDefinition`/
 * `ApiCoreClient`) associa um único `authScheme` por tool, não "tenta
 * ambos". Escolhido `oauth2ClientCredentials`/`Integracao` por consistência
 * com os domínios Veículos e Equipamentos (mesmo esquema/escopo já usado
 * nesses domínios) e por ser o tipo de credencial mais adequado a um
 * servidor MCP não-interativo. Se isso se provar incorreto em homologação
 * (ex.: só a credencial `oauth2Password`/`GetrakWeb` estiver de fato
 * provisionada), trocar é uma mudança de uma linha nesta constante — nenhuma
 * lógica de tool depende de qual esquema é usado.
 */

import type { Environment } from "../../config/environment.js";
import type { ApiCoreClient, ApiCoreQueryValue } from "../../foundation/http/api-core-client.js";

export { centralSchema, paginationInputShape, normalizeItem, extractArray, buildPaginationMeta } from "../shared.js";

export const WORK_ORDERS_AUTH_SCHEME = "oauth2ClientCredentials" as const;

export interface WorkOrdersToolDeps {
  apiCoreClient: ApiCoreClient;
}

export interface CallWorkOrdersEndpointParams {
  apiCoreClient: ApiCoreClient;
  path: string;
  query: Record<string, ApiCoreQueryValue>;
  environment: Environment;
  central: string;
  notFoundCode?: string;
}

export function callWorkOrdersEndpoint<T>(params: CallWorkOrdersEndpointParams): Promise<T> {
  return params.apiCoreClient.get<T>({
    path: params.path,
    query: params.query,
    environment: params.environment,
    central: params.central,
    authScheme: WORK_ORDERS_AUTH_SCHEME,
    notFoundCode: params.notFoundCode,
  });
}
