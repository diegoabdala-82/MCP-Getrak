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

## Epic 13 — Reports (Getrak Web, Release 3, novo 19/08/2026) (US-049, US-050)

| Tool | User Story | Endpoint | Auth | Testado contra produção |
|---|---|---|---|---|
| `search_reports` | US-049 | `GET /v1.0/report/reports` | `oauth2Password`/`GetrakWeb` (delegado) | ✅ Sim (19/08/2026) |
| `get_reports_summary` | US-050 | `GET /v1.0/report/reports/summary` | `oauth2Password`/`GetrakWeb` (delegado) | ✅ Sim (19/08/2026) |

**Status:** ✅ 2 tools implementadas e testadas (mocks/contrato + validação real), 14 testes automatizados novos (325 no total). Ambas reaproveitam o fluxo de token delegado já existente (US-046/047/048) — nenhuma infraestrutura nova de autenticação.

**Domínio no catálogo MCP:** novo domínio `reports`.

**Confirmado, por inspeção completa da tag `Reports` no `openapi.json` antes de codificar, que ela documenta 7 endpoints no total — só 2 de leitura, os 5 restantes são escrita:**
- `GET /v1.0/report/reports` (US-049) e `GET /v1.0/report/reports/summary` (US-050) — os 2 implementados.
- `POST /v1.0/report/reports` (criação), `POST /v1.0/report/reports/share` (compartilhamento), `PUT`/`DELETE /v1.0/report/reports/report-scheduling/{id}` (agendamento) e `DELETE /v1.0/report/reports/{reportId}` (exclusão) — todos de escrita, **nenhum implementado**, conforme instruído.

**Validado contra produção real em 19/08/2026** — mesma credencial de usuário real de teste da central de demonstração já usada para os Epics 10/16/17/18/19. Os 2 endpoints chamados diretamente antes de codificar, confirmando não serem `deprecated`.

**ACHADO CRÍTICO EM `search_reports` — paginação obrigatória, diferente de todo o resto do domínio Getrak Web:** `page` e `per_page` (nome real de wire, já indicado pelo próprio `x-codeSamples` do `openapi.json` — `?page=1&per_page=10` — e confirmado empiricamente) não são "opcionais com padrão no servidor" como em todos os outros endpoints paginados já implementados (Epic 10/16/17/18/19). Confirmado isolando cada caso:
- Sem nenhum parâmetro de paginação → HTTP 500 `{"error":"Internal error"}`.
- Só `page`, sem `per_page` → o mesmo HTTP 500.
- Só `per_page`, sem `page` → o mesmo HTTP 500.
- `page` + `per_page` juntos (mesmo com valores triviais, `page=1&per_page=2`) → HTTP 200 normal.

**Isso não exigiu nenhuma validação adicional na tool:** o helper `buildPagePerPagePagination`/`normalizePagination`, já usado por todo o domínio Getrak Web, sempre preenche `page`/`page_size` com um valor concreto (padrão 1/50) mesmo quando o consumidor da tool não informa nenhum dos dois — ou seja, a tool sempre envia os dois parâmetros à API Core, nunca reproduzindo o cenário que causa o HTTP 500. Documentado porque é a primeira vez neste projeto que a ausência de paginação quebra a chamada em vez de aplicar um padrão do lado do servidor — relevante para qualquer adapter futuro que reutilize esses helpers.

**ACHADO QUE INVERTE O PADRÃO DO EPIC 19 — formato de wire dos filtros de múltiplos valores:**
- `filters[report_type][in]` e `filters[status]` aceitam múltiplos valores **repetindo a mesma chave de query, SEM sufixo `[]`** — confirmado com union real e matematicamente exato: `report_type=km_traveled` sozinho → `total=80`; `report_type=speed` sozinho → `total=254`; os dois juntos (chave repetida) → `total=334` (exatamente 80+254, sem sobreposição). O mesmo padrão foi confirmado para `filters[status]` (`status=1`→50, `status=3`→905, os dois juntos→955).
- **Adicionar o sufixo `[]` (`filters[report_type][in][]=...`) FAZ O FILTRO SER SILENCIOSAMENTE IGNORADO** — retorna o total não filtrado (1203) em vez de aplicar o filtro ou dar erro.
- Isso é o **OPOSTO EXATO** do achado do Epic 19 (`GET /v1.0/operations`), onde faltar o sufixo `[]` em `filters[operation_type][in]` quebrava a chamada com HTTP 500. **Confirma, de forma concreta e não hipotética, a disciplina do projeto de nunca assumir o formato de wire de um endpoint por analogia com outro já implementado** — cada um dos dois endpoints foi validado isoladamente contra produção real antes de codificar, e cada um exigiu o tratamento oposto.

