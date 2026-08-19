# Epics / User Stories implementados — Getrak Core MCP

Registro do que já foi codificado e testado no repositório. Fonte de verdade sobre **status de implementação**; o contrato de cada tool continua vindo da spec individual (Notion) e das regras transversais em `CLAUDE.md`.

> **Nota sobre este arquivo:** referenciado em `CLAUDE.md` (Seções 0 e 11) desde 15/08/2026, mas ainda não existia no repositório até a implementação do Epic 9. Criado agora, reconstruindo o histórico de Epics 1-5 a partir do que já estava documentado na Seção 0 do `CLAUDE.md` (que por sua vez reflete o código e os testes já mergeados em `main`). Se houver qualquer detalhe divergente do histórico real (ex.: datas, números de PR), sinalizar para correção — não foi inventado nenhum dado além do já registrado em `CLAUDE.md`.

---

## Epic 1 — Fundação (US-001 a US-007)

| Item | Status |
|---|---|
| Escopo | Infraestrutura transversal: identidade de consumidor, autorização por central, catálogo/descoberta de tools (US-007), paginação padronizada, envelope de resposta, tratamento de erro, auditoria. |
| Status | ✅ Implementado e testado. Mergeado em `main`. |
| Testado contra produção | N/A (infraestrutura transversal, sem chamada direta a endpoint de negócio). |

### Extensão — Identidade delegada (US-046, US-047, US-048)

| Item | Componente | Status |
|---|---|---|
| US-046 — token delegado por sessão do usuário | `DelegatedTokenManager` + `UserCredentialsProvider` (Env/AWS Secrets Manager) | ✅ Implementado e testado (mocks/contrato) |
| US-047 — Auth Profile Registry | `assertNoForbiddenAuthParams` (rejeita `scope`/`auth_profile`/`credential_id` transversalmente no `ToolRuntime`) | ✅ Implementado e testado |
| US-048 — cache em dois namespaces | `buildDelegatedTokenNamespace` (novo, distinto do namespace técnico já existente) | ✅ Implementado e testado |

**Status:** ✅ Implementado em 15/08/2026, testado isoladamente (23 testes de fundação) antes de iniciar o Epic 10, que a consome pela primeira vez. Endpoint de emissão confirmado: `POST /newkoauth/oauth/token` (OAuth2 Password Grant padrão). Falha de credencial de usuário inválida/expirada normalizada em `USER_CREDENTIAL_INVALID` (não retryable). Epic 3/5 (já implementados com `oauth2Password`, modelo antigo de credencial técnica por ambiente) **não foram migrados** para este fluxo — decisão explícita desta tarefa, tratamento futuro como item de trabalho separado.

**ED-ID-05/06 implementados com o mínimo necessário para homologação, não como decisão fechada de produto:** credencial do usuário coletada uma vez na configuração da conexão MCP (variável de ambiente por usuário em dev local; um segredo por usuário no AWS Secrets Manager em produção) — sem UI de login, conforme instruído. Revisitar antes de expor a usuários reais em produção (ver `CLAUDE.md` Seção 10).

## Epic 2 — Veículos (US-008 a US-012)

| Tool | User Story | Endpoint | Auth | Testado contra produção |
|---|---|---|---|---|
| `search_vehicles` | US-008 | `GET /v0.2/veiculos/integracao` | `oauth2ClientCredentials`/`Integracao` | ❌ Não |
| `get_vehicle_category` | US-009 | `GET /v0.2/veiculos/categorias` | `oauth2ClientCredentials`/`Integracao` | ❌ Não |
| `get_vehicle_client_link` | US-010 | `GET /v0.2/veiculos/clientes/integracao` | `oauth2ClientCredentials`/`Integracao` | ❌ Não |
| `get_vehicle_subclient_link` | US-011 | `GET /v0.2/veiculos/subclientes/integracao` | `oauth2ClientCredentials`/`Integracao` | ❌ Não |
| `get_suspended_vehicles` | US-012 | `GET /v0.2/veiculos/integracao/veiculoSuspenderIntegracao` | `oauth2ClientCredentials`/`Integracao` | ❌ Não |

**Status:** ✅ 5 tools implementadas e testadas (mocks/contrato). Mergeado em `main`. Sem credencial `oauth2ClientCredentials`/`Integracao` de produção disponível até o momento — validação contra produção real pendente.

## Epic 3 — Localização (US-013 a US-019)

| Tool | User Story | Endpoint | Auth | Testado contra produção |
|---|---|---|---|---|
| `get_vehicle_current_location` | US-013 | `GET /v1.0/localizacao/{id}` (ou equivalente) | `oauth2Password` | ✅ Sim |
| `get_vehicle_location_history` | US-014 | — | `oauth2Password` | ✅ Sim |
| `get_vehicle_paths` | US-015 | `GET /v0.1/trajetos/{id}/{dataIni}/{dataFim}` | `oauth2Password` | ✅ Sim |
| `get_vehicle_movements_and_stops` | US-016 | — | `oauth2Password` | ✅ Sim |
| `get_vehicle_inputs_report` | US-017 | — | `oauth2Password` | ✅ Sim |
| `get_offline_treatments` | US-018 | — | `oauth2Password` | ✅ Sim |
| `get_offline_treatment_history` | US-019 | — | `oauth2Password` | ✅ Sim |

**Status:** ✅ 7 tools implementadas e **testadas contra produção real**. Mergeado em `main`. Três bugs reais de discrepância documentação-vs-comportamento encontrados e corrigidos durante a implementação (shape de resposta em US-013, parâmetro `fields[]` não documentado em US-018, path incorreto no `openapi.json` em US-019 — ver `CLAUDE.md` Seção 7).

## Epic 4 — Equipamentos (US-020, US-021)

