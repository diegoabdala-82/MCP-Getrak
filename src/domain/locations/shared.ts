/**
 * Helpers compartilhados pelas tools do domínio Localização (Epic 3, US-013
 * a US-019). Todos os 7 endpoints de origem usam `oauth2Password`
 * (confirmado em `reference/openapi.json`) — mas em dois escopos
 * OAuth distintos dentro do mesmo esquema:
 *   - `PublicoCliente`: /v0.1/localizacoes, /v0.1/recebidos, /v0.1/trajetos,
 *     /v0.1/deslocamentos, /v0.1/entradas (US-013 a US-017).
 *   - `GetrakWeb`: /v1.0/localization/offline-treatment[-history] (US-018, US-019).
 *
 * A fundação (US-001/`AuthManager`) modela apenas `oauth2ClientCredentials`
 * vs. `oauth2Password` como dimensão de credencial, sem granularidade de
 * escopo dentro de `oauth2Password` — assumido, sem confirmação em
 * homologação, que a credencial técnica de password grant configurada por
 * ambiente/central já concede ambos os escopos usados pela V1. Se isso não
 * se confirmar, será necessário estender `AuthScheme`/`SecretsProvider` para
 * incluir o escopo OAuth como dimensão adicional — mesma categoria de
 * ED-02 (autenticação combinada), não travado como definitivo.
 */

import { z } from "zod";
import type { Environment } from "../../config/environment.js";
import type { ApiCoreClient, ApiCoreQueryValue } from "../../foundation/http/api-core-client.js";

export { centralSchema, paginationInputShape, normalizeItem, extractArray, buildPaginationMeta } from "../shared.js";

export const LOCATIONS_AUTH_SCHEME = "oauth2Password" as const;

export interface LocationsToolDeps {
  apiCoreClient: ApiCoreClient;
}

/**
 * Formato de data/hora exigido pelos endpoints de localização v0.1,
 * confirmado pelos exemplos reais em reference/openapi.json
 * (`"2024-09-12T00:00:00"` — sem offset/timezone).
 */
export const dateTimeSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/,
    "Expected date-time in the format YYYY-MM-DDTHH:mm:ss (e.g. 2024-09-12T00:00:00)",
  );

export interface CallLocationsEndpointParams {
  apiCoreClient: ApiCoreClient;
  path: string;
  query: Record<string, ApiCoreQueryValue | ApiCoreQueryValue[]>;
  environment: Environment;
  central: string;
}

export function callLocationsEndpoint<T>(params: CallLocationsEndpointParams): Promise<T> {
  return params.apiCoreClient.get<T>({
    path: params.path,
    query: params.query,
    environment: params.environment,
    central: params.central,
    authScheme: LOCATIONS_AUTH_SCHEME,
  });
}

/** Monta um segmento de path com os valores devidamente codificados (id/datas contêm caracteres reservados). */
export function buildDateRangePath(basePath: string, vehicleId: string, startDate: string, endDate: string): string {
  return `${basePath}/${encodeURIComponent(vehicleId)}/${encodeURIComponent(startDate)}/${encodeURIComponent(endDate)}`;
}