**Outros achados reais confirmados antes de codificar:**
1. **`order[created_at]` (ordenação, `search_reports`) CONFIRMADO FUNCIONANDO CORRETAMENTE** nas duas direções (`ASC`/`DESC`, ordenação real observada nos timestamps retornados) — diferente do `order[date]` do Epic 19, que estava quebrado no backend. Exposto na tool como `sort_direction`.
2. **`filters[created_at_start]`/`filters[created_at_end]` (intervalo de criação) confirmados funcionando** com valores ISO 8601 reais.
3. **Filtro sem correspondência retorna lista vazia normalizada, nunca erro** — confirmado com um `user_id` inexistente e um `report_type` inventado, ambos HTTP 200 com `{data: [], total: 0}`.
4. **`get_reports_summary` — `filters[report_type][notin]` confirmado com efeito real mensurável**: sem filtro, `{individual: 454, scheduled: 769}`; excluindo `km_traveled`, `{individual: 448, scheduled: 695}`; excluindo `speed`, `{individual: 355, scheduled: 607}` — reduções reais e distintas, confirmando que o filtro é aplicado de fato. O valor de exemplo do próprio `openapi.json` (`filters[report_type][notin]=individual`) não tem efeito nenhum quando testado — não é um bug do endpoint, é só um mau exemplo de documentação (`individual` é uma categoria do objeto de resposta `reports.individual`, não um `report_type` real); registrado para não ser confundido com um achado de comportamento quebrado. Mesmo padrão de wire do item anterior: `[]` no filtro `notin` também é silenciosamente ignorado.
5. **`get_reports_summary` funciona sem nenhum parâmetro** — diferente de `search_reports`, não exige paginação (resposta é um único objeto agregado, sem lista).

**Parâmetros documentados e NÃO expostos nesta rodada** (reduzindo a superfície de risco em vez de adivinhar contra produção, mesma disciplina de Epic 16/19): `filters[user_id]`, `filters[report_scheduling_id]` (+ `[is_null]`) e `include[]` em `search_reports`. Não testados nesta rodada — fora dos filtros citados como exemplo pela spec (tipo, período, status); item para validação futura, não uma limitação definitiva.

**Nota sobre `"x-internal": true`:** assim como `GET /v1.0/operations` (Epic 19), os 2 endpoints de leitura desta tag também têm essa flag no `openapi.json`. Mesmo tratamento: não é critério de bloqueio (só `deprecated` é, CLAUDE.md Seção 7), apenas registrado por transparência.

**Campo `link` na resposta de `search_reports`:** contém uma URL S3 pré-assinada (com assinatura/expiração) para baixar o relatório quando pronto. Repassado como veio, sem tratamento especial — mesmo padrão de "repassar como recebido" já usado para campos tipo-URL/credencial em outros domínios (ex.: `credentials.token` em `search_central_integrations`).

---

## Epic 21 — Equipments (Getrak Web, Release 3, novo 19/08/2026) (US-090 a US-102)

| Tool | User Story | Endpoint | Auth | Testado contra produção |
|---|---|---|---|---|
| `search_web_equipments` | US-090 | `GET /v1.0/equipments` | `oauth2Password`/`GetrakWeb` (delegado) | ✅ Sim (19/08/2026) |
| `get_web_equipment_details` | US-091 | `GET /v1.0/equipments/{serial_number}` | `oauth2Password`/`GetrakWeb` (delegado) | ✅ Sim (19/08/2026) |
| `search_equipment_devices` | US-092 | `GET /v1.0/equipments/devices` | `oauth2Password`/`GetrakWeb` (delegado) | ✅ Sim (19/08/2026) |
| `get_equipments_summary` | US-093 | `GET /v1.0/equipments/summary` | `oauth2Password`/`GetrakWeb` (delegado) | ✅ Sim (19/08/2026) |
| `search_equipment_carriers` | US-094 | `GET /v1.0/equipments/carriers` | `oauth2Password`/`GetrakWeb` (delegado) | ✅ Sim (19/08/2026) |
| `get_inventory_summary` | US-095 | `GET /v1.0/equipments/inventory-summary` | `oauth2Password`/`GetrakWeb` (delegado) | ✅ Sim (19/08/2026) |
| `search_inventory` | US-096 | `GET /v1.0/equipments/inventory` | `oauth2Password`/`GetrakWeb` (delegado) | ✅ Sim (19/08/2026) |
| `search_equipment_tags` | US-097 | `GET /v1.0/equipments/tags` | `oauth2Password`/`GetrakWeb` (delegado) | ✅ Sim (19/08/2026) |
| `get_equipment_tag_details` | US-098 | `GET /v1.0/equipments/tags/{id}` | `oauth2Password`/`GetrakWeb` (delegado) | ✅ Sim (19/08/2026) |
| `search_device_models` | US-099 | `GET /v1.0/equipments/device-models` | `oauth2Password`/`GetrakWeb` (delegado) | ✅ Sim (19/08/2026) |
| `search_equipment_import_requests` | US-100 | `GET /v1.0/equipments/files` | `oauth2Password`/`GetrakWeb` (delegado) | ✅ Sim (19/08/2026) |
| `get_equipment_import_items` | US-101 | `GET /v1.0/equipments/files/{id}/items` | `oauth2Password`/`GetrakWeb` (delegado) | ✅ Sim (19/08/2026) |
| `get_equipment_import_summary` | US-102 | `GET /v1.0/equipments/files/{id}/summary` | `oauth2Password`/`GetrakWeb` (delegado) | ✅ Sim (19/08/2026) |

**Status:** ✅ 13 tools implementadas e testadas (mocks/contrato + validação real), 54 testes automatizados novos (379 no total) — o maior Epic da Release 3 até agora. Todas reaproveitam o fluxo de token delegado já existente (US-046/047/048).

