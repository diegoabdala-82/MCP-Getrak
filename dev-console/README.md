# Console de teste do Getrak Core MCP

Ferramenta de **desenvolvimento local**, não faz parte do produto MCP: não é uma tool, não é registrada no catálogo, não é exposta ao agente de IA. Serve só para inspecionar visualmente as tools registradas e chamá-las manualmente durante o desenvolvimento — o mesmo caminho de protocolo usado nos smoke tests manuais via stdio já feitos nesta sessão (`Client`/`StdioClientTransport` do `@modelcontextprotocol/sdk`, spawn real de `src/index.ts`), só que com uma interface web em vez de um script.

## Como rodar

1. Defina as mesmas variáveis de ambiente `GETRAK_MCP_*` que você já usa para rodar o servidor normalmente (`GETRAK_MCP_ENVIRONMENT`, `GETRAK_MCP_{ENV}_API_CORE_BASE_URL`, credenciais técnicas/delegadas conforme o domínio que quiser testar, `GETRAK_MCP_AUTHORIZED_CENTRALS_JSON`). O console nunca aceita credencial nem ambiente pela interface — só repassa o ambiente do processo para o servidor MCP real, exatamente como ele já funciona hoje.
2. Rode:
   ```
   node dev-console/server.mjs
   ```
3. Abra `http://localhost:4390` (porta configurável via `DEV_CONSOLE_PORT`).

## O que a tela faz

- Lista todas as tools descobertas via `tools/list` real (o mesmo catálogo que qualquer cliente MCP veria), **agrupadas por categoria** (domínio do catálogo interno — Vehicles, Locations, Accounts, Users, etc.). Cada categoria mostra o número de tools e um selo do **escopo/esquema de autenticação** real que suas tools usam (`Getrak Web`, `Integration` ou `Public`, conforme `CLAUDE.md` Seção 6 / `x-tagGroups` do openapi.json).
- Clicar em uma categoria mostra as tools daquela categoria; um link "← Todas as categorias" volta à lista de categorias.
- O campo de filtro busca por nome/descrição em **todas** as categorias de uma vez (não só na categoria atual), mostrando a categoria de cada resultado.
- Ao selecionar uma tool, monta um formulário a partir do JSON Schema real dela (campos obrigatórios marcados com `*`, enums viram `<select>`, arrays viram campo de texto separado por vírgulas).
- "Executar" chama a tool via `tools/call` real e mostra o envelope de resposta (sucesso ou erro) formatado.
- Mostra um selo do ambiente ativo no topo — fica vermelho se `production`, para não confundir com homologação sem perceber.

### Sobre o agrupamento por categoria/escopo

O protocolo MCP padrão (`tools/list`) só expõe `name`/`description`/`inputSchema` — não expõe o domínio do catálogo interno do servidor (`foundation/catalog/tool-catalog.ts`) nem o escopo OAuth de cada tool. Por isso o agrupamento usa uma tabela estática em `public/app.js` (`TOOL_DOMAIN`/`CATEGORY_META`), mantida manualmente em espelho ao campo `domain` de cada `catalogEntry` no código-fonte real. **Ao adicionar uma tool nova ao servidor, adicione a entrada correspondente nessa tabela** — uma tool ausente do mapa não é ocultada, aparece no grupo "Outras / não mapeadas" (falha visível, não silenciosa).

## O que a tela **não** faz (por design)

- Não guarda nem aceita credenciais — segue a mesma regra do resto do projeto (CLAUDE.md Seção 3: `environment`/credenciais nunca são parâmetro de entrada).
- Não implementa nenhuma lógica de negócio própria — é uma casca fina sobre o protocolo MCP real; qualquer comportamento visto aqui é o comportamento real do servidor.
- Não deve ser exposta publicamente nem rodada fora da máquina de desenvolvimento — não tem autenticação própria.
