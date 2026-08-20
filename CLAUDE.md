# Getrak Core MCP — Contexto de Projeto para Claude Code

Este arquivo é lido automaticamente pelo Claude Code no início de cada sessão neste repositório. Ele contém as regras que **valem para toda tool do projeto**, para que a codificação seja consistente sem precisar repetir contexto a cada tarefa.

As specs individuais (uma por User Story) definem endpoint, contrato de entrada/saída e critérios de aceite de cada tool específica. Este arquivo não substitui as specs — complementa com o que é transversal.

**Fontes de verdade deste projeto (nesta ordem, em caso de conflito):**
1. Instrução explícita mais recente do usuário na sessão
2. PRD - Getrak Core MCP (**v1.5**, Aprovado — pendente reconfirmação formal de Diego sobre TD-05, ver Seção 6)
3. Technical Brief - Getrak Core MCP (TECHNICALLY READY — WITH ENGINEERING DISCOVERY; TD-01 a TD-05 aprovados)
4. Specs individuais por User Story (pasta `Claude Code / Specs` no Notion — 106 documentos: US-001 a US-048, US-049 a US-050 (Epic 13), US-051 a US-060 (Epic 14), US-061 a US-066 (Epic 15), US-067 a US-069 (Epic 16), US-070 a US-076 (Epic 17), US-077 a US-078 (Epic 18), US-079 (Epic 19), US-080 a US-089 (Epic 20), US-090 a US-102 (Epic 21), US-103 a US-105 (Epic 22) e US-106 (Epic 3, nova capacidade), exceto lacunas registradas na Seção 9)
5. `epicsuserstoriesimplementados.md` — registro do que **já foi codificado e testado**; usar para não reimplementar, não para redefinir contrato (contrato vem da spec)

Não invente endpoints, schemas, regras de negócio ou capacidades que não estejam em uma dessas fontes. Se algo não estiver definido, pare e sinalize — não assuma.

---

## 0. Estado atual da implementação (atualizado 19/08/2026)