**Domínio no catálogo MCP:** novo domínio `web_equipments` — deliberadamente distinto de `equipments` (Epic 4, `EquipmentsIntegracao`/`oauth2ClientCredentials`), mesma convenção de `web_users` vs. `accounts` e `web_vehicles` vs. `vehicles`.

**Confirmado que a tag `Equipments` do `openapi.json` também documenta operações de escrita** — `DELETE /v1.0/equipments/{serial_number}`, `POST`/`PUT /v1.0/equipments/devices`, `POST`/`PUT`/`DELETE /v1.0/equipments/tags` (+ `/{id}`) e `POST /v1.0/equipments/files` (upload de arquivo de importação). Nenhuma delas implementada — só os 13 endpoints de leitura listados acima.

**Validado contra produção real em 19/08/2026** — mesma credencial de usuário real de teste da central de demonstração já usada para os Epics anteriores. Os 13 endpoints chamados diretamente antes de codificar, um por um — a tarefa pediu explicitamente para não assumir um padrão único de paginação entre eles, e essa cautela se confirmou necessária (ver achados abaixo).

### Paginação — três estilos reais distintos confirmados entre os 13 endpoints

1. **`page`/`per_page` nativo** (`/equipments`, `/equipments/carriers`, `/equipments/inventory`, `/equipments/device-models`, `/equipments/files`, `/equipments/files/{id}/items`) — o MESMO bug `perPage`/`per_page` de todo o resto do domínio Getrak Web reproduz aqui também nos 6: `perPage` silenciosamente ignorado, `per_page` respeitado. Implementado corretamente desde o início nos 6.
2. **Objeto agregado único, sem paginação** (`/equipments/summary`, `/equipments/inventory-summary`, `/equipments/files/{id}/summary`).
3. **ACHADO CRÍTICO — sem paginação nativa nenhuma** (`/equipments/devices`, `/equipments/tags`): confirmado empiricamente, isolando cada parâmetro, que `page`, `per_page`, `perPage`, `limit` e `offset` são TODOS ignorados — o endpoint sempre retorna a lista COMPLETA. Em `/equipments/devices`, isso significa devolver TODOS os ~18.200 equipamentos da central (~9 MB) em toda chamada, mesmo sem filtro nenhum. Tratado com `createClientSideSliceAdapter` (`foundation/pagination/pagination.ts`) — o mesmo adapter já existente no projeto, usado por `get_centrals` (Epic 9) para o mesmo problema — que corta a lista no lado do MCP para respeitar o guardrail de página/tamanho (CLAUDE.md Seção 4). Isso não elimina o custo real de rede/memória de buscar a lista inteira a cada chamada — uma limitação real do endpoint upstream, sinalizada explicitamente via `warnings` na resposta de `search_equipment_devices`/`search_equipment_tags`, não escondida do consumidor. Em `/equipments/tags` o dataset atual é pequeno (10 itens), mas o mesmo tratamento foi aplicado por consistência e proteção contra crescimento futuro.

### Achado adicional em `/equipments/devices` — parâmetros de nível raiz confirmadamente quebrados/enganosos

Os parâmetros documentados de nível raiz `device` e `serial_number` (sem `filters[...]`) foram testados e são **confirmadamente inúteis/quebrados para filtragem**: `device=<valor real>` retornou a lista INTEIRA sem filtrar (mesmo tamanho de bytes que sem nenhum parâmetro); `serial_number=<qualquer valor>` sozinho retornou HTTP 400 `{"error":"Device is mandatory"}` — um erro que não faz sentido para o parâmetro enviado. **Não expostos como parâmetros da tool** — só os filtros `filters[full_device_number]` (busca exata, confirmado funcionando) e `filters[status]` (confirmado reduzindo a lista real) foram expostos.

### Sobreposição investigada — US-090 (`search_web_equipments`) vs. US-020 (`search_equipments`, Epic 4)

Investigada conforme instruído, comparando os campos reais confirmados agora com o shape já documentado/implementado de US-020:
- **US-020** (`oauth2ClientCredentials`, `GET /v0.2/equipamentos/integracao`): `{chip, equipamento, id_veiculo, modulo, placa, sistema}` — visão orientada a VÍNCULO COM VEÍCULO (módulo, placa, id do veículo vinculado), nomes de campo em português.
- **US-090** (esta tool, `oauth2Password`): `{apn, carrier_name, central, chip_serial_number, created_at, description, device, device_number, model: {...}, serial_number, status, updated_at, user}` — visão orientada a INVENTÁRIO/ATIVO DE TELECOM (modelo do dispositivo, operadora/APN, chip, ciclo de vida via `status` L/D/M/A), nomes de campo em inglês, **sem nenhum campo de vínculo com veículo**.
- **Conclusão: mesmo domínio nominal ("busca de equipamentos"), mas conjuntos de campos quase inteiramente disjuntos** — a sobreposição é de nome/espaço conceitual, não de dado duplicado. Sobreposição bem mais fraca que a já registrada entre US-070/US-008 (Epic 17), que retornavam conceitos de cadastro de veículo quase idênticos. **Nenhuma tool consolidada ou descartada** — decisão de Produto/Engenharia, sinalizada no PR.

### Utilidade real de US-100/101/102 (importação) — avaliada conforme pedido