| Tool | User Story | Endpoint | Auth | Testado contra produção |
|---|---|---|---|---|
| `search_equipments` | US-020 | `GET /v0.2/equipamentos/integracao` | `oauth2ClientCredentials`/`Integracao` | ❌ Não |
| `get_equipment_bench_position` | US-021 | `GET /v0.2/equipamentos/integracao/posicaobancada/{modulo}` | `oauth2ClientCredentials`/`Integracao` | ❌ Não |

**Status:** ✅ 2 tools implementadas e testadas (mocks/contrato). Mergeado em `main`. Mesma limitação de credencial de produção do Epic 2.

## Epic 5 — Ordens de Serviço (US-022 a US-025)

| Tool | User Story | Endpoint | Auth (implementado) | Auth (testado) | Testado contra produção |
|---|---|---|---|---|---|
| `get_work_order_details` | US-022 | — | `oauth2ClientCredentials` | `oauth2Password` | ✅ Sim (via `oauth2Password`) |
| `get_work_order_tests` | US-023 | — | `oauth2ClientCredentials` | `oauth2Password` | ✅ Sim (via `oauth2Password`) |
| `get_work_order_tests_definition` | US-024 | — | `oauth2ClientCredentials` | `oauth2Password` | ✅ Sim (via `oauth2Password`) |
| `get_work_order_report` | US-025 | — | `oauth2ClientCredentials` | `oauth2Password` | ✅ Sim (via `oauth2Password`) |

**Status:** ✅ 4 tools implementadas e testadas contra produção real via `oauth2Password`. Mergeado em `main`. **Decisão em aberto:** qual esquema usar definitivamente em produção (`oauth2ClientCredentials` vs `oauth2Password`) ainda não foi decidido — ver `CLAUDE.md` Seção 6.3. Não decidir isso silenciosamente ao tocar neste código.

---

## Epic 9 — Clientes, Subclientes, Perfis e Centrais (US-030, US-031, US-033, US-034)

| Tool | User Story | Endpoint | Auth | Testado contra produção |
|---|---|---|---|---|
| `search_clients` | US-030 | `GET /v0.2/clientes/integracao` | `oauth2ClientCredentials`/`Integracao` | ❌ Não |
| `search_subclients` | US-031 | `GET /v0.2/subclientes/integracao` | `oauth2ClientCredentials`/`Integracao` | ❌ Não |
| `get_user_profiles` | US-033 | `GET /v0.2/perfis/integracao` | `oauth2ClientCredentials`/`Integracao` | ❌ Não |
| `get_centrals` | US-034 | `GET /v0.2/centrais/integracao` | `oauth2ClientCredentials`/`Integracao` | ❌ Não |

**Status:** ✅ 4 tools implementadas e testadas (mocks/contrato), 20 testes automatizados novos (151 no total). Mesma limitação de credencial de produção dos Epics 2/4 — **nenhuma chamada foi validada contra produção real**; validação pendente de credencial `oauth2ClientCredentials`/`Integracao`.

**Nomenclatura ajustada:** a spec sugeriu `list_user_profiles`/`list_centrals`; renomeados para `get_user_profiles`/`get_centrals` para seguir a convenção já consolidada no código (nenhuma tool existente usa prefixo `list_`; `get_` é o padrão para listagens sem espaço amplo de filtros, `search_` para as que têm — ver `search_clients`/`search_subclients`, que mantiveram o nome sugerido por já se encaixarem nessa convenção).

**Domínio no catálogo MCP:** as 4 tools foram registradas sob o domínio `accounts` (`foundation/catalog/tool-catalog.ts`) — nome não definido em nenhuma spec, escolhido por agrupar entidades de cadastro/conta (clientes, subclientes, perfis, centrais), em contraste com os domínios operacionais já existentes (`vehicles`, `locations`, `equipments`, `work_orders`).

**Excluída desta rodada:** US-032 (consultar usuários, `GET /v0.2/usuarios/integracao`) — bloqueada por **GAP-018**: o `openapi.json` documenta esse endpoint sob `oauth2Password` + escopo `Integracao`, combinação atípica frente ao modelo híbrido de identidade (TD-05). Confirmado ao pesquisar o `openapi.json` para este épico; não há informação adicional que esclareça a anomalia. Não implementada — aguardando confirmação da Engenharia sobre qual modelo de autenticação se aplica de fato.

**Divergências/achados documentados durante a implementação** (não decididos silenciosamente — ver comentários nos arquivos-fonte para o detalhe completo):
- `GET /v0.2/centrais/integracao` não declara **nenhum** parâmetro de request (nem central, nem paginação) — diferente dos demais 3 endpoints do épico. Aplicada paginação client-side (`createClientSideSliceAdapter`, mesmo padrão já usado em Locations) para respeitar o guardrail padrão de página/tamanho, já que o endpoint pode retornar uma lista não limitada.
- `id_veiculo` é `string` em `/v0.2/clientes/integracao` (US-030) mas `integer` em `/v0.2/subclientes/integracao` (US-031) — tipos reais diferentes para o mesmo filtro conceitual; cada tool segue o tipo do seu próprio endpoint.
- Nome do parâmetro de limite de paginação varia dentro do próprio épico: `limit` em clientes/subclientes, `limite` em perfis (mesma heterogeneidade já prevista em ED-01).

**Risco de isolamento por central sinalizado em `get_centrals` (achado ao ler a spec de US-034, não visível apenas pelo `openapi.json`):** o AC de US-034 exige que a tool "respeite o isolamento (RF03)", mas o endpoint não aceita nenhum parâmetro para filtrar por central, e a spec de US-001 descreve a credencial técnica como resolvida "por ambiente" — não confirma que seja também central-scoped. O guard de isolamento do MCP (US-002) só valida a central de *entrada* contra a lista autorizada do consumidor; não filtra o *conteúdo* da resposta. Ou seja, se a credencial técnica não for central-scoped na API Core, `get_centrals` pode retornar centrais além da autorizada. Discutido com Diego (dono do produto) em 15/08/2026: decisão foi **manter a tool como está nesta rodada, documentando o risco** (comentário no código-fonte + `warnings` na resposta da tool) em vez de bloquear ou filtrar às cegas — aguardando confirmação da Engenharia sobre o escopo real da credencial técnica antes de resolver definitivamente. Não abrir mão desse sinalizador silenciosamente em trabalho futuro sobre esta tool.