**Já implementado, testado e mergeado em `main` (PRs #1, #2 e #4):**
- Epic 1 — Fundação (US-001 a US-007): infraestrutura transversal completa. **Estendida em 15/08/2026** com o fluxo de identidade delegada (US-046, US-047, US-048): `DelegatedTokenManager`, `UserCredentialsProvider` (Env/AWS Secrets Manager), Auth Profile Registry (rejeição transversal de `scope`/`auth_profile`/`credential_id`), namespace de cache delegado distinto do técnico. Não usada ainda por Epic 2-9 (não migradas); consumida pela primeira vez pelo Epic 10. **Corrigida em 16/08/2026** após teste real contra produção com credencial de usuário real (ver Seção 6.2 e Seção 7): formato do corpo da requisição de emissão de token, composição do `username`, e client_id/secret reais para o escopo `GetrakWeb`.
- Epic 2 — Veículos (US-008 a US-012): 5 tools, `oauth2ClientCredentials`/`Integracao` — **ainda não testadas contra produção** (sem credencial desse tipo disponível até o momento).
- Epic 3 — Localização (US-013 a US-019): 7 tools, `oauth2Password` — **todas testadas contra produção real**. Três bugs reais encontrados e corrigidos (ver Seção 7). **Estendido em 20/08/2026 com US-106 (`get_vehicle_last_registers`, `GET /v1/localization/vehicles/{vehicle_id}/last-registers`)** — 8ª tool do domínio, mas a ÚNICA usando o fluxo de token DELEGADO (`oauth2Password`/`GetrakWeb`, US-046/047/048), diferente das outras 7 (credencial técnica `PublicoCliente`, modelo antigo, não migrada). **Exceção documentada:** endpoint ausente do `openapi.json` (confirmado por busca completa no arquivo) — existência/parâmetros/shape vieram do Product Owner/Technical Owner, complementados por validação empírica real nesta rodada; não é precedente para tools futuras sem lastro na spec. Testada contra produção real (central "apresentacao"), com achados: mesmo bug recorrente `itemsPerPage`/`per_page` (nome de resposta ≠ nome real do parâmetro de request); `include[]` exige valores em **camelCase** na wire (`referencePoints`/`additionalTelemetries`), divergente do snake_case do contrato público da tool — traduzido internamente; `filters` só confirmado funcionando para `ignicao` (exposto como `ignition_on`) — `panico`/`velocidade`/`classification` testados e confirmados **sempre retornando 0 resultados sem erro**, não expostos; campo de data canônico escolhido: `datagps` (exposto como `gps_at`), com as 4 datas brutas preservadas em `raw_timestamps`; distinta de `get_vehicle_location_history`/US-014 (endpoints, parâmetros e propósito diferentes — data única + includes ricos vs. intervalo de datas), não consolidada. Pendências de Engenharia registradas (ver `epicsuserstoriesimplementados.md`): reportar formalmente a ausência do endpoint no `openapi.json`; solicitar códigos de erro adicionais além do 404; confirmar semântica exata das 4 datas; confirmar se a nomenclatura de telemetria em português é definitiva.
- Epic 4 — Equipamentos (US-020, US-021): 2 tools, `oauth2ClientCredentials`/`Integracao` — não testadas contra produção.
- Epic 5 — Ordens de Serviço (US-022 a US-025): 4 tools, implementadas com `oauth2ClientCredentials` mas **testadas via `oauth2Password`** — decisão de qual esquema usar em produção real segue em aberto (ver Seção 6.3).
- **Epic 9 — Clientes, Subclientes, Perfis e Centrais (US-030, US-031, US-033, US-034): 4 tools, `oauth2ClientCredentials`/`Integracao` — ainda não testadas contra produção** (mesma limitação de credencial do Epic 2/4). US-032 (usuários) **não** foi implementada — segue bloqueada por GAP-018. Ver `epicsuserstoriesimplementados.md` para o detalhamento completo, incluindo decisões de nomenclatura e divergências encontradas.
- **Epic 10 — Domínios internos Getrak Web (US-035, US-036, US-037, US-039, US-040, US-041, US-042): 7 tools, `oauth2Password`/`GetrakWeb` via token delegado (US-046/047/048) — as 7 testadas contra produção real em 16/08/2026**, com credencial de usuário real de teste (central de demonstração). Quatro discrepâncias reais encontradas e corrigidas nessa validação (ver Seção 7). US-038 (fornecedores) **não** foi implementada — segue bloqueada por GAP-019. Ver `epicsuserstoriesimplementados.md` para o detalhamento completo, incluindo a decisão sobre acesso por papel (US-040/US-042).
- **Epic 16 — Users, Getrak Web (Release 3, novo 16/08/2026) (US-067, US-068, US-069): 3 tools, `oauth2Password`/`GetrakWeb` via o mesmo token delegado (US-046/047/048), nenhuma infraestrutura de autenticação nova — as 3 testadas contra produção real em 17/08/2026**, mesma central de demonstração. Investigado explicitamente, via `get_current_user`, se a resposta de `GET /oauth/usuario` resolveria o gap de papel do usuário aberto no Epic 10 (US-040/US-042): a resposta real contém campos não documentados (`tipo`, `perfil`) que são candidatos fortes, mas nenhuma fonte confirma o mapeamento inteiro→papel — **o gap permanece aberto**, sem mapeamento inventado. Ver `epicsuserstoriesimplementados.md` para o detalhamento completo (divergências de shape em `GET /v1.0/users/{id}`, mesmo bug de paginação `perPage`/`per_page` do Epic 10 confirmado e já corrigido desde o início, decisão de minimização do campo `uid`).
- **Epic 17 — Vehicles, Getrak Web (Release 3, novo 16/08/2026) (US-070 a US-075): 6 tools, `oauth2Password`/`GetrakWeb` via o mesmo token delegado — as 6 testadas contra produção real em 17/08/2026**, mesma central de demonstração. **US-076 (`get_isoline_shape`) deliberadamente fora desta rodada** — a própria spec condiciona a implementação a confirmação de caso de uso por Diego, não obtida. **Achado crítico em `get_vehicle_by_plate` (US-073):** o endpoint real não filtra por central — retorna dados de uma consulta de placa genérica (estilo FIPE/DETRAN) para qualquer placa sintaticamente válida, mesmo sem nenhum veículo correspondente cadastrado na Getrak; a AC da spec ("placa sem correspondência → VEHICLE_NOT_FOUND") não reflete o comportamento observado. **Sobreposição de dados confirmada** entre `get_vehicle_status`/`search_vehicles_status` (US-074/075) e `get_vehicle_current_location` (US-013/Epic 3) — mesmos campos de localização/ignição; e sobreposição conceitual (não confirmada campo a campo, sem credencial disponível) entre `search_web_vehicles` (US-070) e `search_vehicles` (US-008/Epic 2). Nenhuma tool consolidada ou descartada — decisão de Produto/Engenharia. Ver `epicsuserstoriesimplementados.md` para o detalhamento completo.

- **Epic 18 — Notifications, Getrak Web (Release 3, novo 19/08/2026) (US-077, US-078): 2 tools, `oauth2Password`/`GetrakWeb` via o mesmo token delegado — comportamento real confirmado empiricamente em homologação antes da implementação (mesma central de demonstração), não formalmente re-testado após o código final por falta de nova janela de teste nesta rodada.** Confirmado o MESMO bug de paginação `perPage`/`per_page` já visto em Epic 10/16/17, em `search_messages` — corrigido desde o início com `per_page`. Dois desvios de tipo em relação ao `openapi.json`: `is_automatic` é booleano real (documentado como inteiro `0`/`1`) e `reading_rate` (US-078) é decimal real (ex.: `21.9`, documentado como inteiro) — ambos repassados como vieram, não convertidos. **Tensão explicitamente sinalizada, não resolvida silenciosamente**: a tarefa desta rodada pediu mascaramento de conteúdo de mensagem (`body`/`title`) tanto na resposta normalizada quanto na auditoria; o padrão transversal já em uso em todo o projeto (Epic 9/10/16/17) mascara só na auditoria via `deepMask` — nunca na resposta ao consumidor já autorizado para a central, entre outras razões porque `result.data` nunca entra no registro de auditoria. Mantido o padrão existente (pass-through na resposta) em vez de inventar uma exceção pontual de mascaramento de texto livre só para este domínio; sinalizado para decisão de Produto/Segurança se a política para conteúdo de mensagem precisar ser mais restritiva. Ver `epicsuserstoriesimplementados.md` para o detalhamento completo.

- **Epic 19 — Operations, Getrak Web (Release 3, novo 19/08/2026) (US-079): 1 tool, `oauth2Password`/`GetrakWeb` via o mesmo token delegado — comportamento real (incluindo os filtros obrigatórios e uma falha real de ordenação no backend) confirmado empiricamente em homologação antes de codificar.** Único endpoint da tag `Operations` no `openapi.json` — confirmado que não há nenhum outro path na mesma tag, então não há risco de ter replicado uma operação de escrita adjacente. **Achado crítico:** omitir qualquer um dos 3 filtros obrigatórios (`operation_type`, `entity_id`, `date`) não produz um HTTP 400 limpo — produz HTTP 500 `{"error":"Internal error"}` genérico; por isso a validação desses 3 filtros como campos obrigatórios do schema Zod da tool (que já roda antes de qualquer chamada à API Core, via `ToolRuntime`) é o único ponto real de proteção do consumidor contra esse erro cru. **Achado adicional:** o filtro documentado `filters[operation_type][in]` exige, na prática, o sufixo de array `[]` (`filters[operation_type][in][]`) — sem ele, mesmo com os 3 filtros logicamente presentes, a API retorna o mesmo HTTP 500 genérico. **Achado adicional:** o parâmetro opcional documentado `order[date]` está QUEBRADO no backend para todo valor testado (`ASC`/`DESC`/`asc`/inválido) — sempre retorna HTTP 500 com erro de SQL/validação vazando bruto; por isso não é exposto como parâmetro de entrada da tool (repassá-lo sempre quebraria a chamada). Paginação (`per_page`, por forte precedente do resto do domínio Getrak Web) não pôde ser reconfirmada com resultado não vazio nesta rodada — nenhuma combinação testada na central de demonstração retornou nenhum registro. Ver `epicsuserstoriesimplementados.md` para o detalhamento completo.

- **Epic 13 — Reports, Getrak Web (Release 3, novo 19/08/2026) (US-049, US-050): 2 tools, `oauth2Password`/`GetrakWeb` via o mesmo token delegado — comportamento real confirmado empiricamente em homologação antes de codificar.** Confirmado, por inspeção completa da tag `Reports` no `openapi.json`, que ela também documenta 5 operações de escrita (`POST`/`PUT`/`DELETE` de criação, compartilhamento e exclusão de relatório) — nenhuma delas implementada, só os 2 endpoints de leitura. **Achado crítico, diferente de todo o resto do domínio Getrak Web:** em `search_reports`, omitir `page` OU `per_page` (isoladamente ou os dois) não aplica uma página padrão — produz HTTP 500 `{"error":"Internal error"}`; os dois parâmetros são efetivamente obrigatórios juntos no wire, embora nenhum consumidor da tool precise notar isso (o helper de paginação padrão do projeto já sempre envia os dois com um valor concreto). **Achado que inverte o padrão do Epic 19:** os filtros de múltiplos valores (`filters[report_type][in]`, `filters[status]`) exigem repetir a chave de query **sem** sufixo `[]` — adicionar `[]` faz o filtro ser silenciosamente ignorado (comportamento oposto ao confirmado em `/v1.0/operations`, onde faltar o `[]` quebrava a chamada) — reforça que cada endpoint precisa ser validado individualmente, nunca por analogia com outro já implementado. `order[created_at]` (ordenação), diferente do `order[date]` quebrado do Epic 19, foi confirmado FUNCIONANDO corretamente nas duas direções. Ver `epicsuserstoriesimplementados.md` para o detalhamento completo.

- **Epic 21 — Equipments, Getrak Web (Release 3, novo 19/08/2026) (US-090 a US-102): 13 tools, `oauth2Password`/`GetrakWeb` via o mesmo token delegado — comportamento real de CADA um dos 13 endpoints confirmado individualmente em homologação antes de codificar (a tarefa pediu explicitamente para não assumir um padrão único de paginação entre eles).** Confirmados TRÊS estilos de paginação distintos entre os 13: (1) `page`/`per_page` nativo (mesmo bug `perPage`/`per_page` do resto do domínio Getrak Web, reproduzido em 6 dos 13 endpoints); (2) objeto agregado único sem paginação (3 endpoints de resumo); (3) **achado crítico** — `search_equipment_devices`/`search_equipment_tags` (`GET /v1.0/equipments/devices`/`/tags`) **não paginam sob NENHUMA convenção testada** (`page`, `per_page`, `perPage`, `limit`, `offset` — todos confirmados sem efeito), sempre retornando a lista completa (~18.200 equipamentos, ~9 MB, na central de demonstração); implementado com `createClientSideSliceAdapter` (mesmo padrão já usado em `get_centrals`, Epic 9) para respeitar o guardrail de página/tamanho do lado do MCP, com a limitação real sinalizada via `warnings` — não escondida do consumidor. **Sobreposição investigada (US-090 vs. US-020, Epic 4):** mesmo domínio nominal ("busca de equipamentos"), mas conjuntos de campos quase inteiramente disjuntos — US-020 é orientado a vínculo com veículo (módulo/placa/id_veiculo), US-090 é orientado a inventário de telecom (modelo/operadora/chip/status de ciclo de vida); sobreposição de nome, não de dado — nenhuma tool consolidada. **Utilidade de US-100/101/102 (importação) avaliada conforme pedido:** confirmado com dados reais (5 jobs de importação de equipamentos já executados nesta central) que o caso de uso é claro — histórico/diagnóstico de importações em lote, mesmo papel que `search_operations`/`search_reports` cumprem para outros tipos de registro operacional; implementadas sem bloqueio. Ver `epicsuserstoriesimplementados.md` para o detalhamento completo.

- **Epic 15 — Clients, Getrak Web (Release 3, novo 19/08/2026) (US-061 a US-066): 6 tools, `oauth2Password`/`GetrakWeb` via o mesmo token delegado — comportamento real de CADA um dos 6 endpoints confirmado individualmente em homologação antes de codificar.** Confirmado, por inspeção completa da tag `Clients` no `openapi.json`, que ela também documenta 5 operações de escrita (mudança de status de cliente/subcliente, individual e em lote, e upload de arquivo de importação) — nenhuma delas implementada. **Achado crítico em `search_web_clients` (US-061):** o schema de resposta documenta um item de cliente completo (telefone, e-mail, CNPJ/documento, endereço, tipo, status), mas o seletor `fields[]` real tem um enum restrito a só 4 valores (`id`, `name`, `city`, `createdAt`) — pedir qualquer outro campo documentado (`type`, testado) derruba a chamada inteira com HTTP 500; sem `fields[]`, a resposta padrão só traz `{id, name}`. Ou seja, os campos de contato/documento **não são obtíveis por esta tool**, só por `search_clients` (Epic 9). **Achado que reproduz o padrão do Epic 19 (oposto do Epic 13):** `filters[id][in]` em `GET /v1.0/client` exige o sufixo de array `[]` — sem ele, o filtro é silenciosamente ignorado. **Sobreposição investigada (US-061 vs. US-030, Epic 9):** diferente da sobreposição fraca do Epic 21 (US-090/US-020, campos quase disjuntos), aqui os dois endpoints parecem representar o MESMO registro de cliente subjacente, mas com uma diferença real de superfície exposta — US-030 aparenta expor o registro completo, US-061 é estruturalmente limitado pelo próprio endpoint a um subconjunto mínimo; nenhuma tool consolidada. **Achado crítico em `get_entity_import_items` (US-066):** id de importação inexistente retorna HTTP 500 genérico (não 404, diferente de `get_entity_import_details`/US-065 para o mesmo cenário) — mapeado corretamente mesmo assim para `ENTITY_IMPORT_NOT_FOUND` graças ao comportamento já existente (e já aceito, mesmo tradeoff do Epic 16/17) de `normalizeUpstreamHttpError`, que usa o `notFoundCode` fornecido como fallback para qualquer status não classificado. **Utilidade de US-064/065/066 (importação) avaliada conforme pedido:** confirmado com dados reais (42 jobs de importação de clientes/subclientes já executados nesta central) que o caso de uso é claro, mesmo papel que US-100/101/102 (Epic 21) cumprem para importação de equipamentos. Ver `epicsuserstoriesimplementados.md` para o detalhamento completo.

- **Epic 14 — Maintenance, Getrak Web (Release 3, novo 20/08/2026) (US-051 a US-060): 10 tools, `oauth2Password`/`GetrakWeb` via o mesmo token delegado — comportamento real de CADA um dos 10 endpoints confirmado individualmente em homologação antes de codificar.** Todos os endpoints são `v2.0` (nenhum `deprecated`). Confirmados DOIS estilos de envelope de paginação DIFERENTES dentro do próprio domínio: `fuel-supply`/`maintenances` usam o padrão plano `{data, page, pages, total}`; **achado crítico** — `/v2.0/maintenance/services` usa um envelope aninhado `{data, pagination: {total, page, itemsPerPage, totalPages}}` (camelCase, nem sequer igual ao `items_per_page`/`total_pages` snake_case documentado no openapi.json), exigindo uma extração local dedicada. **Achado crítico em `search_fuel_supplies`/`get_fuel_supply_summary`:** `filters[vehicle_id]` com um id de veículo inexistente retorna HTTP 404 (`"Vehicle not found"`), não lista/resumo vazio — confirmado que esse comportamento é específico do sub-domínio `fuel-supply`, já que o mesmo conceito de filtro em `search_maintenances`/`get_maintenances_summary` retorna resultado zerado normalmente (HTTP 200) para o mesmo cenário. **Achado crítico em `get_maintenance_details` (US-059):** a própria spec exige "serviços associados + última execução" no detalhe, e o `openapi.json` documenta esses campos como sempre presentes — mas a resposta real OMITE os dois por completo a menos que a tool envie `include[]=last_execution&include[]=services`, um parâmetro documentado só para o endpoint de LISTA irmão, não para o de detalhe; sem essa correção, a tool violaria seu próprio critério de aceite silenciosamente. **Decisão de bundle (US-054/US-060, avaliada conforme pedido):** anexos mantidos como tools SEPARADAS de `get_fuel_supply_details`/`get_maintenance_details` — não existe `include[]`/mecanismo nativo para compor anexos no detalhe (testado e descartado explicitamente), e anexos têm ciclo de vida e URLs pré-assinadas de expiração curta próprios, tornando bundling desnecessariamente caro para toda chamada de detalhe. Ver `epicsuserstoriesimplementados.md` para o detalhamento completo.

- **Epic 20 — Journeys, Getrak Web (Release 3, novo 20/08/2026) (US-080 a US-089): 10 tools, `oauth2Password`/`GetrakWeb` via o mesmo token delegado — comportamento real de CADA um dos 10 endpoints confirmado individualmente em homologação antes de codificar.** **GAP-020 resolvido conforme decisão de Engenharia já registrada nas specs ("Opção A"):** `GET /journeys` e `GET /journeys/drivers` existem simultaneamente como `v1.0` e `v2.0`, nenhuma marcada `deprecated` — `search_journeys`/`search_drivers` (US-080/US-083) são tools ÚNICAS, v2.0 como fonte primária, com fallback interno transparente para v1.0 (`callWithV1Fallback`, novo helper em `journeys/shared.ts`) só em caso de falha real de upstream (`UPSTREAM_ERROR`/`UPSTREAM_UNAVAILABLE`/`TIMEOUT`) — a versão nunca é parâmetro de tool. **Achado crítico que limita esse fallback na prática:** `GET /v1.0/journeys/drivers` (o endpoint de fallback de `search_drivers`) está QUEBRADO — retorna HTTP 500 para QUALQUER chamada testada, inclusive sem nenhum parâmetro (não é um filtro específico, é o endpoint inteiro; os endpoints vizinhos `v1.0/journeys/drivers/summary` e `v1.0/journeys/drivers/{id}` funcionam normalmente). O fallback foi implementado mesmo assim, exatamente como pedido — só não há ganho real de resiliência até a Getrak corrigir esse endpoint v1.0; **não acionado de verdade durante os testes em homologação** (v2.0 nunca falhou nesta rodada), testado apenas via simulação determinística (mock de falha de v2.0) nos testes automatizados. **Achado de divergência de schema entre versões (sinalizado, não mascarado):** `include[]=driver` em `GET /journeys` devolve um objeto `driver` com shape DIFERENTE em v1.0 (`{id, name, email, document, system, device}`) vs. v2.0 (`{id, name}`) — o fallback não é schema-transparente para esse include específico. **Achado crítico em `filters[client_id]` de `GET /v2.0/journeys`:** documentado como "ignorado para usuários client/subclient", mas testado contra produção real (usuário não-admin) e confirmado que qualquer valor não-zero retorna HTTP 500 — não exposto como parâmetro de `search_journeys`. **Achado crítico em `get_driver_details` (US-084):** id de motorista inexistente retorna HTTP 204 (sem corpo), não 404 — corrigido na fundação (`ApiCoreClient.get`, tratamento genérico de 204 como ausência de corpo, não um hack pontual desta tool) para não virar `INTERNAL_ERROR` por falha de parse de JSON vazio. **Achado crítico em `get_identifier_history` (US-089):** `filters[driver_id]` omitido produz HTTP 500 genérico (mesmo padrão do Epic 19/US-079) — por isso `driver_id` é obrigatório no schema Zod da tool. `GET /v1.0/journeys/vehicles/available` (US-088) não pagina sob nenhuma convenção testada — mesmo tratamento de `createClientSideSliceAdapter` já usado em `get_centrals`/Epic 21. Ver `epicsuserstoriesimplementados.md` para o detalhamento completo.

- **Epic 22 — Features, Getrak Web (Release 3, novo 20/08/2026) (US-103 a US-105): 3 tools, `oauth2Password`/`GetrakWeb` via o mesmo token delegado — comportamento real dos 3 endpoints confirmado individualmente em homologação antes de codificar. Último epic da Release 3/F12.** **Achado crítico confirmando a hipótese da spec:** US-103 (`get_central_features`, `GET /v1.0/centrals/features`) e US-104 (`get_central_feature_flags`, `GET /v1.0/centrals/feature-flags`) são conceitos genuinamente distintos, não redundantes — os 9 identificadores de US-103 (todos com sufixo `_mobile`, capacidades de exibição do app mobile) não têm nenhuma sobreposição com os 6 identificadores de US-104 (flags de rollout/produto tipo `ai_monitoring`/`video_monitoring`/`hide_getrak_store`) — nenhuma tool consolidada. **Achado crítico adicional:** a resposta de `GET /v1.0/centrals/features` não tem envelope `{data: ...}` — a própria raiz do JSON já é o objeto de features, diferente de `feature-flags`/`all-features` (ambos `{data: ...}`); o `openapi.json` não documenta nenhum schema de resposta para esse endpoint. **Achado sobre US-105 (`get_all_available_features`, `GET /v1.0/centrals/all-features`):** confirmado que não filtra por central (nenhum parâmetro de query documentado ou aceito) — é de fato um catálogo geral da plataforma; e confirmado que os 9 `identifier` do catálogo coincidem EXATAMENTE com os 9 de US-103, ou seja, o catálogo documenta os metadados de US-103, não de US-104. `central` continua obrigatório como parâmetro da tool (gate de autorização/cache do token delegado do MCP), mesmo o endpoint upstream não usando central — mesmo padrão de `get_current_user`/US-069; não foi possível confirmar empiricamente se o catálogo é idêntico entre centrais diferentes (só uma central de teste disponível). Ver `epicsuserstoriesimplementados.md` para o detalhamento completo e o resumo consolidado da Release 3 (F12).

Total: 86 tools MCP registradas, 517 testes automatizados.

**Ainda não implementado:**
- Epic 8 (US-029) — tool composta `get_vehicle_operational_context`.
- Epic 6/7 (Telemetria, Webhooks) — Release 2, fora de escopo desta fase.
- **Epic 11 (US-043)** — consulta de documentos de pagamento/KYC. **Bloqueado**: requer aprovação explícita de Produto e revisão de Segurança antes de qualquer código, mesmo sendo leitura.
- US-032 (dentro do Epic 9) — **bloqueada individualmente** por GAP-018 (ver Seção 9).
- US-038 (dentro do Epic 10) — **bloqueada individualmente** por GAP-019, path não confirmado (ver Seção 9).
- US-076 (dentro do Epic 17) — **bloqueada individualmente**: caso de uso não confirmado por Diego (Product Owner), condição exigida pela própria spec.

---

## 1. O que é este produto

O Getrak Core MCP é um produto interno da Getrak que expõe um catálogo curado de tools orientadas a tarefas sobre a Getrak API Core, via Model Context Protocol, para consumo por agentes de IA (o primeiro consumidor confirmado é o Claude Code).

A V1 é **predominantemente/preferencialmente 100% read-only**. O escopo de domínios cobre, por decisão de produto de 15/08/2026, os grupos `x-tagGroups` **Public, Integration e Getrak Web** da OpenAPI Core — não mais apenas veículos/localização/equipamentos/ordens de serviço. Cada tool continua sendo uma decisão deliberada de produto, com escopo, risco e valor avaliados individualmente; presença no `openapi.json` não é critério suficiente para virar tool (ver Epics 11/12 e gaps da Seção 9).

---

## 2. Stack e infraestrutura aprovadas (TD-02, TD-04)

- **Linguagem/runtime:** TypeScript / Node.js
- **Validação de schema:** Zod ou equivalente compatível com JSON Schema/MCP
- **Cloud:** AWS
- **Runtime de execução:** AWS ECS Fargate (stateless) — *condicionado*: se existir padrão corporativo obrigatório de EKS ou outro runtime AWS já vigente na Getrak, usar esse padrão em vez do ECS Fargate, mantendo a mesma arquitetura lógica. Não reabrir o Technical Brief por essa escolha.
- **Segredos:** AWS Secrets Manager, criptografados com AWS KMS
- **Acesso a serviços AWS:** IAM Roles for Tasks — nunca credenciais AWS estáticas
- **Imagens:** Amazon ECR
- **Observabilidade inicial:** CloudWatch Logs / Metrics / Alarms
- **Cache de tokens:** Amazon ElastiCache for Redis (ver Seção 5)
- **Ambientes:** development, homologation, production — isolados. **Homologation é o ambiente padrão de desenvolvimento e testes; produção nunca é padrão.**

---

## 3. Contrato padrão de tool (TD-01) — obrigatório para toda tool

### Nomenclatura
- Nome de tool e nomes de campo: `snake_case`
- Contratos técnicos e descrições de tool: inglês
- Mensagens ao usuário final podem respeitar o idioma do consumidor

### Envelope de sucesso
```json
{
  "data": {},
  "meta": {
    "request_id": "uuid",
    "central": "central-id",
    "partial": false
  },
  "warnings": []
}
```
- `data`: conteúdo principal retornado pela tool (schema específico de cada tool — ver spec individual)
- `meta.partial: true`: usar em tools compostas quando parte das fontes estiver indisponível, mas ainda for possível retornar dados úteis
- `warnings`: avisos que não invalidam a resposta

### Envelope de erro
```json
{
  "error": {
    "code": "VEHICLE_NOT_FOUND",
    "message": "Vehicle not found.",
    "retryable": false,
    "request_id": "uuid"
  }
}
```
Todo erro da API Core deve ser normalizado para este formato antes de chegar ao consumidor — nunca repassar o erro bruto da API Core.

### Parâmetros proibidos como entrada livre de tool
Nunca aceitar como parâmetro livre controlado pelo modelo:
- `environment`
- credenciais, client ID, client secret, tokens
- URLs de API
- chaves internas
- **(reforçado pelo modelo híbrido de identidade, TD-05):** `scope`, `auth_profile`, `credential_id` — a seleção do perfil de autenticação é sempre interna e determinística (ver Seção 6.1), nunca parâmetro de tool

Esses valores são resolvidos pela configuração da conexão MCP ou pelo Auth Profile Registry interno, nunca pelo agente chamador.

### Central
- `central` pode ser parâmetro de contexto de qualquer tool
- Nunca aceitar sem validação: deve estar entre as centrais autorizadas do consumidor antes de qualquer chamada à API Core
- Toda tentativa de acesso cross-central deve ser bloqueada e registrada em auditoria

### Estabilidade
A resposta bruta de um endpoint da API Core **nunca** é o contrato de uma tool. Toda tool cria sua própria normalização estável — isso permite evoluir a API Core sem quebrar consumidores do MCP.

---

## 4. Guardrails de paginação, timeout e retry (TD-03) — V1

Estes são valores de partida, sujeitos a recalibração após load tests, homologação e piloto. Não tratar como capacidade máxima real da API Core.

| Guardrail | Valor V1 |
|---|---|
| Paginação padrão | 50 itens |
| Paginação máxima | 100 itens |
| Rate limit — read tools | 60 chamadas/min por consumidor |
| Rate limit — write tools | 10 chamadas/min por consumidor (fora da V1, mas já pré-definido) |
| Rate limit agregado por central | 300 requests/min |
| Concorrência por central | 10 chamadas simultâneas |
| Timeout — chamada simples | 5 segundos |
| Timeout — tool composta | 12 segundos |
| Máximo de chamadas downstream por tool composta | 5 |
| Retry — read | até 2, apenas em erros transitórios (HTTP 429/502/503/504, timeout de conexão/rede), com backoff exponencial + jitter |
| Retry — write | 0 por padrão; automático só com garantia de idempotência (não aplicável na V1, que é read-only) |

Cada adapter de API deve encapsular o comportamento real de paginação do endpoint correspondente (`page/per_page`, `limit/offset`, ausência de paginação) — **nunca assumir um único modelo genérico de paginação para todos os endpoints.** Endpoints novos (Epic 9/10) devem ter seu padrão real de paginação confirmado empiricamente ao implementar, não apenas assumido a partir da spec (ver Seção 7).

---

## 5. Estratégia de cache (TD-04, revisado por TD-05)

**Cache de tokens:** sim, compartilhado, em Amazon ElastiCache for Redis, em **dois namespaces distintos**:
- Token delegado do usuário (`oauth2Password`): `mcp:{environment}:{central}:oauth2Password:{user_id}:{session_id}` (evoluindo para `{delegated_session_id}` quando a API Core disponibilizar esse identificador)
- Credencial técnica do MCP (`oauth2ClientCredentials`): `mcp:{environment}:{central}:oauth2ClientCredentials:{credential_id}`
- TTL em ambos: expiração do token menos 60 segundos de margem de segurança
- Tokens nunca aparecem em log, sob nenhuma circunstância, em nenhum dos dois namespaces

**Cache de dados operacionais:** **não existe na V1.** Não implementar cache genérico de respostas para dados de alta volatilidade (localização, velocidade, ignição, telemetria, status, ordens em andamento, tratamentos offline). Isso é intencional — o MCP é usado em contexto de investigação/diagnóstico, e dado desatualizado compromete a confiabilidade da ferramenta.

Todo cache (quando existir) deve ser isolado por `environment + central + resource`.

---

## 6. Autenticação — modelo híbrido de identidade (TD-05)

**Atualizado em 15/08/2026 — substitui o modelo anterior deste arquivo ("credenciais técnicas resolvidas por ambiente" como regra única).**

### 6.1 Princípio central
A API Core usa dois esquemas OAuth2, com responsabilidades distintas e não intercambiáveis:

- **`oauth2Password` → token delegado por sessão do usuário**, emitido pela própria API Core. Representa a identidade e as permissões reais do usuário Getrak autenticado. A API Core é a fonte de autoridade dessa identidade; o MCP nunca amplia esse acesso, podendo apenas restringi-lo.
- **`oauth2ClientCredentials` → credencial técnica do MCP**. Representa a integração MCP como aplicação técnica, não um usuário específico.

A seleção de qual esquema/escopo (`auth_profile`) uma tool usa é **determinística e definida na implementação da tool** (Auth Profile Registry interno), nunca escolhida pelo usuário, pelo agente de IA ou passada como parâmetro.

O MCP nunca usa token delegado em endpoint que exige `oauth2ClientCredentials`, nem o inverso.

### 6.2 Status de implementação
O fluxo de token delegado (US-046, US-047, US-048) **foi implementado em 15/08/2026** (mesma rodada do Epic 10, que o consome):

- **Endpoint de emissão:** `POST /newkoauth/oauth/token` (OAuth2 Password Grant padrão, já documentado no `openapi.json` como `oauth2Password.flows.password.tokenUrl`). Não é um mecanismo novo a descobrir — é o Password Grant OAuth2 convencional.
- **Origem da credencial do usuário (decisão de Engenharia, Opção A):** o usuário Getrak informa login/senha diretamente ao MCP, uma vez, na configuração da conexão MCP (não a cada chamada, não visível ao agente de IA). O MCP armazena essa credencial de forma segura (`UserCredentialsProvider`: AWS Secrets Manager em produção, variável de ambiente por usuário em desenvolvimento local — mesmo padrão já usado para credenciais técnicas) e a usa para obter e renovar o token delegado em nome do usuário (`DelegatedTokenManager`).
- **Itens ainda abertos, não bloqueantes para o que já está implementado:** ED-ID-05 (mecanismo exato de coleta/armazenamento da credencial de usuário na configuração da conexão MCP — implementado com o mínimo necessário para homologação, não uma decisão fechada de produto/UI) e ED-ID-06 (comportamento quando a senha do usuário expira/muda — implementado como erro `USER_CREDENTIAL_INVALID` não retryable). Refinar antes de expor a usuários reais em produção.
- **Corrigido em 16/08/2026, após teste real contra produção com uma credencial de usuário real de teste (central de demonstração) — três achados que a documentação/exemplos anteriores não previam (ver Seção 7):**
  1. O corpo da requisição a `POST /newkoauth/oauth/token` para o escopo `GetrakWeb` deve ser `multipart/form-data`, não `application/x-www-form-urlencoded` (`MultipartFormOAuth2Client`, distinto do `HttpOAuth2Client` usado pelo modelo técnico de Epic 3/5 — não alterado, para não arriscar regredir um fluxo já validado).
  2. O `username` enviado é o composto `{username}@{central}`, não o login isolado — a central faz parte da identidade OAuth, não é só um parâmetro de contexto do MCP. Corrigido em `DelegatedTokenManager.getAccessToken`.
  3. `client_id`/`client_secret` para o escopo `GetrakWeb` são credenciais reais da aplicação (obtidas com o time, não documentadas no `openapi.json`), não o exemplo `dev`/`dev` do bloco `servers` do `openapi.json` (esse exemplo foi testado e rejeitado com 401 antes da credencial real ser fornecida). Credenciais reais nunca são commitadas no repositório — resolvidas apenas via `UserCredentialsProvider` em runtime (Seção 6.2 acima).

As tools já implementadas com `oauth2Password` (Epic 3 — Localização; parte do Epic 5 — Ordens de Serviço) foram codificadas **antes** desta decisão de arquitetura, usando o modelo anterior (credencial técnica resolvida por ambiente, não token delegado por usuário). Isso é uma dívida técnica registrada, não um erro a corrigir às pressas: essas tools continuam funcionais e testadas contra produção real. A migração dessas tools para o modelo de token delegado deve ser tratada como item de trabalho técnico explícito, não feita silenciosamente dentro de outra tarefa — **não migradas nesta rodada**, conforme instruído.

**Regra prática para código novo:** tools que usam `oauth2Password`/`GetrakWeb` (Epic 10) devem consumir `DelegatedTokenManager` (via `ApiCoreClient.get({ delegatedTokenProvider })`), nunca chamar a API Core diretamente. Tools que usam exclusivamente `oauth2ClientCredentials` (ex.: Epic 9, exceto US-032) não têm essa dependência.

### 6.3 Decisão em aberto herdada do Epic 5
As tools de Ordens de Serviço (US-022 a US-025) aceitam ambos os esquemas na API Core, foram implementadas com `oauth2ClientCredentials` mas testadas via `oauth2Password`. Qual esquema usar definitivamente em produção **ainda não foi decidido** — isso é anterior e independente do modelo híbrido (TD-05), mas deve ser resolvido usando os mesmos princípios: se a tool precisa de identidade/permissão de um usuário específico, usa token delegado; se é uma operação técnica de integração, usa credencial técnica. Não decidir isso por conta própria ao tocar nesse código — sinalizar e aguardar decisão.

---

## 7. Versionamento de endpoint e confiabilidade da documentação

- Sempre preferir a versão vigente (não depreciada) de um endpoint quando houver equivalente.
- O critério de vigência é **exclusivamente a flag `deprecated` no `openapi.json`** — nunca inferir depreciação a partir do número de versão. Vários endpoints v0.1 usados neste projeto (ex.: localização, relatório de ordem de serviço) são vigentes.
- **Atualizado com base em achados reais de produção:** a documentação (`openapi.json` e specs derivadas dele) **não é infalível**. Na implementação do Epic 3, três discrepâncias reais entre documentação e comportamento em produção foram encontradas e corrigidas: shape de resposta diferente do documentado (US-013), parâmetro `fields[]` com comportamento não documentado (US-018), e path documentado incorretamente no `openapi.json` (US-019). Portanto:
  - Se uma spec individual referencia um endpoint, ele já foi verificado *contra a documentação* — mas isso não substitui a verificação empírica contra o comportamento real em homologação/produção ao implementar.
  - Quando o comportamento real divergir da documentação, **implementar conforme o comportamento real observado, documentando a divergência no PR** (não decidir isso silenciosamente nem reabrir a spec sozinho) — sinalizar a discrepância para que Contexto/PRD/Technical Brief sejam atualizados posteriormente.
  - Essa regra vale com força redobrada para os domínios novos (Epic 9/10), que ainda não têm nenhuma validação empírica — apenas mapeamento contra o `openapi.json`.
- **Epic 10 — validado contra produção real em 16/08/2026, quatro discrepâncias reais encontradas e corrigidas:** três no fluxo de emissão do token delegado (formato `multipart/form-data`, composição `{username}@{central}`, client_id/secret reais do escopo `GetrakWeb` — ver Seção 6.2) e uma no nome do parâmetro de paginação: o `openapi.json` usa `perPage` como identificador do `$ref` em `components/parameters`, mas o parâmetro de query real (campo `name` dentro do próprio parâmetro) é `per_page` — as 6 tools paginadas do Epic 10 enviavam `perPage` (o identificador do `$ref`, não o nome real do parâmetro), que a API real simplesmente ignorava, sempre aplicando seu próprio tamanho de página padrão independente do que o consumidor pedisse. Corrigido em todos os 6 arquivos; confirmado empiricamente que `page_size` agora é respeitado.

---

## 8. Segurança, privacidade e auditoria

Dados considerados sensíveis neste projeto: localização, placa, chassi, CPF, CNPJ, telefone, e-mail, identificadores de cliente/subcliente/usuário/motorista/equipamento, telemetria, tokens, credenciais, documentos de pagamento/KYC.

- Toda execução de tool gera um registro de auditoria estruturado: `request_id`, usuário/agente, ambiente, central, tool, endpoint(s), método, esquema de autenticação usado (`delegated_user` ou `technical_client`), classificação de risco, resultado, status, duração, entidades afetadas.
- Nunca persistir integralmente em log: tokens, segredos, CPF, telefone, e-mail, payloads sensíveis completos.
- Mascaramento e minimização aplicados tanto na resposta normalizada quanto no log de auditoria.
- Correlação ponta a ponta sempre pelo `request_id`.

---

## 9. Fora de escopo da V1 e bloqueios explícitos — não implementar sem nova decisão

- Qualquer operação de **escrita** (criação, atualização, exclusão, suspensão, reativação, envio/cancelamento de comando, finalização de ordem, criação/remoção de webhook).
- Operações de **alto risco** de qualquer natureza.
- **RabbitMQ** — fora da V1; se abordado no futuro, não modelar como tool síncrona convencional sem análise arquitetural específica.
- Cliente/subcliente, telemetria e ordens de serviço dentro da tool composta `get_vehicle_operational_context` (escopo dela é só cadastro + equipamento + localização).
- **US-032** (consultar usuários, Epic 9) — bloqueada por **GAP-018**: o `openapi.json` documenta este endpoint sob `oauth2Password` + escopo `Integracao`, combinação atípica frente ao modelo híbrido (Seção 6.1). Não implementar até a Engenharia confirmar qual modelo de autenticação se aplica de fato.
- **US-038** (consultar fornecedores, Epic 10) — bloqueada por **GAP-019**: path do endpoint foi inferido de um trecho truncado do `openapi.json`, não confirmado. Não implementar até confirmação do path exato.
- **US-043** (documentos de pagamento/KYC, Epic 11) — bloqueada: requer justificativa de caso de uso aprovada por Produto e revisão explícita de Segurança antes de qualquer código, mesmo sendo leitura.
- **Epic 12** (Orchestrator, Realtime/SSE, Importer, Videotelemetry) — nenhuma User Story foi gerada; não inventar tools para esses domínios.
- Domínios sem endpoint de leitura confirmado: Finanças, RecoveryCases, Casualties (leitura) — nenhuma tool deve ser criada para eles nesta fase.
- Qualquer tool não listada nas specs da pasta `Claude Code / Specs`.

---

## 10. Itens de Engineering Discovery ainda abertos (relevantes ao codificar)

- **ED-01** — Paginação real por endpoint ainda não mapeada exaustivamente; ao implementar cada adapter, documentar o comportamento real encontrado (ver Seção 7).
- **ED-02** — Autenticação combinada em `get_vehicle_operational_context` (US-029) ainda não validada em homologação. Implementar de forma defensiva.
- **ED-ID-01 — Closed (15/08/2026).** Fluxo de emissão do token delegado: OAuth2 Password Grant padrão via `POST /newkoauth/oauth/token`, com credencial de usuário (login/senha) coletada na configuração da conexão MCP e armazenada com segurança pelo MCP (ver Seção 6.2).
- **ED-ID-02** — estrutura de identidade de sessão por conexão MCP ainda não definida pelo transporte; `DelegatedTokenManager` usa `DEFAULT_DELEGATED_SESSION_ID` fixo como placeholder (não distingue múltiplas sessões simultâneas do mesmo usuário). Não bloqueante — namespace de cache continua isolado por environment+central+user_id.
- **ED-ID-03, ED-ID-04** — múltiplos escopos por sessão, suporte a refresh token — abertos, não bloqueantes para o que já está implementado.
- **ED-ID-05, ED-ID-06 — implementados com o mínimo necessário para homologação, não fechados como decisão de produto.** ED-ID-05 (armazenamento da credencial de usuário): `UserCredentialsProvider` (Env local / AWS Secrets Manager por usuário), sem UI de login. ED-ID-06 (senha expirada/alterada): erro `USER_CREDENTIAL_INVALID`, não retryable, sinalizando a necessidade de atualizar a credencial. Revisitar antes de expor a usuários reais em produção.

Esses itens não impedem a implementação do que já está desbloqueado, mas o código para as áreas afetadas deve ser escrito para acomodar ajuste posterior — não travar em suposições como se fossem definitivas.

---

## 11. Onde encontrar o resto

- Specs de cada User Story (endpoint exato, contrato de entrada/saída, critérios de aceite): pasta **Claude Code / Specs** no Notion do projeto (48 documentos, US-001 a US-048).
- Decisões técnicas completas com racional: **Technical Brief - Getrak Core MCP** no Notion (inclui TD-05 e o documento de Engenharia "Arquitetura de Identidade, Autenticação, Autorização e Credenciais").
- Requisitos de produto, personas, journeys, métricas: **PRD - Getrak Core MCP** (v1.5) no Notion.
- O que já foi codificado e testado: `epicsuserstoriesimplementados.md`, na raiz deste repositório.

Se uma spec individual e este arquivo parecerem conflitar, este arquivo (regras transversais aprovadas) prevalece sobre suposições implícitas em qualquer spec — mas nenhum dos dois prevalece sobre o PRD ou o Technical Brief em caso de conflito real. Nesse caso, pare e sinalize a inconsistência em vez de escolher um lado.
