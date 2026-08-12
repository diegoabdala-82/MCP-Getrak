# reference/openapi.json

Snapshot da especificação OpenAPI 3.1 da Getrak API Core ("Getrak Rest API"),
extraído da página Redoc oficial em `https://apidoc-core.getrak.com.br/` em
2026-08-12. Fonte técnica primária citada no Technical Brief e no documento
de Contexto do projeto — nunca usar `https://apidoc.getrak.com.br/` (API
pública) como substituto.

Este arquivo é um snapshot, não um espelho ao vivo: pode ficar desatualizado
em relação à especificação real. Antes de implementar/alterar uma tool,
reextrair a especificação atual se este snapshot tiver mais de
algumas semanas, ou se houver suspeita de mudança no endpoint em questão.

Extração: a página é renderizada via Redoc estático, que embute o spec como
`const __redoc_state = {...}` dentro de um `<script>` inline no HTML — não
há endpoint `/openapi.json` separado servido pelo domínio. O objeto salvo
aqui é `__redoc_state.spec.data`.