---

## Epic 10 — Domínios internos Getrak Web (US-035, US-036, US-037, US-039, US-040, US-041, US-042)

| Tool | User Story | Endpoint | Auth | Testado contra produção |
|---|---|---|---|---|
| `search_accessories` | US-035 | `GET /v1.0/accessories` | `oauth2Password`/`GetrakWeb` (delegado) | ✅ Sim (16/08/2026) |
| `search_accessory_categories` | US-036 | `GET /v1.0/accessories/categories` | `oauth2Password`/`GetrakWeb` (delegado) | ✅ Sim (16/08/2026) |
| `get_accessories_summary` | US-037 | `GET /v1.0/accessories/summary` | `oauth2Password`/`GetrakWeb` (delegado) | ✅ Sim (16/08/2026) |
| `search_central_integrations` | US-039 | `GET /v1.0/integrations` | `oauth2Password`/`GetrakWeb` (delegado) | ✅ Sim (16/08/2026) |
| `search_geofences` | US-040 | `GET /v1.0/perimeters/geofences` | `oauth2Password`/`GetrakWeb` (delegado) | ✅ Sim (16/08/2026) |
| `search_perimeter_categories` | US-041 | `GET /v1.0/perimeters/categories` | `oauth2Password`/`GetrakWeb` (delegado) | ✅ Sim (16/08/2026) |
| `search_reference_points` | US-042 | `GET /v1.0/perimeters/reference-points` | `oauth2Password`/`GetrakWeb` (delegado) | ✅ Sim (16/08/2026) |

**Status:** ✅ 7 tools implementadas e testadas (mocks/contrato + validação real), 44 testes automatizados novos (219 no total). Todas usam o fluxo de token delegado (US-046/047/048).

**Validado contra produção real em 16/08/2026** — credencial de usuário real de teste fornecida pelo dono do produto (central de demonstração), servidor MCP subido via stdio real (`Client`/`StdioClientTransport` do `@modelcontextprotocol/sdk`, spawn real de `src/index.ts`) contra `https://api.getrak.com`. Todas as 7 tools retornaram dados reais com sucesso (ex.: `get_accessories_summary` → `{skus: 13, categories: 4}`; `search_geofences` → 358 geofences reais na central; `search_reference_points` → 1243 pontos). Quatro discrepâncias reais encontradas e corrigidas nesse processo (ver abaixo) — nenhuma foi assumida ou "corrigida" sem confirmação empírica. Credenciais reais usadas no teste nunca foram commitadas neste repositório (env vars efêmeras só durante o teste manual).

**Nomenclatura ajustada:** a spec sugeriu prefixo `list_` para 5 das 7 tools (`list_accessory_categories`, `list_central_integrations`, `list_geofences`, `list_perimeter_categories`, `list_reference_points`); renomeadas para `search_*` — todas têm filtros reais por campo (name/status/is_active/type/client_id etc.), mesma convenção já aplicada em Epic 9. `search_accessories` e `get_accessories_summary` mantiveram os nomes sugeridos (já se encaixavam na convenção: filtro real e nenhum parâmetro, respectivamente).

**Domínios no catálogo MCP:** 3 novos domínios — `accessories` (US-035/036/037), `integrations` (US-039), `perimeters` (US-040/041/042) — nomes não definidos em spec, escolhidos por entidade de negócio.

**Excluída desta rodada:** US-038 (consultar fornecedores) — bloqueada por **GAP-019** (path do endpoint inferido de um trecho truncado do `openapi.json`, não confirmado).

**Decisão sobre acesso por papel (US-040/US-042):** a documentação da API Core indica que ADMIN/OPERADOR veem todos os registros da central, enquanto CLIENTE/SUBCLIENTE veem apenas os associados à própria empresa — mas o mecanismo pelo qual o MCP obteria o papel do usuário autenticado não está definido em nenhuma fonte disponível (nem PRD, nem Technical Brief, nem a resposta do endpoint de emissão de token). **Decisão tomada:** o MCP não implementa filtragem própria por papel — a API Core já aplica essa regra do lado dela; o MCP apenas repassa o resultado já filtrado (opção (b) da tarefa). Nenhuma lógica de papel foi adicionada.

**Divergências/achados documentados durante a implementação** (não decididos silenciosamente — ver comentários nos arquivos-fonte para o detalhe completo):
- Nenhum dos 7 endpoints aceita `sistema`/central como parâmetro de request (diferente de Epic 2/4/9) — a identidade do usuário Getrak (token delegado) já é inerentemente ligada a uma central; `central` continua exigido como parâmetro de entrada da tool (gate de autorização + chave do cache de token), mas nunca repassado ao endpoint.
- `fields[]`/`include[]` têm comportamento real heterogêneo entre endpoints do mesmo épico: em `/v1.0/integrations` são `explode:false` (um único valor separado por vírgula); em `/v1.0/perimeters/*` são repetidos (`fields[]=id&fields[]=name`, default explode=true); em `/v1.0/accessories`, `fields[]` é uma string única (não um array), formato ainda diferente dos dois anteriores. Cada tool trata o formato real do seu próprio endpoint.
- `GET /v1.0/integrations` retorna `credentials.token` (token de acesso de um provedor externo) nos itens de integração — dado sensível repassado como retornado pela API Core (mesmo tratamento de `cnpj`/`email` no Epic 9: mascarado só na auditoria, não na resposta ao consumidor autorizado). A tool expõe `fields` para que o consumidor restrinja os campos retornados, se preferir.
- Todos os 7 endpoints confirmadamente devolvem paginação real (`{data, page, pages, total}`), diferente da estimativa (`has_more`) usada em Epic 2-9 — `total_items`/`has_more` são exatos aqui.

