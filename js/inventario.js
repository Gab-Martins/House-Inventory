// Tela de inventário: busca, filtros, ajuste rápido de quantidade e formulário do item.

import * as dados from './dados.js';
import { el, moeda, numero, aviso, formatarData } from './util.js';
import { abrirScanner } from './scanner.js';
import { buscarProduto } from './produtos.js';

const filtros = { busca: '', categoria: '', local: '', ordem: 'nome', soRepor: false };

const lista = document.getElementById('lista-inventario');
const resumo = document.getElementById('resumo-inventario');
const modal = document.getElementById('modal-item');
const form = document.getElementById('form-item');

function semAcento(texto) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// ── Filtro e ordenação ─────────────────────────────────────────

function itensVisiveis() {
  const busca = semAcento(filtros.busca.trim());

  const filtrados = dados.obter().itens.filter(item => {
    if (filtros.categoria && item.categoria !== filtros.categoria) return false;
    if (filtros.local && item.local !== filtros.local) return false;
    if (filtros.soRepor && !dados.precisaRepor(item)) return false;
    if (!busca) return true;
    if (item.codigoBarras && item.codigoBarras.includes(busca)) return true;
    const alvo = semAcento([item.nome, item.categoria, item.local, item.observacoes].join(' '));
    return alvo.includes(busca);
  });

  const porNome = (a, b) => a.nome.localeCompare(b.nome, 'pt-BR');

  switch (filtros.ordem) {
    case 'estoque':
      return filtrados.sort((a, b) => {
        const folga = i => i.quantidade / Math.max(i.quantidadeMinima, 1);
        return folga(a) - folga(b) || porNome(a, b);
      });
    case 'validade':
      return filtrados.sort((a, b) => {
        const da = dados.diasParaVencer(a);
        const db = dados.diasParaVencer(b);
        if (da == null) return db == null ? porNome(a, b) : 1; // sem validade vai pro fim
        if (db == null) return -1;
        return da - db || porNome(a, b);
      });
    case 'valor':
      return filtrados.sort((a, b) => (b.preco || 0) * b.quantidade - (a.preco || 0) * a.quantidade || porNome(a, b));
    case 'recente':
      return filtrados.sort((a, b) => String(b.atualizadoEm).localeCompare(String(a.atualizadoEm)));
    default:
      return filtrados.sort(porNome);
  }
}

// ── Renderização ───────────────────────────────────────────────

function rotuloValidade(item) {
  const dias = dados.diasParaVencer(item);
  if (dias == null) return '';
  if (dias < 0) return 'Vencido';
  if (dias === 0) return 'Vence hoje';
  if (dias === 1) return 'Vence amanhã';
  return `Vence em ${dias}d`;
}

function linhaDoItem(item) {
  const estado = dados.status(item);

  const meta = el('div', { classe: 'item__meta' });
  if (item.categoria) meta.appendChild(el('span', { classe: 'etiqueta', texto: item.categoria }));
  if (item.local) meta.appendChild(el('span', { texto: item.local }));
  if (item.preco != null) meta.appendChild(el('span', { texto: `${moeda(item.preco)}/${item.unidade}` }));
  if (estado === 'falta') meta.appendChild(el('span', { classe: 'etiqueta etiqueta--falta', texto: 'Em falta' }));
  if (estado === 'baixo') meta.appendChild(el('span', { classe: 'etiqueta etiqueta--baixo', texto: 'Acabando' }));

  const validade = dados.statusValidade(item);
  if (validade === 'vencido' || validade === 'vence')
    meta.appendChild(el('span', { classe: `etiqueta etiqueta--${validade}`, texto: rotuloValidade(item) }));
  else if (item.validade)
    meta.appendChild(el('span', { texto: `val. ${formatarData(item.validade)}` }));

  const info = el('div', {
    classe: 'item__info',
    role: 'button',
    tabIndex: 0,
    ao: {
      click: () => abrirFormulario(item),
      keydown: evento => { if (evento.key === 'Enter' || evento.key === ' ') { evento.preventDefault(); abrirFormulario(item); } }
    }
  }, [el('div', { classe: 'item__nome', texto: item.nome }), meta]);

  const contador = el('div', { classe: 'contador' }, [
    el('button', {
      classe: 'contador__botao', type: 'button', 'aria-label': `Diminuir ${item.nome}`, texto: '−',
      ao: { click: () => dados.ajustarQuantidade(item.id, -1) }
    }),
    el('span', { classe: 'contador__valor', texto: `${numero(item.quantidade)} ${item.unidade}` }),
    el('button', {
      classe: 'contador__botao', type: 'button', 'aria-label': `Aumentar ${item.nome}`, texto: '+',
      ao: { click: () => dados.ajustarQuantidade(item.id, 1) }
    })
  ]);

  return el('div', { classe: `item item--${estado}` }, [info, contador]);
}

function renderizarResumo() {
  const itens = dados.obter().itens;
  const valor = itens.reduce((soma, i) => soma + (i.preco || 0) * i.quantidade, 0);
  const repor = itens.filter(dados.precisaRepor).length;
  const vencendo = itens.filter(i => ['vence', 'vencido'].includes(dados.statusValidade(i))).length;
  resumo.textContent = itens.length
    ? `${itens.length} ${itens.length === 1 ? 'item' : 'itens'} · valor em casa ${moeda(valor)} · ${repor} para repor` +
      (vencendo ? ` · ${vencendo} vencendo` : '')
    : '';
}