A spec já sinalizava natureza de acompanhamento de job, não domínio de negócio tradicional, pedindo avaliação explícita se o caso de uso não ficasse claro. Confirmado com dados reais desta central: existem 5 jobs de importação em lote de equipamentos já executados, todos com status `done_with_errors` — histórico real de operações de importação (não fila de jobs pendentes). **Conclusão: o caso de uso ficou claro** — suporte/diagnóstico ("esta importação teve erro? quais linhas falharam e por quê?"), mesmo papel que `search_operations` (Epic 19) e `search_reports` (Epic 13) cumprem para outros tipos de job/registro operacional deste projeto. Confirmado também que `get_equipment_import_items` com `filters[status][eq]=failure` reduziu corretamente de 4 para 2 itens, exatamente os 2 que também apareciam como `failures: 2` em `get_equipment_import_summary` para o mesmo id — os dois endpoints são consistentes entre si. Implementadas sem bloqueio.

### Outros achados reais confirmados antes de codificar

1. **`get_equipments_summary` (US-093) — shape de resposta diferente do documentado.** `openapi.json` documenta `{items: object}`; resposta real é um objeto plano `{active, inactive, maintenance, discarded, total, lost}`. `filters[model_id][eq]` confirmado com efeito real (contagens bem menores e distintas com `model_id=3`).
2. **`search_inventory` (US-096) — `order[current]=DESC` confirmado funcionando corretamente** (valores retornados em ordem decrescente real: 48, 30, 27, 17...). O filtro de modelo é `filters[model][eq]` (não `filters[model_id][eq]`, apesar do campo de saída se chamar `model.id`) — usado exatamente como documentado.
3. **`search_equipment_import_requests` (US-100) — `order[id]` confirmado funcionando corretamente** nas duas direções (`ASC`: 126,127,361,362,487; `DESC`: 487,362,361,127,126).
4. **`get_web_equipment_details` (US-091) e `get_equipment_tag_details` (US-098) — HTTP 404 limpo confirmado** para entidade inexistente (`{"error":"Equipment not found"}`/`{"error":"Tag not found"}`), mapeados para `EQUIPMENT_NOT_FOUND`/`EQUIPMENT_TAG_NOT_FOUND` via `notFoundCode`. `get_equipment_import_items`/`get_equipment_import_summary` (US-101/102) também confirmados com 404 limpo para id de importação inexistente (mensagens ligeiramente diferentes entre os dois — `"Equipment import not found"` vs. `"Import not found"` — ambas mapeadas para o mesmo código `EQUIPMENT_IMPORT_NOT_FOUND`, já que o texto exato nunca é repassado ao consumidor).
5. **`search_device_models` (US-099) — `filters[all_states]=true` não alterou o total nesta central** (126 com e sem o filtro) — sem evidência de estar quebrado, apenas que todos os modelos cadastrados já estão no estado padrão (`AVAILABLE`) nesta central de demonstração; diferente do achado de "confirmadamente quebrado" do Epic 19 (`order[date]`), que tinha um erro de servidor observável.
6. **Dado sensível observado incidentalmente em `/equipments/devices`:** um dos registros reais retornados continha um valor de `apn` com um payload de teste de XSS (`<script>alert('HaHah')</script>`), confirmando que a API Core repassa texto livre de terceiros sem sanitização — repassado como veio (a tool não executa nem renderiza HTML; é responsabilidade do lado que eventualmente exibir esse campo em UI tratá-lo como não confiável). Registrado por transparência, não uma ação tomada nesta implementação.

**Nota sobre `"x-internal": true`:** também presente nos endpoints desta tag no `openapi.json` (mesmo padrão já visto em Epic 13/19). Não tratado como bloqueio, apenas registrado.

---

## Epic 15 — Clients (Getrak Web, Release 3, novo 19/08/2026) (US-061 a US-066)

| Tool | User Story | Endpoint | Auth | Testado contra produção |
|---|---|---|---|---|
| `search_web_clients` | US-061 | `GET /v1.0/client` | `oauth2Password`/`GetrakWeb` (delegado) | ✅ Sim (19/08/2026) |
| `get_clients_summary` | US-062 | `GET /v1.0/clients/summary` | `oauth2Password`/`GetrakWeb` (delegado) | ✅ Sim (19/08/2026) |
| `get_subclients_summary` | US-063 | `GET /v1.0/clients/subclients/summary` | `oauth2Password`/`GetrakWeb` (delegado) | ✅ Sim (19/08/2026) |
| `search_entity_import_requests` | US-064 | `GET /v1.0/clients/import-entity` | `oauth2Password`/`GetrakWeb` (delegado) | ✅ Sim (19/08/2026) |
| `get_entity_import_details` | US-065 | `GET /v1.0/clients/import-entity/{id}` | `oauth2Password`/`GetrakWeb` (delegado) | ✅ Sim (19/08/2026) |
| `get_entity_import_items` | US-066 | `GET /v1.0/clients/import-entity/{id}/items` | `oauth2Password`/`GetrakWeb` (delegado) | ✅ Sim (19/08/2026) |

**Status:** ✅ 6 tools implementadas e testadas (mocks/contrato + validação real), 27 testes automatizados novos (406 no total). Todas reaproveitam o fluxo de token delegado já existente (US-046/047/048).