**Quatro discrepâncias reais encontradas e corrigidas na validação contra produção (16/08/2026)** — nenhuma inferida do `openapi.json` sozinho, todas confirmadas empiricamente:
1. **Formato do corpo da emissão de token:** `POST /newkoauth/oauth/token` para o escopo `GetrakWeb` exige `multipart/form-data`, não `application/x-www-form-urlencoded` (o formato já usado pelo modelo técnico de Epic 3/5, que continua correto para aquele fluxo — não alterado). Criado `MultipartFormOAuth2Client`, usado exclusivamente pelo `DelegatedTokenManager`.
2. **Composição do `username`:** o valor enviado precisa ser `{username}@{central}`, não o login isolado — a central faz parte da identidade OAuth do usuário, não é só contexto do MCP. Corrigido em `DelegatedTokenManager.getAccessToken` (o valor é composto ali, não armazenado pré-composto na credencial).
3. **`client_id`/`client_secret` do escopo `GetrakWeb`:** são credenciais reais da aplicação, obtidas com o time (não documentadas no `openapi.json`) — o exemplo `dev`/`dev` do bloco `servers` do `openapi.json` foi testado e rejeitado com 401 antes da credencial real ser fornecida. Credenciais reais nunca são commitadas neste repositório.
4. **Nome do parâmetro de paginação:** as 6 tools paginadas deste épico enviavam `perPage` como chave de query — mas isso é o identificador do `$ref` em `components/parameters` do `openapi.json`, não o nome real do parâmetro (que é `per_page`, conforme o campo `name` dentro da própria definição do parâmetro). A API real ignorava silenciosamente `perPage` (parâmetro desconhecido) e aplicava seu próprio tamanho de página padrão, independente do `page_size` pedido — um bug real de implementação (confundir o identificador do `$ref` com o nome do parâmetro), não uma ambiguidade de documentação. Corrigido nos 6 arquivos; confirmado empiricamente que `page_size` agora é respeitado exatamente.

---

## Epic 16 — Users (Getrak Web, Release 3, novo 16/08/2026) (US-067, US-068, US-069)

| Tool | User Story | Endpoint | Auth | Testado contra produção |
|---|---|---|---|---|
| `get_user_details` | US-067 | `GET /v1.0/users/{id}` | `oauth2Password`/`GetrakWeb` (delegado) | ✅ Sim (17/08/2026) |
| `search_web_users` | US-068 | `GET /v1.1/users` | `oauth2Password`/`GetrakWeb` (delegado) | ✅ Sim (17/08/2026) |
| `get_current_user` | US-069 | `GET /oauth/usuario` | `oauth2Password`/`GetrakWeb` (delegado) | ✅ Sim (17/08/2026) |

**Status:** ✅ 3 tools implementadas e testadas (mocks/contrato + validação real), 25 testes automatizados novos (244 no total). Todas reaproveitam o fluxo de token delegado já existente (US-046/047/048) — nenhuma infraestrutura nova de autenticação foi criada.

**Domínio no catálogo MCP:** novo domínio `web_users` — deliberadamente distinto de `accounts` (Epic 9, `UsersIntegracao`/`oauth2ClientCredentials`) para não confundir com US-032 (usuários via Integracao, bloqueada por GAP-018) nem com `get_user_profiles` (perfis, não usuários).

**Validado contra produção real em 17/08/2026** — mesma credencial de usuário real de teste da central de demonstração já usada para validar o Epic 10. Chamadas diretas confirmaram os 3 endpoints (`GET /oauth/usuario`, `GET /v1.1/users`, `GET /v1.0/users/{id}`) antes da implementação (para evitar propagar suposições do `openapi.json` já sabidamente pouco confiável — CLAUDE.md Seção 7).

**Divergências reais encontradas e corrigidas/documentadas (não decididas silenciosamente):**
1. **`GET /v1.0/users/{id}` — shape de resposta totalmente diferente do documentado.** O `openapi.json` documenta `{client: {...}, client_id, fullName, id, site}`; a resposta real é `{id, full_name, client, subclient, central}` (chave `full_name`, não `fullName`; inclui `subclient`). O parâmetro `fields[]` usa os identificadores camelCase documentados (`fullName`, `site`, `clientId`) como seletor, mas as chaves de saída correspondentes vêm em snake_case (`site`, `client_id`); enviar o próprio nome de saída (`full_name`) no `fields[]` derruba o endpoint com HTTP 500. Por isso `fields[]` não é exposto como parâmetro da tool — ela sempre envia o seletor fixo `id,fullName,site,clientId`, confirmado seguro.
2. **`GET /v1.1/users` — mesmo bug de paginação do Epic 10 (`perPage` vs. `per_page`).** Confirmado empiricamente ANTES de escrever o código (não repetido por engano): `perPage` é silenciosamente ignorado (a API aplica seu próprio padrão de 25 itens); `per_page` é o nome real. Implementado corretamente desde o início.
3. **`GET /v1.1/users` — paginação real confirmada** como o mesmo envelope `{data, page, pages, total}` do Epic 10; filtro sem correspondência retorna lista vazia normalizada (`{data: [], total: 0, pages: 0, page: 1}`), nunca erro.
4. **`GET /oauth/usuario` — resposta real tem mais campos que o documentado.** Documentado: `{id, login, nome, sistema, timezone, permissao, email}`. Real: acrescenta `centralId`, `perfil` (inteiro), `ativo` (Y/N), `senhatemp` (Y/N), `tipo` (inteiro), `uid` (string hexadecimal longa) e `acessoWs` (Y/N).