function preencherOpcoes(select, valores, rotuloTodos) {
  const escolhido = select.value;
  select.replaceChildren(el('option', { value: '', texto: rotuloTodos }));
  valores.forEach(v => select.appendChild(el('option', { value: v, texto: v })));
  select.value = valores.includes(escolhido) ? escolhido : '';
}

function preencherSugestoes(id, valores) {
  document.getElementById(id).replaceChildren(...valores.map(v => el('option', { value: v })));
}

export function renderizarInventario() {
  const categorias = dados.valoresUnicos('categoria');
  const locais = dados.valoresUnicos('local');

  preencherOpcoes(document.getElementById('filtro-categoria'), categorias, 'Todas as categorias');
  preencherOpcoes(document.getElementById('filtro-local'), locais, 'Todos os locais');
  preencherSugestoes('lista-categorias', categorias);
  preencherSugestoes('lista-locais', locais);

  filtros.categoria = document.getElementById('filtro-categoria').value;
  filtros.local = document.getElementById('filtro-local').value;

  const visiveis = itensVisiveis();

  if (!visiveis.length) {
    const vazio = dados.obter().itens.length
      ? 'Nenhum item com esses filtros.'
      : 'Nada cadastrado ainda. Toque no + para adicionar o primeiro item, ou carregue os itens comuns em Ajustes.';
    lista.replaceChildren(el('p', { classe: 'vazio', texto: vazio }));
  } else {
    lista.replaceChildren(...visiveis.map(linhaDoItem));
  }

  renderizarResumo();
}

// ── Formulário ─────────────────────────────────────────────────

export function abrirFormulario(item) {
  form.reset();
  document.getElementById('modal-titulo').textContent = item ? 'Editar item' : 'Novo item';
  document.getElementById('btn-excluir').hidden = !item;
  form.dataset.id = item ? item.id : '';

  if (item) {
    form.nome.value = item.nome;
    form.categoria.value = item.categoria;
    form.local.value = item.local;
    form.quantidade.value = item.quantidade;
    form.unidade.value = item.unidade;
    form.quantidadeMinima.value = item.quantidadeMinima;
    form.quantidadeAlvo.value = item.quantidadeAlvo;
    form.preco.value = item.preco == null ? '' : item.preco;
    form.loja.value = item.loja;
    form.codigoBarras.value = item.codigoBarras;
    form.validade.value = item.validade;
    form.observacoes.value = item.observacoes;
  } else {
    // Herda os filtros ativos: cadastrar vários itens do mesmo armário fica mais rápido.
    form.categoria.value = filtros.categoria;
    form.local.value = filtros.local;
  }

  modal.showModal();
  form.nome.focus();
}

function salvarFormulario(evento) {
  evento.preventDefault();
  const valores = Object.fromEntries(new FormData(form));
  const item = dados.salvarItem({ ...valores, id: form.dataset.id || undefined });
  modal.close();
  aviso(`${item.nome} salvo.`);
}

function excluirItem() {
  const id = form.dataset.id;
  if (!id) return;
  if (!confirm(`Excluir "${form.nome.value}" do inventário?`)) return;
  dados.removerItem(id);
  modal.close();
  aviso('Item excluído.');
}

// ── Escaneamento ───────────────────────────────────────────────

// Preenche o nome pela base de produtos, sem atropelar o que a pessoa já digitou
// e só se o formulário ainda estiver no mesmo código (a busca online demora).
async function preencherPorCodigo(codigo) {
  const produto = await buscarProduto(codigo);
  if (produto?.nome && form.codigoBarras.value === codigo && !form.nome.value.trim()) {
    form.nome.value = produto.nome;
    aviso('Nome preenchido pela base de produtos.');
  }
}

// Botão de escanear da tela: código conhecido abre o item; novo abre o cadastro.
async function escanearParaFormulario() {
  const codigo = await abrirScanner();
  if (!codigo) return;

  const existente = dados.encontrarPorCodigo(codigo);
  if (existente) {
    abrirFormulario(existente);
    aviso('Item encontrado pelo código.');
    return;
  }

  abrirFormulario(null);
  form.codigoBarras.value = codigo;
  aviso('Código novo — confira e salve.');
  preencherPorCodigo(codigo);
}

// Botão de escanear dentro do formulário: só preenche o campo do código.
async function escanearNoFormulario() {
  const codigo = await abrirScanner();
  if (!codigo) return;
  form.codigoBarras.value = codigo;
  if (!form.nome.value.trim()) preencherPorCodigo(codigo);
}

// ── Ligações ───────────────────────────────────────────────────

export function iniciarInventario() {
  const busca = document.getElementById('busca');
  busca.addEventListener('input', () => { filtros.busca = busca.value; renderizarInventario(); });

  ['filtro-categoria', 'filtro-local'].forEach(id => {
    document.getElementById(id).addEventListener('change', renderizarInventario);
  });

  document.getElementById('ordenacao').addEventListener('change', evento => {
    filtros.ordem = evento.target.value;
    renderizarInventario();
  });

  document.getElementById('filtro-repor').addEventListener('change', evento => {
    filtros.soRepor = evento.target.checked;
    renderizarInventario();
  });

  document.getElementById('btn-novo').addEventListener('click', () => abrirFormulario(null));
  document.getElementById('btn-scan').addEventListener('click', escanearParaFormulario);
  document.getElementById('btn-escanear-form').addEventListener('click', escanearNoFormulario);
  document.getElementById('btn-cancelar').addEventListener('click', () => modal.close());
  document.getElementById('btn-excluir').addEventListener('click', excluirItem);
  form.addEventListener('submit', salvarFormulario);
}
