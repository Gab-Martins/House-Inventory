# Inventário da Casa

App para controlar os itens da casa (quanto tem, quanto custa) e gerar a lista de compras
do que está em falta ou acabando. Feito para usar no celular, direto da tela de início.

HTML, CSS e JavaScript puros — sem build, sem dependências, sem servidor. A pasta do
repositório é exatamente o que o GitHub Pages publica.

## Como funciona

Cada item tem uma quantidade atual, um **mínimo** e um **ideal**:

- quantidade chega a **zero** → aparece como *Em falta*
- quantidade fica **igual ou abaixo do mínimo** → aparece como *Acabando*
- a lista de compras pede a diferença até o **ideal**
- o total estimado é a soma de `preço × quantidade a comprar` (itens sem preço ficam de
  fora da conta, e o app avisa quantos são)

Ao marcar os itens comprados e tocar em **Confirmar itens comprados**, o estoque volta
ao nível ideal sozinho.

## Onde os dados ficam

No próprio aparelho, no `localStorage` do navegador. Consequências:

- **Não sincroniza** entre celular e computador — cada aparelho tem seu inventário.
- Limpar os dados do navegador apaga o inventário.
- No iPhone, o Safari descarta dados de sites **não instalados** depois de ~7 dias sem
  uso. Adicionar o app à tela de início resolve isso.

Por isso: use **Ajustes → Exportar backup** de vez em quando, e sempre antes de trocar de
aparelho. O arquivo `.json` volta inteiro em **Importar backup** (inclusive para copiar o
inventário do computador para o celular).

## Instalar no celular

1. Abra o endereço publicado no navegador do celular.
2. **iPhone (Safari):** botão de compartilhar → *Adicionar à Tela de Início*.
   **Android (Chrome):** menu ⋮ → *Instalar app* / *Adicionar à tela inicial*.
3. Abra pelo ícone. A partir daí funciona em tela cheia e **sem internet** — dá para usar
   dentro do mercado com o celular offline.

## Publicar no GitHub Pages

O repositório local já está criado e com o primeiro commit. Falta enviar para o GitHub:

```bash
git remote add origin https://github.com/SEU-USUARIO/house-inventory.git
```

```bash
git push -u origin main
```

Depois, no GitHub: **Settings → Pages → Source: Deploy from a branch → Branch: `main` /
(root) → Save**. Em um minuto o app fica no ar em
`https://SEU-USUARIO.github.io/house-inventory/`.

O repositório pode ser público sem problema: o código é público, mas **os dados do
inventário nunca saem do seu aparelho** — não existe servidor recebendo nada.

Ao publicar uma atualização, o app pega a versão nova na visita seguinte (o service
worker serve o cache na hora e atualiza por trás).

## Rodar na máquina

```bash
python -m http.server 8123
```

E abra `http://localhost:8123`. Precisa ser por `http://` — abrir o `index.html` como
arquivo (`file://`) desliga o service worker e os módulos JavaScript.

## Estrutura

| Arquivo | O que faz |
| --- | --- |
| `index.html` | as três telas: Inventário, Compras e Ajustes |
| `css/estilo.css` | tema (claro/escuro), layout de celular e o estilo de impressão |
| `js/dados.js` | persistência e regras de estoque — trocar por um backend mexe só aqui |
| `js/inventario.js` | busca, filtros, ajuste de quantidade e formulário do item |
| `js/compras.js` | lista de compras, total, copiar/compartilhar, CSV e impressão |
| `js/exemplos.js` | itens comuns de casa do "Começar rápido" (preços são chutes iniciais) |
| `js/app.js` | navegação, backup e registro do service worker |
| `sw.js` | cache do app para funcionar offline |

## Primeiros passos sugeridos

1. **Ajustes → Carregar itens comuns** (31 itens de mercearia, limpeza e higiene).
2. Ande pela casa ajustando as quantidades com os botões `−` e `+`.
3. Corrija os preços para os da sua região e apague o que não usa.
4. Ajuste mínimo e ideal de cada item — é isso que decide quando ele entra na lista.