**Domínio no catálogo MCP:** novo domínio `web_clients` — deliberadamente distinto de `accounts`/`search_clients` (Epic 9, `ClientsIntegracao`/`oauth2ClientCredentials`), mesma convenção de `web_users` vs. `accounts`, `web_vehicles` vs. `vehicles` e `web_equipments` vs. `equipments`.

**Confirmado que a tag `Clients` do `openapi.json` também documenta operações de escrita** — `PUT /v1.0/clients/{id}/status`, `PUT /v1.0/clients/batch-status`, `PUT /v1.0/clients/subclients/{id}/status`, `PUT /v1.0/clients/subclients/batch-status` (mudança de status de cliente/subcliente, individual e em lote) e `POST /v1.0/clients/import-entity` (upload de arquivo de importação). Nenhuma delas implementada — só os 6 endpoints de leitura.

**Validado contra produção real em 19/08/2026** — mesma credencial de usuário real de teste da central de demonstração já usada para os Epics anteriores. Os 6 endpoints chamados diretamente antes de codificar.

### Achado crítico em `search_web_clients` (US-061) — superfície de campos muito mais restrita que o documentado

O schema de resposta documentado no `openapi.json` promete um item de cliente completo (`business_phone, city, document, email, id, name, neighborhood, state, status, street_address, street_number, type`). Na prática:
- **Sem `fields[]`, a resposta real só traz `{id, name}`.**
- **`fields[]` tem um enum documentado restrito a só 4 valores:** `id`, `name`, `city`, `createdAt`. Confirmado empiricamente que pedir qualquer campo fora desse enum (`type`, testado) derruba a chamada inteira com HTTP 500 (`{"error":"Property \"type\" was not found in \"Client\". Make sure your query is correct."}`).
- **Conclusão: os campos de contato/documento do cliente (CNPJ/documento, telefone, e-mail, endereço, tipo, status) não são obtíveis por esta tool**, apesar de estarem documentados no schema de resposta do próprio endpoint — só `id`, `name`, e opcionalmente `city`/`created_at`. Implementado com `fields` restrito ao mesmo enum de 4 valores confirmado seguro, e a descrição da tool já avisa explicitamente para usar `search_clients` (Epic 9) quando esses dados forem necessários.
- `fields[]=createdAt` (camelCase de entrada) mapeia corretamente para a chave de saída `created_at` (snake_case) — mesmo padrão camelCase-de-entrada/snake_case-de-saída já visto em outros endpoints Getrak Web (ex.: `GET /v1.0/users/{id}`, Epic 16).

### Achado que reproduz o padrão do Epic 19 (oposto do Epic 13) — formato de wire de `filters[id][in]`

Confirmado que `filters[id][in]` em `GET /v1.0/client` **exige o sufixo de array `[]`**: `filters[id][in][]=<id1>&filters[id][in][]=<id2>` filtrou corretamente para exatamente os 2 ids reais pedidos; sem o `[]` (chave repetida sem sufixo), o filtro foi **silenciosamente ignorado** (retornou o total não filtrado, 2102). Mesmo padrão de `/v1.0/operations` (Epic 19), oposto do confirmado em `/v1.0/report/reports` (Epic 13) e em `/v1.0/equipments`/`/v1.0/equipments/summary` (Epic 21, comma-joined) — mais uma reconfirmação de que cada endpoint precisa ser validado individualmente.

Demais filtros confirmados funcionando com totais reais distintos: `filters[status]` (`Y`→1868, `S`→88 — consistentes com `get_clients_summary`), `filters[type]` (`individual`→148, `legal-entity`→27), `filters[name][inc]`/`filters[city][inc]` (substring), `filters[created_at][gte]`/`[lte]` (intervalo). `order[id]`/`order[name]` confirmados funcionando corretamente nas duas direções. Filtro sem correspondência retorna lista vazia normalizada, nunca erro.

### Sobreposição investigada — US-061 (`search_web_clients`) vs. US-030 (`search_clients`, Epic 9)

Investigada conforme instruído. Sem credencial `oauth2ClientCredentials` disponível para testar US-030 ao vivo (mesma limitação já registrada para todo o Epic 2/4/9), a comparação foi feita contra o shape já documentado/confirmado de US-030:
- **US-030** (`oauth2ClientCredentials`, `GET /v0.2/clientes/integracao`): campos documentados incluem `ativo, cel, cel2, cnpj, descricao, email, email2, endereco, ...` — nomes em português, aparentando ser o registro de cliente **completo** (contato, documento, endereço).
- **US-061** (esta tool, `oauth2Password`): **estruturalmente limitada pelo próprio endpoint** a `{id, name}` (+ opcionalmente `city`/`created_at` via `fields[]`) — ver achado acima.
- **Conclusão: diferente da sobreposição fraca já registrada em US-090/US-020 (Epic 21, campos quase totalmente disjuntos por natureza conceitual), aqui os dois endpoints parecem representar o MESMO registro de cliente subjacente** (mesma central, mesmo conceito de "cliente") — mas com uma diferença real e mensurável de superfície exposta, que é uma limitação do próprio endpoint `GET /v1.0/client`, não uma escolha desta implementação. **Nenhuma tool consolidada ou descartada** — decisão de Produto/Engenharia, sinalizada no PR. Recomendação prática incluída na descrição da tool: se o consumidor precisar de CNPJ/telefone/e-mail, usar `search_clients` (Epic 9), não esta.

