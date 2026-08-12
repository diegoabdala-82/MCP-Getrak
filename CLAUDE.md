# Getrak Core MCP — Contexto de Projeto para Claude Code

Este arquivo é lido automaticamente pelo Claude Code no início de cada sessão neste repositório. Ele contém as regras que **valem para toda tool do projeto**, para que a codificação seja consistente sem precisar repetir contexto a cada tarefa.

As specs individuais (uma por User Story) definem endpoint, contrato de entrada/saída e critérios de aceite de cada tool específica. Este arquivo não substitui as specs — complementa com o que é transversal.

**Fontes de verdade deste projeto (nesta ordem, em caso de conflito):**
1. Instrução explícita mais recente do usuário na sessão
2. PRD - Getrak Core MCP (v1.2, Aprovado)
3. Technical Brief - Getrak Core MCP (Aprovado — Odilon/Engenharia, Diego/Produto)
4. Specs individuais por User Story (pasta `Claude Code / Specs` no Notion)

Não invente endpoints, schemas, regras de negócio ou capacidades que não estejam em uma dessas fontes. Se algo não estiver definido, pare e sinalize — não assuma.

---

## 1. O que é este produto

O Getrak Core MCP é um produto interno da Getrak que expõe um catálogo curado de tools orientadas a tarefas sobre a Getrak API Core, via Model Context Protocol, para consumo por agentes de IA (o primeiro consumidor confirmado é o Claude Code).

A V1 é **predominantemente/preferencialmente 100% read-only**, cobrindo veículos, localização, equipamentos e ordens de serviço (Release 1), com telemetria e webhooks apenas em consulta na Release 2. Este não é um proxy genérico da API — cada tool é uma decisão deliberada de produto, com escopo, risco e valor avaliados individualmente.

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

Esses valores são resolvidos pela configuração da conexão MCP, nunca pelo agente chamador.

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

Cada adapter de API deve encapsular o comportamento real de paginação do endpoint correspondente (`page/per_page`, `limit/offset`, ausência de paginação) — **nunca assumir um único modelo genérico de paginação para todos os endpoints.**

---

## 5. Estratégia de cache (TD-04)

**Cache de tokens:** sim, compartilhado, em Amazon ElastiCache for Redis.
- Namespace: `mcp:{environment}:{central}:{auth_scheme}:{credential_id}`
- TTL: expiração do token menos 60 segundos de margem de segurança
- Tokens nunca aparecem em log, sob nenhuma circunstância

**Cache de dados operacionais:** **não existe na V1.** Não implementar cache genérico de respostas para dados de alta volatilidade (localização, velocidade, ignição, telemetria, status, ordens em andamento, tratamentos offline). Isso é intencional — o MCP é usado em contexto de investigação/diagnóstico, e dado desatualizado compromete a confiabilidade da ferramenta.

Todo cache (quando existir) deve ser isolado por `environment + central + resource`.

---

## 6. Autenticação (TD-02)

- A API Core usa dois esquemas OAuth2: `oauth2ClientCredentials` e `oauth2Password`. Algumas tools (ex.: ordens de serviço) aceitam ambos dependendo do escopo; a tool composta `get_vehicle_operational_context` (US-029) usa **os dois simultaneamente**.
- Credenciais técnicas são resolvidas por ambiente — nunca gerenciadas pelo agente consumidor.
- A identidade do usuário/agente consumidor deve ser preservada na camada MCP para autorização e auditoria, **mesmo quando a chamada à API Core usa uma credencial técnica compartilhada.** Identidade de autenticação (API Core) e identidade de autorização/auditoria (MCP) são conceitos distintos.

---

## 7. Versionamento de endpoint

- Sempre preferir a versão vigente (não depreciada) de um endpoint quando houver equivalente.
- O critério de vigência é **exclusivamente a flag `deprecated` no `openapi.json`** — nunca inferir depreciação a partir do número de versão. Vários endpoints v0.1 usados neste projeto (ex.: localização, relatório de ordem de serviço) são vigentes.
- Se uma spec individual referenciar um endpoint, esse endpoint já foi verificado contra o `openapi.json` — não re-verificar nem substituir por conta própria sem justificativa registrada.

---

## 8. Segurança, privacidade e auditoria

Dados considerados sensíveis neste projeto: localização, placa, chassi, CPF, CNPJ, telefone, e-mail, identificadores de cliente/subcliente/usuário/motorista/equipamento, telemetria, tokens, credenciais.

- Toda execução de tool gera um registro de auditoria estruturado: `request_id`, usuário/agente, ambiente, central, tool, endpoint(s), método, classificação de risco, resultado, status, duração, entidades afetadas.
- Nunca persistir integralmente em log: tokens, segredos, CPF, telefone, e-mail, payloads sensíveis completos.
- Mascaramento e minimização aplicados tanto na resposta normalizada quanto no log de auditoria.
- Correlação ponta a ponta sempre pelo `request_id`.

---

## 9. Fora de escopo da V1 — não implementar sem nova decisão de produto

- Qualquer operação de **escrita** (criação, atualização, exclusão, suspensão, reativação, envio/cancelamento de comando, finalização de ordem, criação/remoção de webhook).
- Operações de **alto risco** de qualquer natureza.
- **RabbitMQ** — fora da V1; se abordado no futuro, não modelar como tool síncrona convencional sem análise arquitetural específica.
- Cliente/subcliente, telemetria e ordens de serviço dentro da tool composta `get_vehicle_operational_context` (escopo dela é só cadastro + equipamento + localização).
- Qualquer tool não listada nas specs da pasta `Claude Code / Specs`.

---

## 10. Itens de Engineering Discovery ainda abertos (não bloqueantes, mas relevantes ao codificar)

- **ED-01** — Paginação real por endpoint ainda não mapeada exaustivamente; ao implementar cada adapter, documentar o comportamento real encontrado.
- **ED-02** — Autenticação combinada em `get_vehicle_operational_context` (US-029) ainda não validada em homologação. Implementar de forma defensiva: assumir que o comportamento de cache/renovação de token pode precisar de ajuste após os testes.

Esses itens não impedem a implementação, mas o código para essas áreas deve ser escrito para acomodar ajuste posterior — não travar em suposições como se fossem definitivas.

---

## 11. Onde encontrar o resto

- Specs de cada User Story (endpoint exato, contrato de entrada/saída, critérios de aceite): pasta **Claude Code / Specs** no Notion do projeto.
- Decisões técnicas completas com racional: **Technical Brief - Getrak Core MCP** no Notion.
- Requisitos de produto, personas, journeys, métricas: **PRD - Getrak Core MCP** no Notion.

Se uma spec individual e este arquivo parecerem conflitar, este arquivo (regras transversais aprovadas) prevalece sobre suposições implícitas em qualquer spec — mas nenhum dos dois prevalece sobre o PRD ou o Technical Brief em caso de conflito real. Nesse caso, pare e sinalize a inconsistência em vez de escolher um lado.