**Achado central da US-069 — gap de papel do usuário (Epic 10, US-040/US-042):** investigado explicitamente, conforme instruído.
- `permissao` (documentado) é um array de flags de permissão granulares por funcionalidade (`#/components/schemas/permission` — ex.: `6`=Fence, `2`=Reference point, `28`=Administrative panel), **não** uma classificação de papel do usuário — não resolve o gap.
- `tipo` (inteiro) e `perfil` (inteiro) são campos reais, não documentados no `openapi.json`, e são candidatos fortes: `GET /v1.1/users` (US-068) documenta um filtro `type` com exatamente a taxonomia do gap (`admin|operator|client|subclient|atende`), o que sugere que `tipo` seja essa mesma classificação em forma numérica; `perfil` pode corresponder a `profile_id` (mesmo endpoint, ou ao domínio `get_user_profiles` do Epic 9).
- **Nenhuma fonte disponível (openapi.json, PRD, Technical Brief, nenhuma spec) confirma o mapeamento inteiro→papel.** Por instrução explícita da tarefa, esse mapeamento **não foi inventado**.
- **Conclusão: o gap do Epic 10 permanece aberto** — mas com uma pista concreta e nova (campos exatos + endpoint) que não existia antes desta rodada. `tipo`/`perfil` são expostos como estão em `get_current_user`, sem uso em nenhuma lógica de filtragem do MCP. Recomenda-se à Engenharia confirmar o mapeamento de `tipo` antes de qualquer tentativa futura de fechar o gap com base nele. **Nenhuma mudança foi feita em `search_geofences`/`search_reference_points`.**

**Minimização em `get_current_user`:** o campo `uid` (identificador longo, formato de token/sessão) é omitido da resposta normalizada — divergente do precedente geral de "repassar como recebido" (cnpj/email no Epic 9, `credentials.token` no Epic 10), decisão pontual por não ter valor de negócio conhecido e ter formato de credencial opaca (CLAUDE.md Seção 8 lista tokens/identificadores como sensíveis). Demais campos sensíveis (email, telefone, documento em `client`) seguem o mesmo tratamento já estabelecido: mascarados apenas na auditoria, nunca na resposta ao consumidor já autorizado.

**`central` como parâmetro de `get_current_user`:** a spec descreve a tool como "sem parâmetros de entrada", mas isso se refere a parâmetros de negócio (nenhum id, nenhum filtro) — `central` continua exigido como gate de autorização e chave de resolução do token delegado (CLAUDE.md Seção 3/US-048), mesmo padrão já usado em `get_accessories_summary`/`get_centrals`. Reconciliação sinalizada no código-fonte, não uma suposição silenciosa.

---

## Epic 17 — Vehicles (Getrak Web, Release 3, novo 16/08/2026) (US-070 a US-075; US-076 fora desta rodada)

| Tool | User Story | Endpoint | Auth | Testado contra produção |
|---|---|---|---|---|
| `search_web_vehicles` | US-070 | `GET /v1.0/vehicles` | `oauth2Password`/`GetrakWeb` (delegado) | ✅ Sim (17/08/2026) |
| `get_vehicle_by_equipment` | US-071 | `GET /v1.0/vehicles/equipments/{serial_number}` | `oauth2Password`/`GetrakWeb` (delegado) | ✅ Sim (17/08/2026) |
| `get_vehicle_equipment_history` | US-072 | `GET /v1.0/vehicles/{id}/equipments-history` | `oauth2Password`/`GetrakWeb` (delegado) | ✅ Sim (17/08/2026) |
| `get_vehicle_by_plate` | US-073 | `GET /v1.0/vehicles/lookup/{plate}` | `oauth2Password`/`GetrakWeb` (delegado) | ✅ Sim (17/08/2026) |
| `get_vehicle_status` | US-074 | `GET /v1.0/localization/vehicles-status/{vehicle_id}` | `oauth2Password`/`GetrakWeb` (delegado) | ✅ Sim (17/08/2026) |
| `search_vehicles_status` | US-075 | `GET /v1.0/localization/vehicles-status` | `oauth2Password`/`GetrakWeb` (delegado) | ✅ Sim (17/08/2026) |

**Status:** ✅ 6 de 7 tools implementadas e testadas (mocks/contrato + validação real), 43 testes automatizados novos (287 no total). Todas reaproveitam o fluxo de token delegado já existente (US-046/047/048).

**US-076 (`get_isoline_shape`, `GET /v1.0/localization/isoline`) — deliberadamente FORA desta rodada.** A própria spec da User Story condiciona a implementação a uma confirmação de caso de uso real por Diego (Product Owner) — "Baixa prioridade — caso de uso ainda não identificado" — que não foi obtida durante esta implementação. Seguindo a instrução explícita da tarefa ("só implemente se... confirmar que não há decisão de Produto pendente"), a tool **não foi codificada**. Nenhum código, teste ou registro de catálogo para `get_isoline_shape` existe neste PR. Confirmado por teste real via `tools/list` que ela não aparece entre as 38 tools descobertas.

**Domínio no catálogo MCP:** novo domínio `web_vehicles` — deliberadamente distinto de `vehicles` (Epic 2, `VehiclesIntegracao`/`oauth2ClientCredentials`), mesma convenção do `web_users` (Epic 16) vs. `accounts` (Epic 9).

**Validado contra produção real em 17/08/2026** — mesma credencial de usuário real de teste da central de demonstração já usada para os Epics 10/16. Todos os 6 endpoints chamados diretamente antes de codificar.

