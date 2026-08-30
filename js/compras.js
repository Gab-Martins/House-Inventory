// Tela de compras: lista derivada do estoque, marcação do que foi comprado e exportações.

import * as dados from './dados.js';
import { el, moeda, numero, aviso, baixarArquivo, copiarTexto } from './util.js';

const lista = document.getElementById('lista-compras');
const selo = document.getElementById('selo-compras');

const SEM_CATEGORIA = 'Sem categoria';
const AVULSOS = 'Avulsos';
const VENCENDO = 'Vencendo';

function estaVencendo(situacaoValidade) {
  return situacaoValidade === 'vence' || situacaoValidade === 'vencido';
}

// ── Montagem da lista ──────────────────────────────────────────

export function linhasDaLista() {
  const estado = dados.obter();

  // Entra na lista quem está no mínimo/em falta OU perto de vencer, mesmo com estoque
  // cheio — o item vencendo vira um lembrete de comprar um novo antes de estragar.
  const doEstoque = estado.itens
    .filter(item => dados.precisaRepor(item) || estaVencendo(dados.statusValidade(item)))
    .map(item => {
      const quantidade = dados.quantidadeAComprar(item);
      const validade = dados.statusValidade(item);
      return {
        id: item.id,
        nome: item.nome,
        categoria: estaVencendo(validade) ? VENCENDO : (item.categoria || SEM_CATEGORIA),
        quantidade,
        unidade: item.unidade,
        preco: item.preco,
        subtotal: item.preco == null ? null : dados.arredondar(item.preco * quantidade),
        onde: item.loja,
        situacao: dados.status(item),
        validade,
        diasValidade: dados.diasParaVencer(item),
        marcado: dados.estaMarcado(item.id),
        extra: false
      };
    });

  const avulsos = estado.extras.map(e => ({
    id: e.id,
    nome: e.nome,
    categoria: AVULSOS,
    quantidade: 1,
    unidade: 'un',
    preco: e.preco,
    subtotal: e.preco,
    onde: '',
    situacao: 'extra',
    validade: 'sem',
    diasValidade: null,
    marcado: e.marcado,
    extra: true
  }));

  // Vencendo primeiro (o lembrete), categorias no meio em ordem, avulsos por último.
  const peso = categoria => (categoria === VENCENDO ? 0 : categoria === AVULSOS ? 2 : 1);

  return [...doEstoque, ...avulsos].sort((a, b) =>
    peso(a.categoria) - peso(b.categoria) ||
    a.categoria.localeCompare(b.categoria, 'pt-BR') ||
    (a.categoria === VENCENDO ? (a.diasValidade ?? 1e9) - (b.diasValidade ?? 1e9) : 0) ||
    a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function totalEstimado(linhas) {
  const comPreco = linhas.filter(l => l.subtotal != null);
  return {
    total: comPreco.reduce((soma, l) => soma + l.subtotal, 0),
    semPreco: linhas.length - comPreco.length
  };
}

// ── Renderização ───────────────────────────────────────────────

function textoValidade(linha) {
  if (linha.validade === 'vencido') return 'vencido';
  const dias = linha.diasValidade;
  if (dias === 0) return 'vence hoje';
  if (dias === 1) return 'vence amanhã';
  return `vence em ${dias}d`;
}

function linhaDeCompra(linha) {
  const caixa = el('input', {
    type: 'checkbox',
    checked: linha.marcado,
    'aria-label': `Marcar ${linha.nome} como comprado`,
    ao: {
      change: evento => {
        dados.alternarMarcado(linha.id, evento.target.checked, { silencioso: true });
        evento.target.closest('.compra').classList.toggle('compra--marcada', evento.target.checked);
      }
    }
  });

  const detalhes = [`${numero(linha.quantidade)} ${linha.unidade}`];
  if (linha.situacao === 'falta') detalhes.push('em falta');
  if (linha.onde) detalhes.push(linha.onde);

  const meta = el('div', { classe: 'compra__meta', texto: detalhes.join(' · ') });
  if (estaVencendo(linha.validade)) {
    meta.appendChild(el('span', {
      classe: `selo-validade selo-validade--${linha.validade}`,
      texto: textoValidade(linha)
    }));
  }

  const meio = el('div', {}, [
    el('div', { classe: 'compra__nome', texto: linha.nome }),
    meta
  ]);

  const direita = linha.extra
    ? el('button', {
        classe: 'remover', type: 'button', texto: '✕', 'aria-label': `Remover ${linha.nome}`,
        ao: { click: () => dados.removerExtra(linha.id) }
      })
    : el('span', { classe: 'compra__preco', texto: linha.subtotal == null ? '—' : moeda(linha.subtotal) });

  const bloco = el('div', { classe: `compra${linha.marcado ? ' compra--marcada' : ''}` }, [caixa, meio, direita]);

  if (linha.extra && linha.subtotal != null) {
    meio.appendChild(el('div', { classe: 'compra__meta', texto: moeda(linha.subtotal) }));
  }

  return bloco;
}

export function renderizarCompras() {
  const linhas = linhasDaLista();
  const { total, semPreco } = totalEstimado(linhas);

  document.getElementById('total-compras').textContent = moeda(total);
  document.getElementById('nota-compras').textContent = linhas.length
    ? `${linhas.length} ${linhas.length === 1 ? 'item' : 'itens'}` +
      (semPreco ? ` · ${semPreco} sem preço cadastrado (fora da conta)` : '')
    : '';

  selo.hidden = linhas.length === 0;
  selo.textContent = String(linhas.length);

  if (!linhas.length) {
    lista.replaceChildren(el('p', { classe: 'vazio', texto: 'Nada faltando nem vencendo. Quando um item chegar no mínimo ou perto da validade, ele aparece aqui.' }));
    return;
  }

  const blocos = [];
  let categoriaAtual = null;
  linhas.forEach(linha => {
    if (linha.categoria !== categoriaAtual) {
      categoriaAtual = linha.categoria;
      const modificador = categoriaAtual === VENCENDO ? ' grupo__titulo--vencendo' : '';
      blocos.push(el('div', { classe: `grupo__titulo${modificador}`, texto: categoriaAtual }));
    }
    blocos.push(linhaDeCompra(linha));
  });

  lista.replaceChildren(...blocos);
}

// ── Exportações ────────────────────────────────────────────────

function dataDeHoje() {
  return new Date().toLocaleDateString('pt-BR');
}

export function listaEmTexto() {
  const linhas = linhasDaLista();
  if (!linhas.length) return '';

  const { total, semPreco } = totalEstimado(linhas);
  const partes = [`Lista de Compras — ${dataDeHoje()}`, ''];

  let categoriaAtual = null;
  linhas.forEach(linha => {
    if (linha.categoria !== categoriaAtual) {
      categoriaAtual = linha.categoria;
      partes.push(categoriaAtual.toUpperCase());
    }
    const preco = linha.subtotal == null ? '' : ` — ${moeda(linha.subtotal)}`;
    partes.push(`- ${linha.nome}: ${numero(linha.quantidade)} ${linha.unidade}${preco}`);
  });

  partes.push('', `Total estimado: ${moeda(total)}`);
  if (semPreco) partes.push(`(${semPreco} ${semPreco === 1 ? 'item' : 'itens'} sem preço cadastrado)`);
  return partes.join('\n');
}

function exportarCSV() {
  const linhas = linhasDaLista();
  if (!linhas.length) return aviso('A lista está vazia.');

  const campo = valor => `"${String(valor ?? '').replace(/"/g, '""')}"`;
  const decimal = n => (n == null ? '' : String(n.toFixed(2)).replace('.', ','));

  const csv = [['Item', 'Categoria', 'Quantidade', 'Unidade', 'Preço unitário', 'Subtotal', 'Onde comprar'].join(';')];
  linhas.forEach(l => {
    csv.push([campo(l.nome), campo(l.categoria), decimal(l.quantidade), campo(l.unidade),
      decimal(l.preco), decimal(l.subtotal), campo(l.onde)].join(';'));
  });

  const { total } = totalEstimado(linhas);
  csv.push(['', '', '', '', 'Total', decimal(total), ''].join(';'));

  // O BOM faz o Excel abrir os acentos corretamente.
  baixarArquivo(`lista-de-compras-${new Date().toISOString().slice(0, 10)}.csv`,
    '\uFEFF' + csv.join('\r\n'), 'text/csv;charset=utf-8');
  aviso('CSV exportado.');
}

async function compartilhar() {
  const texto = listaEmTexto();
  if (!texto) return aviso('A lista está vazia.');

  if (navigator.share) {
    try {
      await navigator.share({ title: 'Lista de Compras', text: texto });
      return;
    } catch (erro) {
      if (erro.name === 'AbortError') return;
    }
  }
  aviso(await copiarTexto(texto) ? 'Lista copiada.' : 'Não deu para copiar.');
}

function confirmarCompras() {
  const marcados = linhasDaLista().filter(l => l.marcado);
  if (!marcados.length) return aviso('Marque o que você comprou primeiro.');
  if (!confirm(`Repor o estoque de ${marcados.length} ${marcados.length === 1 ? 'item' : 'itens'}?`)) return;

  const { repostos, extrasComprados } = dados.confirmarCompras();
  const partes = [];
  if (repostos) partes.push(`${repostos} ${repostos === 1 ? 'item reposto' : 'itens repostos'}`);
  if (extrasComprados) partes.push(`${extrasComprados} ${extrasComprados === 1 ? 'avulso' : 'avulsos'} concluídos`);
  aviso(partes.join(' · ') + '.');
}

// ── Ligações ───────────────────────────────────────────────────

export function iniciarCompras() {
  document.getElementById('btn-copiar').addEventListener('click', compartilhar);
  document.getElementById('btn-csv').addEventListener('click', exportarCSV);
  document.getElementById('btn-imprimir').addEventListener('click', () => window.print());
  document.getElementById('btn-confirmar').addEventListener('click', confirmarCompras);

  document.getElementById('form-extra').addEventListener('submit', evento => {
    evento.preventDefault();
    const nome = document.getElementById('extra-nome');
    const preco = document.getElementById('extra-preco');
    if (!nome.value.trim()) return;
    dados.adicionarExtra(nome.value, preco.value);
    nome.value = '';
    preco.value = '';
    nome.focus();
  });
}
