# Inventário da Casa

App para controlar os itens da casa (quanto tem, quanto custa) e gerar a lista de compras
do que está em falta ou acabando. Feito para usar no celular, direto da tela de início.

HTML, CSS e JavaScript puros — sem etapa de build. A pasta do repositório é exatamente o
que o GitHub Pages publica. Os dados ficam num projeto **Supabase** para sincronizar entre
aparelhos (ver *Onde os dados ficam*).

## Código de barras e validade

Cada item pode guardar um **código de barras** e uma **data de validade**.

- No formulário do item, toque no ícone de código de barras para ler pela câmera. Serve
  também o botão de escanear na tela de inventário: se o código já existe, o app abre
  aquele item; se é novo, abre o cadastro já com o código preenchido.
- Ao ler um código novo, o app tenta descobrir o **nome** do produto na base aberta
  [Open Food Facts](https://world.openfoodfacts.org). Só o número do código sai do
  aparelho — preço, validade e o resto continuam locais. Sem internet ou produto
  desconhecido, é só digitar.
- O código de barras **não** carrega preço nem validade: isso ninguém coloca no código.
  Você preenche uma vez e o app lembra do item na próxima leitura.
- A validade vira um aviso: o item mostra *Vence em X dias* quando falta uma semana ou
  menos, e *Vencido* quando passa. A ordenação **Vence antes** joga esses para o topo.

A leitura usa o `BarcodeDetector` nativo (Chrome no Android) e cai no leitor ZXing
(`js/vendor/`) onde ele não existe — é o que faz a câmera funcionar no iPhone/Safari.

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

Na nuvem, num projeto **Supabase** (banco Postgres). Cada aparelho entra na **mesma conta
da casa** e vê o mesmo inventário — celular, tablet e computador ficam sincronizados. Ao
abrir o app (ou voltar para ele), ele recarrega o que o outro aparelho mudou.

Consequências:

- Precisa de **internet** para ver e editar (a escolha foi essa; não guarda offline).
- Os dados só aparecem para quem entra na conta. Quem protege isso são as regras de
  **RLS** no banco, então a chave publicável pode ficar no código, no repositório público.
- **Ajustes → Exportar backup** ainda guarda uma cópia `.json`; **Importar backup**
  substitui o inventário da conta pelo arquivo.

### Configuração do Supabase (uma vez)

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No **SQL Editor**, rode o script que cria as tabelas `itens` e `extras` com RLS
   (ver histórico do commit da integração).
3. Em **Authentication → Users**, crie o usuário da casa (e-mail + senha, com *Auto
   Confirm*). É essa conta que os aparelhos usam para entrar.
4. Em **Project Settings → API**, copie a **Project URL** e a chave **publishable** para
   `js/config.js`.

## Instalar no celular

1. Abra o endereço publicado no navegador do celular e **entre com a conta da casa**.
2. **iPhone (Safari):** botão de compartilhar → *Adicionar à Tela de Início*.
   **Android (Chrome):** menu ⋮ → *Instalar app* / *Adicionar à tela inicial*.
3. Abra pelo ícone. A sessão fica guardada, então você entra uma vez por aparelho.

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
| `css/estilo.css` | paleta pastel (clara/escura), layout de celular e o estilo de impressão |
| `js/config.js` | endereço do projeto Supabase e a chave publicável |
| `js/dados.js` | estado em memória espelhado no Supabase, e as regras de estoque |
| `js/auth.js` | login com a conta da casa e o controle de quem vê o app |
| `js/inventario.js` | busca, filtros, validade, ajuste de quantidade e formulário do item |
| `js/compras.js` | lista de compras, total, copiar/compartilhar, CSV e impressão |
| `js/scanner.js` | leitura de código de barras pela câmera (nativo + ZXing no iPhone) |
| `js/produtos.js` | busca do nome do produto pelo código no Open Food Facts |
| `js/exemplos.js` | itens comuns de casa do "Começar rápido" (preços são chutes iniciais) |
| `js/vendor/zxing.min.js` | leitor de código de barras para navegadores sem `BarcodeDetector` |
| `js/vendor/supabase.min.js` | cliente do Supabase (login e banco) |
| `js/app.js` | navegação, backup e registro do service worker |
| `sw.js` | cache do casco do app (as três telas) para carregar rápido |

## Primeiros passos sugeridos

1. **Ajustes → Carregar itens comuns** (31 itens de mercearia, limpeza e higiene).
2. Ande pela casa ajustando as quantidades com os botões `−` e `+`.
3. Corrija os preços para os da sua região e apague o que não usa.
4. Ajuste mínimo e ideal de cada item — é isso que decide quando ele entra na lista.