**Achados reais documentados (não decididos silenciosamente):**
1. **`GET /v1.0/vehicles` e `GET /v1.0/localization/vehicles-status` reproduzem o mesmo bug de paginação `perPage`/`per_page`** do Epic 10/16 — confirmado empiricamente antes de codificar (25 itens com `perPage`, contagem exata pedida com `per_page`). Implementado corretamente desde o início nas duas tools.
2. **`GET /v1.0/vehicles/{id}/equipments-history` retorna `{data, total, pages}` — sem a chave `page`**, diferente do envelope padrão `{data, page, pages, total}` do resto do projeto. Inofensivo para o código (o `page` usado na resposta normalizada vem do input, não da resposta), mas divergência real registrada. Esse mesmo endpoint documenta o filtro de busca como `filter[search][inc]` (singular "filter", não "filters" como na maioria dos outros) — implementado fielmente ao nome documentado; o teste real feito não conseguiu discriminar se isso faz diferença de fato (dataset de teste tinha um único serial no histórico do veículo usado).
3. **`GET /v1.0/localization/vehicles-status` usa `order[gps_time]`/`order[server_time]` com enum `asc`/`desc` MINÚSCULO** — diferente da convenção `ASC`/`DESC` maiúscula usada em quase todo o resto do projeto (incluindo `search_web_vehicles`, no mesmo Epic). Implementado respeitando o valor real documentado, não a convenção do restante do projeto.
4. **`GET /v1.0/vehicles/lookup/{plate}` (US-073) — achado crítico, não é uma consulta ao cadastro da central.** Ver seção dedicada abaixo.

**ACHADO CRÍTICO — `get_vehicle_by_plate` (US-073) não filtra por central:** confirmado empiricamente que este endpoint funciona como uma consulta de placa genérica (estilo FIPE/DETRAN), não como "esta placa pertence a um veículo rastreado nesta central":
- Uma placa completamente inventada (`ZZZ0000`, sem nenhuma correspondência em nenhum cadastro Getrak) retornou HTTP 200 com um registro completo e plausível (Ford Ka, chassi, preço FIPE) — não HTTP 404.
- Uma placa real da frota desta central (`FMB-6843`, com marca/VIN propositalmente inválidos no cadastro Getrak visto em `search_web_vehicles`) retornou, neste endpoint, marca/modelo/chassi **completamente diferentes e plausíveis** (Volkswagen SpaceFox, chassi de fábrica real) — os dados não vêm do cadastro desta central.
- `central_id` aparece igual em ambos os casos (o do usuário autenticado) — não é um filtro real, parece só ser carimbado no retorno.
- HTTP 400 só ocorre para formato de placa claramente inválido (`"Invalid plate format. Expected format: ABC1234 or ABC1D23"`); nenhuma placa sintaticamente válida testada (real ou inventada) produziu 404.
- **A AC da spec ("placa sem veículo correspondente → VEHICLE_NOT_FOUND") não corresponde ao comportamento real observado.** Implementado fielmente ao endpoint real (sem inventar uma checagem adicional de pertencimento à central que a API não faz). **Sinalizado para decisão de Produto/Engenharia** — pode exigir reescopar ou renomear esta tool, ou tratá-la como uma capacidade de enriquecimento de dados nacional em vez de consulta de frota.

**Sobreposição de dados investigada conforme instruído:**
- **US-070 (`search_web_vehicles`) vs. US-008 (`search_vehicles`, Epic 2):** sobreposição conceitual real — ambas são consultas de CADASTRO de veículo (nenhuma inclui localização em tempo real). Não foi possível comparar o shape ponto a ponto (Epic 2 usa `oauth2ClientCredentials`, sem credencial disponível neste ambiente, mesma limitação já registrada para todo o Epic 2/4/9). **Não consolidado nem descartado** — decisão de Produto/Engenharia.
- **US-074 (`get_vehicle_status`) vs. US-013 (`get_vehicle_current_location`, Epic 3):** sobreposição real de CAMPOS confirmada — `get_vehicle_status` retorna `latitude`/`longitude`/`speed`/`ignition`/`entrys`/`gps_time` (mesmos conceitos documentados para US-013: "latitude, longitude, velocidade, status de ignição/entradas, data/hora do último pacote"), além de dados que US-013 não tem (odômetro/horímetro, tensão de bateria, status de bloqueio, GPS fix/satélites, snapshot de cadastro). Não foi possível comparar o valor exato no mesmo veículo (US-013 usa credencial técnica antiga, indisponível neste ambiente) — a sobreposição identificada é de campos/conceito. **Não consolidado nem descartado** — decisão de Produto/Engenharia. `search_vehicles_status` (US-075) é "mesma família de dados" (spec) que `get_vehicle_status` — mesma sobreposição se aplica.

---

## Epic 18 — Notifications (Getrak Web, Release 3, novo 19/08/2026) (US-077, US-078)

| Tool | User Story | Endpoint | Auth | Testado contra produção |
|---|---|---|---|---|
| `search_messages` | US-077 | `GET /v1.0/notifications/messaging/messages` | `oauth2Password`/`GetrakWeb` (delegado) | ✅ Sim (19/08/2026) |
| `get_messages_analytics` | US-078 | `GET /v1.0/notifications/messaging/messages/analytics` | `oauth2Password`/`GetrakWeb` (delegado) | ✅ Sim (19/08/2026) |

**Status:** ✅ 2 tools implementadas e testadas (mocks/contrato + validação real), 14 testes automatizados novos (301 no total). Ambas reaproveitam o fluxo de token delegado já existente (US-046/047/048) — nenhuma infraestrutura nova de autenticação foi criada.

**Domínio no catálogo MCP:** novo domínio `notifications`.

**Validado contra produção real em 19/08/2026** — mesma credencial de usuário real de teste da central de demonstração já usada para os Epics 10/16/17. Os 2 endpoints chamados diretamente antes de codificar, confirmando não serem `deprecated` no `openapi.json`.

