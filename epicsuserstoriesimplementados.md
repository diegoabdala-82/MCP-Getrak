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
| `search_accessories` | US-035 | `GET /v1.0/accessories` | `oauth2Password`/`GetrakWeb` (delegado) | ❌ Não |
| `search_accessory_categories` | US-036 | `GET /v1.0/accessories/categories` | `oauth2Password`/`GetrakWeb` (delegado) | ❌ Não |
| `get_accessories_summary` | US-037 | `GET /v1.0/accessories/summary` | `oauth2Password`/`GetrakWeb` (delegado) | ❌ Não |
| `search_central_integrations` | US-039 | `GET /v1.0/integrations` | `oauth2Password`/`GetrakWeb` (delegado) | ❌ Não |
| `search_geofences` | US-040 | `GET /v1.0/perimeters/geofences` | `oauth2Password`/`GetrakWeb` (delegado) | ❌ Não |
| `search_perimeter_categories` | US-041 | `GET /v1.0/perimeters/categories` | `oauth2Password`/`GetrakWeb` (delegado) | ❌ Não |
| `search_reference_points` | US-042 | `GET /v1.0/perimeters/reference-points` | `oauth2Password`/`GetrakWeb` (delegado) | ❌ Não |

**Status:** ✅ 7 tools implementadas e testadas (mocks/contrato), 38 testes automatizados novos (213 no total). Todas usam o fluxo de token delegado (US-046/047/048) implementado nesta mesma tarefa — **nenhuma credencial de usuário real de teste em homologação disponível até o momento**; validação contra produção real pendente, mesmo padrão já sinalizado para Epic 2/4/9.

**Nomenclatura ajustada:** a spec sugeriu prefixo `list_` para 5 das 7 tools (`list_accessory_categories`, `list_central_integrations`, `list_geofences`, `list_perimeter_categories`, `list_reference_points`); renomeadas para `search_*` — todas têm filtros reais por campo (name/status/is_active/type/client_id etc.), mesma convenção já aplicada em Epic 9. `search_accessories` e `get_accessories_summary` mantiveram os nomes sugeridos (já se encaixavam na convenção: filtro real e nenhum parâmetro, respectivamente).

**Domínios no catálogo MCP:** 3 novos domínios — `accessories` (US-035/036/037), `integrations` (US-039), `perimeters` (US-040/041/042) — nomes não definidos em spec, escolhidos por entidade de negócio.

**Excluída desta rodada:** US-038 (consultar fornecedores) — bloqueada por **GAP-019** (path do endpoint inferido de um trecho truncado do `openapi.json`, não confirmado).

**Decisão sobre acesso por papel (US-040/US-042):** a documentação da API Core indica que ADMIN/OPERADOR veem todos os registros da central, enquanto CLIENTE/SUBCLIENTE veem apenas os associados à própria empresa — mas o mecanismo pelo qual o MCP obteria o papel do usuário autenticado não está definido em nenhuma fonte disponível (nem PRD, nem Technical Brief, nem a resposta do endpoint de emissão de token). **Decisão tomada:** o MCP não implementa filtragem própria por papel — a API Core já aplica essa regra do lado dela; o MCP apenas repassa o resultado já filtrado (opção (b) da tarefa). Nenhuma lógica de papel foi adicionada.

**Divergências/achados documentados durante a implementação** (não decididos silenciosamente — ver comentários nos arquivos-fonte para o detalhe completo):
- Nenhum dos 7 endpoints aceita `sistema`/central como parâmetro de request (diferente de Epic 2/4/9) — a identidade do usuário Getrak (token delegado) já é inerentemente ligada a uma central; `central` continua exigido como parâmetro de entrada da tool (gate de autorização + chave do cache de token), mas nunca repassado ao endpoint.
- `fields[]`/`include[]` têm comportamento real heterogêneo entre endpoints do mesmo épico: em `/v1.0/integrations` são `explode:false` (um único valor separado por vírgula); em `/v1.0/perimeters/*` são repetidos (`fields[]=id&fields[]=name`, default explode=true); em `/v1.0/accessories`, `fields[]` é uma string única (não um array), formato ainda diferente dos dois anteriores. Cada tool trata o formato real do seu próprio endpoint.
- `GET /v1.0/integrations` retorna `credentials.token` (token de acesso de um provedor externo) nos itens de integração — dado sensível repassado como retornado pela API Core (mesmo tratamento de `cnpj`/`email` no Epic 9: mascarado só na auditoria, não na resposta ao consumidor autorizado). A tool expõe `fields` para que o consumidor restrinja os campos retornados, se preferir.
- Todos os 7 endpoints confirmadamente devolvem paginação real (`{data, page, pages, total}`), diferente da estimativa (`has_more`) usada em Epic 2-9 — `total_items`/`has_more` são exatos aqui.

---

## Ainda não implementado

- Epic 6/7 (Telemetria, Webhooks) — Release 2, fora de escopo.
- Epic 8 (US-029) — tool composta `get_vehicle_operational_context`.
- US-032 (Epic 9) — bloqueada por GAP-018 (ver acima).
- US-038 (Epic 10) — bloqueada por GAP-019 (ver acima).
- Epic 11 (US-043) — bloqueado por aprovação de Produto/Segurança.
- Epic 12 — nenhuma User Story gerada.

Ver `CLAUDE.md` (Seções 0, 9 e 10) para o detalhamento completo de bloqueios e itens de Engineering Discovery em aberto.