### Achado crítico em `get_entity_import_items` (US-066) — HTTP 500 em vez de 404 para id inexistente

Diferente de `get_entity_import_details` (US-065), que retorna um HTTP 404 limpo (`{"error":"import not found"}`) para um id de importação inexistente, `get_entity_import_items` retorna **HTTP 500** para o MESMO cenário conceitual (`{"status":500,"error":"Import entity with id 999999 not found."}`). Isso é tratado corretamente **sem nenhum código extra**, graças ao comportamento já existente de `normalizeUpstreamHttpError` (`foundation/errors/error-normalizer.ts`): qualquer status HTTP fora de 404/401/403/429/5xx-transiente cai no branch final, que usa `domainCode ?? UPSTREAM_ERROR` — ou seja, o HTTP 500 com `notFoundCode: "ENTITY_IMPORT_NOT_FOUND"` já mapeia corretamente para o mesmo código usado pelo 404 limpo de US-065. Esse é o MESMO tradeoff já aceito e documentado em `get_user_details` (Epic 16) e `get_vehicle_by_plate` (Epic 17): um HTTP 500 genuinamente não relacionado a "não encontrado" também seria mapeado para `ENTITY_IMPORT_NOT_FOUND` por esse mesmo mecanismo — aceito conscientemente, não uma omissão.

### Utilidade real de US-064/065/066 (importação de entidade) — avaliada conforme pedido

Mesma natureza operacional de job de importação já observada em US-100/101/102 (Epic 21). Confirmado com dados reais desta central: **42 requisições reais de importação de clientes/subclientes** (31 `client` + 11 `subclient`, confirmado com `filters[entity]`), todas com status `done_with_errors` — histórico real de importações executadas, não uma fila de jobs pendentes. **Conclusão: o caso de uso é claro** — suporte/diagnóstico de erros de carga em lote, mesmo papel que US-100/101/102 cumprem para importação de equipamentos. Implementadas sem bloqueio.

### Outros achados reais confirmados antes de codificar

1. **Path singular vs. plural em `GET /v1.0/client`:** o `openapi.json` declara o path como singular (`/v1.0/client`) em `paths`, mas o próprio `x-codeSamples` usa o plural (`/v1.0/clients`). Confirmado empiricamente que ambos retornam resultado idêntico (mesmo total, mesmos itens) — implementado com o path singular, por ser o que está de fato declarado em `paths` (a fonte de verdade estrutural do documento).
2. **`get_clients_summary`/`get_subclients_summary` (US-062/063) — nenhum parâmetro de request; resposta real `{active, inactive, suspended, total}`**, exatamente como documentado. Consistência cruzada confirmada: `active: 1868` e `suspended: 88` de `get_clients_summary` batem exatamente com `filters[status]=Y`/`filters[status]=S` de `search_web_clients`.
3. **Pagination — mesmo bug `perPage`/`per_page` do resto do domínio Getrak Web**, reproduzido nos 3 endpoints de lista deste domínio (`/v1.0/client`, `/v1.0/clients/import-entity`, `/v1.0/clients/import-entity/{id}/items`).
4. **`filters[entity]` em `search_entity_import_requests`** confirmado funcionando: `client`→31, `subclient`→11, soma exata do total sem filtro (42).
5. **`filters[status][eq]`/`order[name]` em `get_entity_import_items`** confirmados funcionando via o próprio `x-codeSamples` do `openapi.json` e teste real (reduziu corretamente para o item com status `failure`).

**Nota sobre `"x-internal": true`:** também presente em todos os 6 endpoints desta tag no `openapi.json` (mesmo padrão já visto em Epic 13/19/21). Não tratado como bloqueio, apenas registrado.

---

## Epic 14 — Maintenance (Getrak Web, Release 3, novo 20/08/2026) (US-051 a US-060)

| Tool | User Story | Endpoint | Auth | Testado contra produção |
|---|---|---|---|---|
| `search_fuel_supplies` | US-051 | `GET /v2.0/maintenance/fuel-supply` | `oauth2Password`/`GetrakWeb` (delegado) | ✅ Sim (20/08/2026) |
| `get_fuel_supply_summary` | US-052 | `GET /v2.0/maintenance/fuel-supply/summary` | `oauth2Password`/`GetrakWeb` (delegado) | ✅ Sim (20/08/2026) |
| `get_fuel_supply_details` | US-053 | `GET /v2.0/maintenance/fuel-supply/{id}` | `oauth2Password`/`GetrakWeb` (delegado) | ✅ Sim (20/08/2026) |
| `get_fuel_supply_attachments` | US-054 | `GET /v2.0/maintenance/fuel-supply/{id}/attachments` | `oauth2Password`/`GetrakWeb` (delegado) | ✅ Sim (20/08/2026) |
| `search_maintenance_services` | US-055 | `GET /v2.0/maintenance/services` | `oauth2Password`/`GetrakWeb` (delegado) | ✅ Sim (20/08/2026) |
| `get_maintenance_services_summary` | US-056 | `GET /v2.0/maintenance/services/summary` | `oauth2Password`/`GetrakWeb` (delegado) | ✅ Sim (20/08/2026) |
| `search_maintenances` | US-057 | `GET /v2.0/maintenance/maintenances` | `oauth2Password`/`GetrakWeb` (delegado) | ✅ Sim (20/08/2026) |
| `get_maintenances_summary` | US-058 | `GET /v2.0/maintenance/maintenances/summary` | `oauth2Password`/`GetrakWeb` (delegado) | ✅ Sim (20/08/2026) |
| `get_maintenance_details` | US-059 | `GET /v2.0/maintenance/maintenances/{id}` | `oauth2Password`/`GetrakWeb` (delegado) | ✅ Sim (20/08/2026) |
| `get_maintenance_attachments` | US-060 | `GET /v2.0/maintenance/maintenances/{id}/attachments` | `oauth2Password`/`GetrakWeb` (delegado) | ✅ Sim (20/08/2026) |