**Achados reais documentados (não decididos silenciosamente):**
1. **`GET /v1.0/notifications/messaging/messages` reproduz o mesmo bug de paginação `perPage`/`per_page`** já visto em Epic 10/16/17 — confirmado empiricamente antes de codificar (25 itens com `perPage`, contagem exata pedida com `per_page`, mesmo `total`). Implementado corretamente com `per_page` desde o início.
2. **`is_automatic` vem como BOOLEANO real** (`true`/`false`) — o `openapi.json` documenta esse campo como inteiro `0`/`1`. Repassado como veio, não convertido para bater com o schema documentado (CLAUDE.md Seção 7: a resposta real é a fonte de verdade).
3. **`reading_rate` (US-078) vem como NÚMERO DECIMAL real** (ex.: `21.9`) — o `openapi.json` documenta esse campo como inteiro. Repassado como veio, sem arredondar/truncar.
4. **`GET /v1.0/notifications/messaging/messages/analytics` não exige nenhum parâmetro** — confirmado funcionando sem `start_at`/`end_at` (agregação sobre todo o histórico: `{total_sent: 2253, total_viewed: 494, reading_rate: 21.9}`) e com o par de datas (`{total_sent: 1023, total_viewed: 215, reading_rate: 21}`). Não há paginação neste endpoint — resposta é um único objeto agregado.
5. **Artefato de documentação no `openapi.json`:** o bloco `responses.200` de `GET /v1.0/notifications/messaging/messages` está malformado — mistura um `$ref` para `#/components/responses/error-400` com um `content` de sucesso no mesmo bloco. Tratado como erro de documentação (ignorado); a resposta real de sucesso segue o envelope `{data, page, pages, total}` padrão do restante do projeto.

**TENSÃO DE POLÍTICA SINALIZADA — mascaramento de conteúdo de mensagem (`body`/`title`), não resolvida silenciosamente em nenhuma direção:**
- A tarefa desta rodada instruiu explicitamente: "aplique mascaramento na resposta normalizada e no log de auditoria, seguindo o mesmo padrão já usado em outras tools."
- Essas duas metades da instrução se contradizem entre si: o padrão real já em uso em TODO o resto do projeto (Epic 9, Epic 10, Epic 16, Epic 17 — `search_clients`, `get_current_user`, etc.) é mascarar campos sensíveis **apenas no log de auditoria** (via `deepMask`, automático em `audit-logger.ts`), **nunca na resposta ao consumidor** já autorizado para a central — precisamente porque `result.data` nunca é incluído no registro de auditoria em nenhum domínio (ver `foundation/tool-runtime.ts`). Mascarar a resposta normalizada teria zero efeito sobre o log de auditoria (que já não contém `data`) e, ao mesmo tempo, seria a primeira exceção do projeto a mascarar a RESPOSTA entregue ao consumidor.
- Confirmado empiricamente nesta rodada que `body`/`title` reais podem conter dado pessoal e financeiro concreto (nome de cliente, situação de cobrança — ex.: "Olá Bernardo, Não conseguimos identificar o pagamento da sua cobrança..."), mais sensível em espírito que os campos estruturados (cnpj/email/telefone) já tratados apenas por auditoria em outros domínios.
- **Decisão tomada:** manter o padrão transversal existente (pass-through na resposta normalizada, mascarado só no log de auditoria — que, na prática, não mascara texto livre porque `deepMask` mascara por NOME de campo, não por padrão de conteúdo, e nenhum outro lugar do projeto tem mascaramento de texto livre). Não foi inventada uma exceção pontual de mascaramento de conteúdo só para este domínio, o que seria uma mudança de arquitetura de segurança não sinalizada em nenhuma fonte (CLAUDE.md, PRD, Technical Brief) além desta única tarefa.
- **Sinalizado explicitamente para decisão de Produto/Segurança:** se a política real para conteúdo de mensagem precisar ser mais restritiva que para os demais domínios (ex.: mascarar nomes próprios/valores monetários dentro de `body` antes de retornar ao consumidor), isso exige (a) uma decisão de Produto sobre o que exatamente mascarar em texto livre, e (b) um mecanismo novo de mascaramento por CONTEÚDO (não por nome de campo) que hoje não existe em nenhum lugar do projeto — não algo a inventar dentro desta implementação.

**Fora de escopo confirmado:** nenhuma tool de envio/agendamento/cancelamento de notificação foi criada — esses endpoints existem na mesma tag `Notifications` do `openapi.json`, mas são operações de escrita, fora da V1 read-only (CLAUDE.md Seção 9).

---

## Epic 19 — Operations (Getrak Web, Release 3, novo 19/08/2026) (US-079)

| Tool | User Story | Endpoint | Auth | Testado contra produção |
|---|---|---|---|---|
| `search_operations` | US-079 | `GET /v1.0/operations` | `oauth2Password`/`GetrakWeb` (delegado) | ✅ Sim (19/08/2026) |

**Status:** ✅ 1 tool implementada e testada (mocks/contrato + validação real), 10 testes automatizados novos (311 no total). Reaproveita o fluxo de token delegado já existente (US-046/047/048) — nenhuma infraestrutura nova de autenticação.

**Domínio no catálogo MCP:** novo domínio `operations`.

**Confirmado que a tag `Operations` do `openapi.json` documenta SÓ este endpoint** — nenhum outro path usa essa tag no `openapi.json` real deste projeto. A preocupação da tarefa (não replicar acidentalmente uma operação de escrita da mesma tag) não se aplica: não há nenhuma outra tool candidata a confundir.

**Validado contra produção real em 19/08/2026** — mesma credencial de usuário real de teste da central de demonstração já usada para os Epics 10/16/17/18. Chamado diretamente antes de codificar, com dezenas de combinações de filtros, para responder exatamente à pergunta da tarefa: quais parâmetros são de fato obrigatórios.

**FILTROS OBRIGATÓRIOS — confirmados por DUAS fontes independentes, conforme instruído:**
1. **`openapi.json`:** `filters[operation_type][in]`, `filters[entity_id]` e `filters[date]` estão marcados `required: true` no bloco de parâmetros do endpoint (`page`, `perPage`, `fields[]` e `order[date]` são opcionais).
2. **Empiricamente:** omitir qualquer um dos 3 filtros obrigatórios (isolado ou em combinação, incluindo nenhum filtro) NÃO produz um HTTP 400 limpo — produz **HTTP 500 genérico `{"error":"Internal error"}`**, sem indicar qual filtro faltou. Confirmado com múltiplas combinações (nenhum filtro; só `operation_type`; `operation_type`+`entity_id` sem `date`).

