/**
 * Helpers compartilhados pelas 3 tools do domínio Features (Epic 22,
 * Release 3, novo 20/08/2026 — US-103 a US-105, ÚLTIMO epic da Release 3 /
 * F12). Nome de catálogo `features` (sem prefixo `web_`), mesma convenção
 * já usada para `operations`/`reports`/`notifications`/`maintenance`/
 * `journeys` (domínios GetrakWeb sem contraparte técnica a desambiguar).
 * Os 3 endpoints usam `oauth2Password`/`GetrakWeb` (token delegado — ver
 * `domain/getrak-web-shared.ts`).
 *
 * Nenhum dos 3 endpoints (`GET /v1.0/centrals/features`, `GET
 * /v1.0/centrals/feature-flags`, `GET /v1.0/centrals/all-features`)
 * aceita QUALQUER parâmetro de query — confirmado no `openapi.json`
 * (`parameters: null` nos 3) e contra chamada real. A tag `Features`
 * também documenta `PUT /v1.0/centrals/features` (escrita, ativação/
 * desativação de feature) — não implementada, conforme instruído
 * ("Out of Scope" na própria spec de US-103).
 *
 * ACHADO — US-103 vs. US-104 são DE FATO conceitos distintos, confirmado
 * empiricamente, não apenas por hipótese da spec: os identificadores
 * retornados por `GET /v1.0/centrals/features` (9 chaves, todas com sufixo
 * `_mobile` — capacidades de exibição do app mobile, ex.:
 * `show_driver_mobile`, `show_speed_mobile`) não têm NENHUMA sobreposição
 * com os 6 retornados por `GET /v1.0/centrals/feature-flags` (`ai_
 * monitoring`, `video_monitoring`, `hide_getrak_store`,
 * `hide_home_carrousel`, `equipment`, `banner_countdown_v2` — flags de
 * produto/rollout, sem sufixo `_mobile`). Nenhuma tool consolidada.
 *
 * ACHADO — `GET /v1.0/centrals/features` (US-103) NÃO tem envelope
 * `{data: ...}` — a própria raiz da resposta já é o objeto de features
 * (`{"show_driver_mobile": true, ...}`), diferente de `feature-flags` e
 * `all-features`, que usam `{data: ...}`. Consistente com o `openapi.json`
 * não documentar NENHUM schema de resposta para este endpoint
 * (`properties: {}` vazio) — shape real descoberto só empiricamente.
 * `get_central_features.ts` trata essa raiz diretamente, sem tentar
 * extrair `raw.data`.
 *
 * ACHADO — `GET /v1.0/centrals/all-features` (US-105) é, na prática, um
 * catálogo de METADADOS para o conceito de US-103, não de US-104:
 * confirmado que os 9 `identifier` retornados por `all-features` são
 * EXATAMENTE os mesmos 9 identificadores (mesmo conjunto, mesma central de
 * teste) devolvidos por `GET /v1.0/centrals/features` — nenhum dos 6
 * identificadores de `feature-flags` aparece no catálogo. Ou seja,
 * "all-features" documenta o catálogo de "features vinculadas" (US-103),
 * não de "feature flags" (US-104), apesar do nome genérico do endpoint.
 *
 * ACHADO — dependência de central em US-105: o endpoint não tem NENHUM
 * parâmetro de central/filtro (mesmo que os outros dois) — a descrição do
 * `openapi.json` confirma a hipótese da spec ("Returns a list of all
 * possible features for centrals" — catálogo geral da plataforma, não
 * instanciado por central). Ainda assim, a AUTENTICAÇÃO usada é o mesmo
 * token delegado por central (US-046/047/048) — não há forma de chamar a
 * API Core sem um token válido de alguma central. Por isso `central`
 * continua sendo parâmetro OBRIGATÓRIO da tool no MCP, não pela regra de
 * negócio do endpoint (que não filtra por central), mas pelo modelo de
 * autorização/cache do MCP (CLAUDE.md Seção 3/6 — gate de autorização e
 * chave do cache do token delegado), mesmo padrão já usado em
 * `get_current_user`/US-069 e `get_centrals`/US-034. Não foi possível
 * testar empiricamente se o catálogo é idêntico entre centrais diferentes
 * (só uma central de teste disponível nesta rodada) — mas a ausência de
 * qualquer parâmetro de central no endpoint e a descrição documentada são
 * evidência estrutural forte de que é catálogo único, não sinalizado como
 * confirmação definitiva sem uma segunda central real para comparar.
 */

export { GETRAK_WEB_AUTH_SCHEME, GETRAK_WEB_SCOPE, callGetrakWebEndpoint } from "../getrak-web-shared.js";
export type { GetrakWebToolDeps as FeaturesToolDeps } from "../getrak-web-shared.js";
export { centralSchema, normalizeItem } from "../shared.js";
