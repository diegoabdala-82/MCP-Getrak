# Getrak Core MCP — Contexto de Projeto para Claude Code

Este arquivo é lido automaticamente pelo Claude Code no início de cada sessão neste repositório. Ele contém as regras que **valem para toda tool do projeto**, para que a codificação seja consistente sem precisar repetir contexto a cada tarefa.

As specs individuais (uma por User Story) definem endpoint, contrato de entrada/saída e critérios de aceite de cada tool específica. Este arquivo não substitui as specs — complementa com o que é transversal.

**Fontes de verdade deste projeto (nesta ordem, em caso de conflito):**
1. Instrução explícita mais recente do usuário na sessão
2. PRD - Getrak Core MCP (**v1.5**, Aprovado — pendente reconfirmação formal de Diego sobre TD-05, ver Seção 6)
3. Technical Brief - Getrak Core MCP (TECHNICALLY READY — WITH ENGINEERING DISCOVERY; TD-01 a TD-05 aprovados)
4. Specs individuais por User Story (pasta `Claude Code / Specs` no Notion — 48 documentos: US-001 a US-048, exceto lacunas registradas na Seção 9)
5. `epicsuserstoriesimplementados.md` — registro do que **já foi codificado e testado**; usar para não reimplementar, não para redefinir contrato (contrato vem da spec)

Não invente endpoints, schemas, regras de negócio ou capacidades que não estejam em uma dessas fontes. Se algo não estiver definido, pare e sinalize — não assuma.

---

## 0. Estado atual da implementação (atualizado 15/08/2026)

**Já implementado, testado e mergeado em `main` (PRs #1, #2 e #4):**
- Epic 1 — Fundação (US-001 a US-007): infraestrutura transversal completa. **Estendida em 15/08/2026** com o fluxo de identidade delegada (US-046, US-047, US-048): `DelegatedTokenManager`, `UserCredentialsProvider` (Env/AWS Secrets Manager), Auth Profile Registry (rejeição transversal de `scope`/`auth_profile`/`credential_id`), namespace de cache delegado distinto do técnico. Não usada ainda por Epic 2-9 (não migradas); consumida pela primeira vez pelo Epic 10.
- Epic 2 — Veículos (US-008 a US-012): 5 tools, `oauth2ClientCredentials`/`Integracao` — **ainda não testadas contra produção** (sem credencial desse tipo disponível até o momento).
- Epic 3 — Localização (US-013 a US-019): 7 tools, `oauth2Password` — **todas testadas contra produção real**. Três bugs reais encontrados e corrigidos (ver Seção 7).
- Epic 4 — Equipamentos (US-020, US-021): 2 tools, `oauth2ClientCredentials`/`Integracao` — não testadas contra produção.
- Epic 5 — Ordens de Serviço (US-022 a US-025): 4 tools, implementadas com `oauth2ClientCredentials` mas **testadas via `oauth2Password`** — decisão de qual esquema usar em produção real segue em aberto (ver Seção 6.3).
- **Epic 9 — Clientes, Subclientes, Perfis e Centrais (US-030, US-031, US-033, US-034): 4 tools, `oauth2ClientCredentials`/`Integracao` — ainda não testadas contra produção** (mesma limitação de credencial do Epic 2/4). US-032 (usuários) **não** foi implementada — segue bloqueada por GAP-018. Ver `epicsuserstoriesimplementados.md` para o detalhamento completo, incluindo decisões de nomenclatura e divergências encontradas.
- **Epic 10 — Domínios internos Getrak Web (US-035, US-036, US-037, US-039, US-040, US-041, US-042): 7 tools, `oauth2Password`/`GetrakWeb` via token delegado (US-046/047/048) — ainda não testadas contra produção** (nenhuma credencial de usuário real disponível até o momento). US-038 (fornecedores) **não** foi implementada — segue bloqueada por GAP-019. Ver `epicsuserstoriesimplementados.md` para o detalhamento completo, incluindo a decisão sobre acesso por papel (US-040/US-042).

Total: 34 tools MCP registradas, 213 testes automatizados.

**Ainda não implementado:**
- Epic 8 (US-029) — tool composta `get_vehicle_operational_context`.
- Epic 6/7 (Telemetria, Webhooks) — Release 2, fora de escopo desta fase.
- **Epic 11 (US-043)** — consulta de documentos de pagamento/KYC. **Bloqueado**: requer aprovação explícita de Produto e revisão de Segurança antes de qualquer código, mesmo sendo leitura.
- US-032 (dentro do Epic 9) — **bloqueada individualmente** por GAP-018 (ver Seção 9).
- US-038 (dentro do Epic 10) — **bloqueada individualmente** por GAP-019, path não confirmado (ver Seção 9).

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