**Consequência prática, exatamente o motivo da instrução da tarefa:** sem validação client-side, o consumidor receberia da API Core um `UPSTREAM_ERROR` genérico e sem contexto — em vez disso, os 3 filtros são campos **obrigatórios no schema Zod** (`operation_types: z.array(z.string()).min(1)`, `entity_id: z.string().min(1)`, `date` com regex `YYYY-MM-DD`). Como `ToolRuntime.execute()` já roda `inputSchema.parse()` antes de chamar `handler` (e portanto antes de qualquer chamada à API Core), a ausência de um filtro obrigatório vira `VALIDATION_ERROR` sem nenhum round-trip de rede — nenhuma lógica de validação extra foi necessária além de declarar os campos como obrigatórios no schema já existente do pipeline.

**Achados reais adicionais, encontrados isolando cada fator antes de assumir o formato do `openapi.json` (não decididos silenciosamente):**
1. **Formato real de wire do filtro de tipos exige o sufixo de array `[]`.** `filters[operation_type][in]=device` (sem `[]`) retorna o MESMO HTTP 500 genérico acima, mesmo com os 3 filtros logicamente presentes — só `filters[operation_type][in][]=device` (repetido por valor, para múltiplos tipos) funciona. Implementado com a chave de query `"filters[operation_type][in][]"` mapeada a um array — o serializador de query do `ApiCoreClient` já repete a chave por item de array, confirmado funcionando com múltiplos valores reais (`device` + `equipment_discarded` na mesma chamada).
2. **`order[date]` (documentado, opcional) está QUEBRADO no backend — confirmado, não hipotético.** Todo valor testado produziu HTTP 500:
   - `order[date]=ASC` e `order[date]=DESC` → `{"status":500,"error":"Unknown column 'distinctAlias.operation_data' in 'field list'"}` (erro de SQL vazando bruto).
   - `order[date]=asc` (minúsculo) → `{"status":500,"error":"SelectQueryBuilder.addOrderBy \"order\" can accept only \"ASC\" and \"DESC\" values."}`.
   - **Decisão:** `order[date]` não é exposto como parâmetro de entrada da tool — repassá-lo sempre quebraria a chamada, e CLAUDE.md Seção 3 proíbe repassar erro bruto da API Core; a única forma de cumprir isso aqui é não oferecer o parâmetro. Sinalizado para Engenharia/Produto: se ordenação for necessária no futuro, precisa de correção no backend antes de ser exposta pelo MCP.
3. **Envelope de sucesso confirmado como o padrão `{data, page, pages, total}`** do resto do domínio Getrak Web — `extractPagePerPageEnvelope` aplicado sem alteração. Filtro sem correspondência retorna lista vazia normalizada (`{data: [], total: 0, pages: 0, page: 1}`), nunca erro — confirmado com dezenas de combinações reais de tipo/entidade/data na central de demonstração (nenhuma produziu resultado não vazio nesta rodada).
4. **Paginação (`perPage`/`per_page`) NÃO pôde ser reconfirmada com resultado não vazio nesta rodada** — diferente de Epic 10/16/17/18, onde a distinção foi observada com dados reais. Nenhuma combinação de tipo/entidade/data tentada retornou nenhum registro nesta central de demonstração; `per_page`/`page` foram aceitos sem erro (HTTP 200, envelope vazio), mas não foi possível observar truncamento de página real. Implementado com `per_page` por forte precedente já confirmado repetidamente em todo o resto do domínio Getrak Web — sinalizado aqui como aplicação preventiva por precedente, não como confirmação nova e independente.
5. **`fields[]` (documentado, opcional) não é exposto como parâmetro da tool** — não testado nesta rodada (fora do escopo obrigatório da tarefa); mais de um endpoint Getrak Web já mostrou HTTP 500 para seletores de campo mal formados (Epic 9/`search_accessories`, Epic 16/`get_user_details`). Reduzida a superfície de risco em vez de adivinhar contra produção.

**Nomenclatura:** o filtro de entrada documentado é `operation_type` (singular, com modificador `[in]` para múltiplos valores); exposto na tool como `operation_types` (plural) para refletir que ela sempre aceita uma lista. O campo de saída correspondente no item de resposta é `type`, não `operation_type(s)` — repassado como veio, sem renomear a resposta upstream.

**Nota sobre `"x-internal": true`:** o `openapi.json` marca este endpoint com essa flag (não vista em nenhum outro endpoint já consumido pelo projeto até agora). Sinalizado por transparência — nenhuma fonte de verdade (CLAUDE.md, PRD, Technical Brief, spec da US-079) trata essa flag como bloqueio de implementação; o único critério de vigência é `deprecated` (CLAUDE.md Seção 7), que este endpoint não tem. Não interpretado como impedimento, apenas registrado.

---

## Ainda não implementado

- Epic 6/7 (Telemetria, Webhooks) — Release 2, fora de escopo.
- Epic 8 (US-029) — tool composta `get_vehicle_operational_context`.
- US-032 (Epic 9) — bloqueada por GAP-018 (ver acima).
- US-038 (Epic 10) — bloqueada por GAP-019 (ver acima).
- US-076 (Epic 17) — bloqueada por falta de confirmação de caso de uso por Diego (Product Owner), conforme a própria spec exige.
- Epic 11 (US-043) — bloqueado por aprovação de Produto/Segurança.
- Epic 12 — nenhuma User Story gerada.
- Operações de envio/agendamento/cancelamento de notificação (tag `Notifications`, fora do escopo do Epic 18) — write, fora da V1.
- Ordenação em `search_operations` (`order[date]`, Epic 19) — parâmetro documentado, mas confirmado quebrado no backend para todo valor testado; não exposto pela tool até correção no backend.

Ver `CLAUDE.md` (Seções 0, 9 e 10) para o detalhamento completo de bloqueios e itens de Engineering Discovery em aberto.
