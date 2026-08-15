/**
 * Helpers compartilhados pelas tools do domínio Integrations (Epic 10,
 * US-039). O endpoint usa `oauth2Password`/`GetrakWeb` (token delegado —
 * ver `domain/getrak-web-shared.ts`), confirmado contra
 * `reference/openapi.json` (v1.0, não depreciado).
 */

export { GETRAK_WEB_AUTH_SCHEME, GETRAK_WEB_SCOPE, callGetrakWebEndpoint } from "../getrak-web-shared.js";
export type { GetrakWebToolDeps as IntegrationsToolDeps } from "../getrak-web-shared.js";
export {
  centralSchema,
  paginationInputShape,
  normalizeItem,
  extractPagePerPageEnvelope,
  buildPagePerPagePagination,
} from "../shared.js";
