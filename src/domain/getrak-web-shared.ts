/**
 * Helpers compartilhados por TODOS os domínios do Epic 10 (accessories,
 * integrations, perimeters — US-035 a US-042, exceto US-038/US-032 fora de
 * escopo). Os endpoints desses domínios usam `oauth2Password`, escopo
 * `GetrakWeb` — token DELEGADO do usuário (US-046/047/048), não credencial
 * técnica — confirmado individualmente contra `reference/openapi.json`
 * (v1.0, nenhum depreciado) para cada endpoint consumido.
 *
 * Extraído para um módulo comum (em vez de duplicado em cada
 * `domain/<x>/shared.ts`, como Epic 2/4/9 fazem com seus próprios esquemas)
 * porque aqui as 3 constantes (esquema, escopo) e a lógica de resolução do
 * token delegado são idênticas nos 3 domínios — só o path do endpoint e o
 * shape de query/resposta mudam por tool.
 *
 * Nenhum destes endpoints aceita `sistema`/central como parâmetro de
 * request (confirmado contra o openapi.json) — diferente de Epic 2/4/9. A
 * identidade do usuário Getrak autenticado (token delegado) já é
 * inerentemente ligada a uma central, então não há parâmetro de filtro
 * correspondente a enviar; `central` continua sendo exigido como parâmetro
 * de entrada da tool (gate de autorização do MCP e chave do cache de token
 * delegado, CLAUDE.md Seção 3 / US-048), mas nunca é repassado ao endpoint.
 */

import type { Environment } from "../config/environment.js";
import { DEFAULT_DELEGATED_SESSION_ID, type DelegatedTokenManager } from "../foundation/auth/delegated-token-manager.js";
import type { ApiCoreClient, ApiCoreQueryValue } from "../foundation/http/api-core-client.js";

export const GETRAK_WEB_AUTH_SCHEME = "oauth2Password" as const;
export const GETRAK_WEB_SCOPE = "GetrakWeb" as const;

export interface GetrakWebToolDeps {
  apiCoreClient: ApiCoreClient;
  delegatedTokenManager: DelegatedTokenManager;
}

export interface CallGetrakWebEndpointParams {
  deps: GetrakWebToolDeps;
  path: string;
  query: Record<string, ApiCoreQueryValue | ApiCoreQueryValue[]>;
  environment: Environment;
  central: string;
  /** Identidade do usuário Getrak (por ora, `consumer.consumer_id` — ver CLAUDE.md Seção 6.2/US-046). */
  userId: string;
}

export function callGetrakWebEndpoint<T>(params: CallGetrakWebEndpointParams): Promise<T> {
  return params.deps.apiCoreClient.get<T>({
    path: params.path,
    query: params.query,
    environment: params.environment,
    central: params.central,
    authScheme: GETRAK_WEB_AUTH_SCHEME,
    delegatedTokenProvider: () =>
      params.deps.delegatedTokenManager.getAccessToken({
        environment: params.environment,
        central: params.central,
        userId: params.userId,
        sessionId: DEFAULT_DELEGATED_SESSION_ID,
      }),
  });
}