**Status:** ✅ 10 tools implementadas e testadas (mocks/contrato + validação real), 42 testes automatizados novos (448 no total). Todas reaproveitam o fluxo de token delegado já existente (US-046/047/048).

**Domínio no catálogo MCP:** novo domínio `maintenance` (sem prefixo `web_`) — não existe nenhum equivalente `oauth2ClientCredentials`/`Integracao` deste domínio em nenhum epic anterior, mesma convenção de nomenclatura já usada para `operations`/`reports`/`notifications`.

**Confirmado que todos os 10 endpoints são `v2.0` e nenhum é `deprecated`** — diferente de outros epics anteriores, aqui não havia nenhum equivalente `v0.x`/`v1.0` a evitar. Confirmado também, por inspeção completa da tag `Maintenance`, que ela documenta um número grande de operações de escrita (`POST`/`PUT`/`DELETE` de abastecimento, manutenção — incluindo `bulk-remove` e `finish` — e serviço — incluindo `bulk-remove` e `bulk-update/status` — além de `POST /v2.0/maintenance/attachments/upload-url`) — nenhuma delas implementada, só os 10 endpoints de leitura.

**Validado contra produção real em 20/08/2026** — mesma credencial de usuário real de teste da central de demonstração já usada para os Epics anteriores. Os 10 endpoints chamados diretamente antes de codificar, um por um — a tarefa pediu explicitamente para não assumir um padrão único de paginação entre eles, e essa cautela se confirmou necessária mais uma vez (achados abaixo).

### Achado crítico — DOIS estilos de envelope de paginação diferentes dentro do MESMO domínio Maintenance

- `GET /v2.0/maintenance/fuel-supply` e `GET /v2.0/maintenance/maintenances` usam o padrão plano `{data, page, pages, total}` já visto em todo o resto do domínio Getrak Web — `extractPagePerPageEnvelope` reaproveitado sem alteração.
- **`GET /v2.0/maintenance/services` usa um envelope ANINHADO real: `{data, pagination: {total, page, itemsPerPage, totalPages}}`** — confirmado empiricamente, e ainda por cima com chaves camelCase diferentes das que o próprio `openapi.json` documenta para essas mesmas chaves (`items_per_page`/`total_pages`, snake_case) — mais uma divergência documentação-vs-realidade (CLAUDE.md Seção 7). `extractPagePerPageEnvelope` não se aplica; implementada uma extração local (`extractServicesEnvelope`) só para este endpoint.
- Em ambos os estilos, o NOME REAL do parâmetro de query de tamanho de página continua sendo `per_page` — confirmado que nem `perPage` nem `items_per_page` (tentativa alinhada ao nome de resposta) têm qualquer efeito nos 3 endpoints de lista deste domínio.

### Achado crítico — validação de existência de veículo é específica do sub-domínio `fuel-supply`, não do domínio Maintenance inteiro

Confirmado que `filters[vehicle_id]` em `search_fuel_supplies`/`get_fuel_supply_summary` retorna **HTTP 404** (`{"error":"Vehicle not found"}`) quando o `vehicle_id` não existe — diferente de todo outro filtro deste domínio (que retornam lista/resumo vazio normalizado). Testado explicitamente para descartar a hipótese de regra geral: o MESMO conceito de filtro (`filters[vehicle_id]`/`filters[vehicle_id][in][]`) em `search_maintenances` e `get_maintenances_summary` retorna resultado **zerado/vazio normalmente (HTTP 200)** para um `vehicle_id` inexistente. Ou seja, a validação de existência é uma regra do sub-domínio `fuel-supply` especificamente, não do domínio `Maintenance` como um todo — reforça, mais uma vez, que nem sub-endpoints do mesmo domínio nominal podem ser assumidos uniformes. `notFoundCode: "VEHICLE_NOT_FOUND"` foi aplicado em `search_fuel_supplies`/`get_fuel_supply_summary` (uso não convencional em tools de lista/resumo, normalmente reservado a lookups por id, mas justificado pelo comportamento real confirmado) e NÃO aplicado em `search_maintenances`/`get_maintenances_summary`.

### Achado crítico em `get_maintenance_details` (US-059) — a própria spec seria violada sem uma correção não documentada

