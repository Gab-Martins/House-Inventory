// Tela de compras: lista derivada do estoque, marcação do que foi comprado e exportações.

import * as dados from './dados.js';
import { el, moeda, numero, aviso, baixarArquivo, copiarTexto } from './util.js';

const lista = document.getElementById('lista-compras');
const selo = document.getElementById('selo-compras');

const SEM_CATEGORIA = 'Sem categoria';
const AVULSOS = 'Avulsos';

// ── Montagem da lista ──────────────────────────────────────────

export function linhasDaLista() {
  const estado = dados.obter();

  const doEstoque = estado.itens.filter(dados.precisaRepor).map(item => {
    const quantidade = dados.quantidadeAComprar(item);
    return {
      id: item.id,
      nome: item.nome,
      categoria: item.categoria || SEM_CATEGORIA,
      quantidade,
      unidade: item.unidade,
      preco: item.preco,
      subtotal: item.preco == null ? null : dados.arredondar(item.preco * quantidade),
      onde: item.loja,
      situacao: dados.status(item),
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
    marcado: e.marcado,
    extra: true
  }));

  return [...doEstoque, ...avulsos].sort((a, b) =>
    a.categoria.localeCompare(b.categoria, 'pt-BR') || a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function totalEstimado(linhas) {
  const comPreco = linhas.filter(l => l.subtotal != null);
  return {
    total: comPreco.reduce((soma, l) => soma + l.subtotal, 0),
    semPreco: linhas.length - comPreco.length
  };
}

// ── Renderização ───────────────────────────────────────────────

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

  const meio = el('div', {}, [
    el('div', { classe: 'compra__nome', texto: linha.nome }),
    el('div', { classe: 'compra__meta', texto: detalhes.join(' · ') })
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

  // O gato reage ao tamanho da lista: dorme com a despensa cheia, arregala os
  // olhos quando a compra fica grande.
  document.getElementById('gato').dataset.humor =
    linhas.length === 0 ? 'dormindo' : linhas.length > 5 ? 'alerta' : 'curioso';

  if (!linhas.length) {
    lista.replaceChildren(el('p', { classe: 'vazio', texto: 'Nada faltando — o gato voltou a dormir. Quando um item chegar no mínimo, ele aparece aqui.' }));
    return;
  }

  const blocos = [];
  let categoriaAtual = null;
  linhas.forEach(linha => {
    if (linha.categoria !== categoriaAtual) {
      categoriaAtual = linha.categoria;
      blocos.push(el('div', { classe: 'grupo__titulo', texto: categoriaAtual }));
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
