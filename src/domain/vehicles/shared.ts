/**
 * Helpers compartilhados pelas tools do domínio Veículos (Epic 2, US-008 a
 * US-012). Todos os 5 endpoints de origem usam `oauth2ClientCredentials`,
 * escopo `Integracao` (confirmado em `reference/openapi.json`).
 *
 * Nenhum dos 5 endpoints (`/v0.2/veiculos/...`) aceita `central` como
 * parâmetro de request (nem query, nem path) — ver nota em
 * `foundation/auth/secrets-provider.ts`. Por isso `central` aqui só é usado
 * para: (a) validação de autorização (US-002) e (b) resolução da credencial
 * técnica correta via `ApiCoreClient`/`AuthManager`; nunca é enviado como
 * query param a estes endpoints.
 */

import type { Environment } from "../../config/environment.js";
import type { ApiCoreClient, ApiCoreQueryValue } from "../../foundation/http/api-core-client.js";
import { buildLimitOffsetPagination } from "../shared.js";

export { centralSchema, paginationInputShape, normalizeItem, extractArray, buildPaginationMeta } from "../shared.js";

export const VEHICLES_AUTH_SCHEME = "oauth2ClientCredentials" as const;

export interface VehiclesToolDeps {
  apiCoreClient: ApiCoreClient;
}

/**
 * Alguns endpoints deste domínio (`/v0.2/veiculos/categorias`,
 * `/v0.2/veiculos/integracao/veiculoSuspenderIntegracao`) declaram no
 * `openapi.json` um schema de resposta `type: object` (um único registro),
 * mas o nome/descrição do endpoint e a presença de parâmetros de paginação
 * sugerem fortemente que a resposta real é uma lista. Esta é uma
 * inconsistência conhecida da API Core (PRD/Contexto: "objetos
 * inconsistentes"). Ver `extractArray` (domain/shared.ts) para o tratamento
 * defensivo comum a ambas as formas.
 */
export function buildUpstreamPagination(
  input: { page?: number; page_size?: number },
  limitParamName: "limite" | "limit",
): { query: Record<string, number>; page: number; page_size: number } {
  return buildLimitOffsetPagination(input, limitParamName);
}

export interface CallVehiclesEndpointParams {
  apiCoreClient: ApiCoreClient;
  path: string;
  query: Record<string, ApiCoreQueryValue>;
  environment: Environment;
  central: string;
}

export function callVehiclesEndpoint<T>(params: CallVehiclesEndpointParams): Promise<T> {
  return params.apiCoreClient.get<T>({
    path: params.path,
    query: params.query,
    environment: params.environment,
    central: params.central,
    authScheme: VEHICLES_AUTH_SCHEME,
  });
}