A spec desta User Story exige explicitamente que o detalhe inclua "serviços associados + última execução", e o schema de resposta documentado no `openapi.json` mostra `services`/`last_execution` como propriedades sempre presentes do objeto de detalhe. **Isso é falso no comportamento real**: `GET /v2.0/maintenance/maintenances/{id}` sem parâmetro extra NÃO retorna nenhum dos dois campos (ausentes, não `null`). O endpoint só os inclui quando recebe o parâmetro `include[]` — documentado no `openapi.json` **apenas para o endpoint de LISTA irmão** (`GET /v2.0/maintenance/maintenances`), não para o de detalhe — mas confirmado, na prática, aceito e necessário também no detalhe. **Se a tool não enviasse `include[]=last_execution&include[]=services` proativamente, ela violaria seu próprio critério de aceite sem nenhum aviso.** Corrigido: `get_maintenance_details` sempre envia os dois valores de `include[]`, incondicionalmente, não exposto como parâmetro de entrada (não haveria motivo de negócio para pedir menos do que a própria spec exige).

### Decisão de bundle — US-054/US-060 (anexos), avaliada conforme pedido

**Decisão: mantidos como tools SEPARADAS** de `get_fuel_supply_details`/`get_maintenance_details`, não bundled. Racional, baseado em evidência coletada antes de decidir:
1. **Não existe mecanismo nativo de composição.** `GET /v2.0/maintenance/maintenances/{id}` — que TEM um `include[]` funcional e confirmado (usado para `last_execution`/`services`, ver achado acima) — foi testado explicitamente com `include[]=attachments` e não teve NENHUM efeito (resposta idêntica com ou sem esse valor). Ou seja, mesmo o único mecanismo de composição real que este domínio tem não se estende a anexos — não é uma limitação genérica de "endpoints de detalhe não aceitam parâmetro nenhum" (esse não é o caso), é uma limitação real e específica, confirmada por teste direto, não presumida.
2. **Anexos são um recurso com ciclo de vida próprio.** Cada item tem `status` (`completed`/`failed`/`pending_upload`) e uma `file_url` pré-assinada com **expiração curta** (`expires_at` ~1h após `created_at`, confirmado no exemplo do `openapi.json`). Embutir isso sempre no detalhe obrigaria toda chamada de `get_fuel_supply_details`/`get_maintenance_details` a pagar o custo de uma segunda consulta e devolver links que podem expirar antes de serem usados, mesmo quando o consumidor não pediu anexos.
3. **Consistente com o padrão já estabelecido no resto do projeto** para pares detalhe+drill-down relacionado: sempre tools separadas (US-065/US-066 no Epic 15, US-101/US-102 no Epic 21, `get_equipment_tag_details` vs. `search_equipment_tags` no Epic 21). Bundlar aqui seria a primeira exceção a esse padrão em todo o projeto, sem um motivo técnico forte o suficiente (a API não oferece nenhuma forma nativa de compor os dois).

Confirmado que os dois pares detalhe/anexos deste epic (US-053/054 e US-059/060) se comportam de forma **consistente** entre si para id inexistente — ambos retornam HTTP 404 limpo com a mesma mensagem em cada par (`"Fuel supply not found"`/`"Maintenance not found"`) — diferente da inconsistência 404-vs-500 já registrada para pares análogos no Epic 15/21.

### Outros achados reais confirmados antes de codificar

1. **`search_fuel_supplies` — `fields[]` confirmado como seletor EXATO**, e "Defaults to id only" (documentado) confirmado verdadeiro na prática: sem `fields[]`, cada item da resposta é literalmente só `{id}`. **Diferente de `search_maintenances`**, onde a mesma documentação ("Defaults to id only") é **falsa** — sem `fields[]`, a resposta já vem com o registro quase completo; e mesmo pedindo um subconjunto pequeno via `fields[]`, campos não pedidos (`central_id`, `maintenance_recurrence_id`, `status`, `type`) continuam aparecendo. `fields[]` não é exposto em `search_maintenances` por esse comportamento real inconsistente demais para confiar; é exposto em `search_fuel_supplies`, onde se comporta exatamente como documentado.
2. **`filters[fuel_type][in][]` (fuel-supply) e `filters[status][in][]`/`filters[vehicle_id][in][]`/`filters[service_id][in][]` (maintenances) — todos exigem o sufixo de array `[]`**, confirmado empiricamente (sem `[]`, o filtro é silenciosamente ignorado, retornando o total não filtrado). Diferente de outros epics, aqui o próprio nome do parâmetro no `openapi.json` já inclui o `[]` explicitamente — a documentação acertou o formato desta vez.
3. **`amount`/`volume`/`price_per_unit` (fuel-supply) vêm como STRING** na resposta real (ex.: `"408.00"`, `"12.000"`), apesar de documentados como `number` — repassados como vieram.
4. **Consistência cruzada confirmada em ambos os pares busca/resumo:** `get_fuel_supply_summary` sem filtro bateu com o total de `search_fuel_supplies`; `get_maintenance_services_summary` (`active: 13, inactive: 0`) bateu exatamente com `filters[status]=active`/`inactive` de `search_maintenance_services` para a mesma central.
5. **`order[supply_date]`/`order[vehicle_id]` (fuel-supply), `order[name]`/`order[value_cents]` (services) e `order[scheduled_date]` (maintenances) confirmados FUNCIONANDO corretamente** nas direções testadas.

**Nota sobre `"x-internal": true`:** também presente em todos os 10 endpoints desta tag no `openapi.json` (mesmo padrão já visto em Epic 13/15/19/21). Não tratado como bloqueio, apenas registrado.

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
