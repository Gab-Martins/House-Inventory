// Camada de dados: estado em memória espelhado no Supabase.
// A tela continua lendo de obter() na hora; cada mudança atualiza a memória e,
// em seguida, vai para a nuvem — as duas telas compartilham o mesmo inventário.

import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true }
});

const VERSAO = 1;
const ouvintes = new Set();
let estado = documentoVazio();
let autenticado = false;

// ── Estado vazio e normalização ────────────────────────────────

function documentoVazio() {
  return { versao: VERSAO, itens: [], extras: [], marcados: [], atualizadoEm: null };
}

function numeroSeguro(valor, padrao = 0) {
  const n = Number(valor);
  return Number.isFinite(n) && n >= 0 ? n : padrao;
}

export function arredondar(n) {
  return Math.round(n * 100) / 100;
}

function normalizarData(valor) {
  const s = String(valor || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

export function gerarId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function normalizarItem(bruto) {
  return {
    id: String(bruto.id || gerarId()),
    nome: String(bruto.nome || '').trim(),
    categoria: String(bruto.categoria || '').trim(),
    local: String(bruto.local || '').trim(),
    quantidade: numeroSeguro(bruto.quantidade),
    unidade: String(bruto.unidade || 'un').trim(),
    quantidadeMinima: numeroSeguro(bruto.quantidadeMinima, 1),
    quantidadeAlvo: numeroSeguro(bruto.quantidadeAlvo, 1),
    preco: bruto.preco === '' || bruto.preco == null ? null : numeroSeguro(bruto.preco),
    loja: String(bruto.loja || '').trim(),
    codigoBarras: String(bruto.codigoBarras || '').trim(),
    validade: normalizarData(bruto.validade),
    observacoes: String(bruto.observacoes || '').trim(),
    marcado: Boolean(bruto.marcado),
    atualizadoEm: bruto.atualizadoEm || new Date().toISOString()
  };
}

function normalizarExtra(bruto) {
  return {
    id: String(bruto.id || gerarId()),
    nome: String(bruto.nome || '').trim(),
    preco: bruto.preco === '' || bruto.preco == null ? null : numeroSeguro(bruto.preco),
    marcado: Boolean(bruto.marcado)
  };
}

// ── Conversão entre o item da tela (camelCase) e a linha do banco (snake_case) ──

function daLinha(r) {
  return normalizarItem({
    id: r.id, nome: r.nome, categoria: r.categoria, local: r.local,
    quantidade: r.quantidade, unidade: r.unidade,
    quantidadeMinima: r.quantidade_minima, quantidadeAlvo: r.quantidade_alvo,
    preco: r.preco, loja: r.loja, codigoBarras: r.codigo_barras,
    validade: r.validade, observacoes: r.observacoes,
    marcado: r.marcado, atualizadoEm: r.atualizado_em
  });
}

function paraLinha(item) {
  return {
    id: item.id, nome: item.nome, categoria: item.categoria, local: item.local,
    quantidade: item.quantidade, unidade: item.unidade,
    quantidade_minima: item.quantidadeMinima, quantidade_alvo: item.quantidadeAlvo,
    preco: item.preco, loja: item.loja, codigo_barras: item.codigoBarras,
    validade: item.validade || null, observacoes: item.observacoes,
    marcado: item.marcado || false, atualizado_em: item.atualizadoEm
  };
}

function extraParaLinha(e) {
  return { id: e.id, nome: e.nome, preco: e.preco, marcado: e.marcado || false };
}

// ── Escuta e notificação ───────────────────────────────────────

function sincronizarMarcados() {
  estado.marcados = estado.itens.filter(i => i.marcado).map(i => i.id);
}

function notificar() {
  ouvintes.forEach(fn => fn(estado));
}

export function obter() {
  return estado;
}

export function assinar(fn) {
  ouvintes.add(fn);
  fn(estado);
}

export function temSessao() {
  return autenticado;
}

// Escreve na nuvem e avisa a tela se algo falhar (rede fora, por exemplo).
async function enviar(consulta) {
  const { error } = await consulta;
  if (error) {
    console.error('Erro ao salvar na nuvem:', error);
    window.dispatchEvent(new CustomEvent('inventario:erro', {
      detail: 'Sem conexão com a nuvem — a mudança pode não ter sido salva.'
    }));
  }
}

// ── Carregar / limpar o estado local ───────────────────────────

export async function carregar() {
  const [ri, re] = await Promise.all([
    sb.from('itens').select('*'),
    sb.from('extras').select('*')
  ]);
  if (ri.error) throw ri.error;
  if (re.error) throw re.error;

  estado.itens = ri.data.map(daLinha);
  estado.extras = re.data.map(normalizarExtra);
  sincronizarMarcados();
  estado.atualizadoEm = new Date().toISOString();
  autenticado = true;
  notificar();
}

// No logout: esquece o que está na memória, sem tocar na nuvem.
export function esquecer() {
  autenticado = false;
  estado = documentoVazio();
  notificar();
}

// ── Regras de estoque ──────────────────────────────────────────

export function status(item) {
  if (item.quantidade <= 0) return 'falta';
  if (item.quantidade <= item.quantidadeMinima) return 'baixo';
  return 'ok';
}

export function precisaRepor(item) {
  return status(item) !== 'ok';
}

// ── Validade ───────────────────────────────────────────────────

const JANELA_VENCIMENTO = 7; // dias: a partir daqui o item vira "vence em breve"

export function diasParaVencer(item) {
  if (!item.validade) return null;
  const [a, m, d] = item.validade.split('-').map(Number);
  const alvo = new Date(a, m - 1, d);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((alvo - hoje) / 86400000);
}

export function statusValidade(item) {
  const dias = diasParaVencer(item);
  if (dias == null) return 'sem';
  if (dias < 0) return 'vencido';
  if (dias <= JANELA_VENCIMENTO) return 'vence';
  return 'ok';
}

export function encontrarPorCodigo(codigo) {
  const c = String(codigo || '').trim();
  return c ? estado.itens.find(i => i.codigoBarras === c) : undefined;
}

// Quanto comprar para voltar ao nível ideal (nunca menos que 1).
export function quantidadeAComprar(item) {
  const alvo = item.quantidadeAlvo > 0 ? item.quantidadeAlvo : Math.max(item.quantidadeMinima, 1);
  const falta = arredondar(alvo - item.quantidade);
  return falta > 0 ? falta : 1;
}

// ── Itens ──────────────────────────────────────────────────────

export function salvarItem(dadosItem) {
  const existente = estado.itens.find(i => i.id === dadosItem.id);
  const item = normalizarItem({ ...dadosItem, marcado: existente ? existente.marcado : false });
  item.atualizadoEm = new Date().toISOString();
  const indice = estado.itens.findIndex(i => i.id === item.id);
  if (indice >= 0) estado.itens[indice] = item;
  else estado.itens.push(item);
  notificar();
  enviar(sb.from('itens').upsert(paraLinha(item)));
  return item;
}

export function removerItem(id) {
  estado.itens = estado.itens.filter(i => i.id !== id);
  sincronizarMarcados();
  notificar();
  enviar(sb.from('itens').delete().eq('id', id));
}

export function ajustarQuantidade(id, delta) {
  const item = estado.itens.find(i => i.id === id);
  if (!item) return;
  item.quantidade = Math.max(0, arredondar(item.quantidade + delta));
  item.atualizadoEm = new Date().toISOString();
  notificar();
  enviar(sb.from('itens').update({ quantidade: item.quantidade, atualizado_em: item.atualizadoEm }).eq('id', id));
}

// ── Itens avulsos da lista de compras ──────────────────────────

export function adicionarExtra(nome, preco) {
  const extra = normalizarExtra({ id: gerarId(), nome, preco, marcado: false });
  estado.extras.push(extra);
  notificar();
  enviar(sb.from('extras').insert(extraParaLinha(extra)));
}

export function removerExtra(id) {
  estado.extras = estado.extras.filter(e => e.id !== id);
  notificar();
  enviar(sb.from('extras').delete().eq('id', id));
}

// ── Marcações da compra ────────────────────────────────────────

export function estaMarcado(id) {
  const item = estado.itens.find(i => i.id === id);
  if (item) return item.marcado;
  const extra = estado.extras.find(e => e.id === id);
  return extra ? extra.marcado : false;
}

// silencioso: a tela de compras atualiza a própria linha em vez de redesenhar a
// lista inteira — redesenhar a cada toque descartaria as caixas debaixo do dedo.
export function alternarMarcado(id, marcado, { silencioso = false } = {}) {
  const extra = estado.extras.find(e => e.id === id);
  if (extra) {
    extra.marcado = marcado;
    enviar(sb.from('extras').update({ marcado }).eq('id', id));
  } else {
    const item = estado.itens.find(i => i.id === id);
    if (item) {
      item.marcado = marcado;
      enviar(sb.from('itens').update({ marcado }).eq('id', id));
    }
    sincronizarMarcados();
  }
  if (!silencioso) notificar();
}

// Repõe o estoque dos itens marcados e tira os avulsos já comprados da lista.
export function confirmarCompras() {
  const agora = new Date().toISOString();
  const marcados = estado.itens.filter(i => i.marcado);
  const linhas = [];

  marcados.forEach(item => {
    const alvo = item.quantidadeAlvo > 0 ? item.quantidadeAlvo : Math.max(item.quantidadeMinima, 1);
    const vencendo = statusValidade(item) === 'vence' || statusValidade(item) === 'vencido';

    if (precisaRepor(item)) {
      item.quantidade = arredondar(Math.max(alvo, item.quantidade + quantidadeAComprar(item)));
    } else if (vencendo) {
      // Estava só vencendo, com estoque cheio: comprei um novo no lugar do que ia
      // estragar — repõe até o ideal sem inflar além disso.
      item.quantidade = arredondar(Math.max(item.quantidade, alvo));
    }
    // A validade guardada é do pacote antigo; some com ela para sair do lembrete.
    if (vencendo) item.validade = '';
    item.marcado = false;
    item.atualizadoEm = agora;
    linhas.push(paraLinha(item));
  });

  const extrasComprados = estado.extras.filter(e => e.marcado);
  const idsExtras = extrasComprados.map(e => e.id);
  estado.extras = estado.extras.filter(e => !e.marcado);
  sincronizarMarcados();
  notificar();

  if (linhas.length) enviar(sb.from('itens').upsert(linhas));
  if (idsExtras.length) enviar(sb.from('extras').delete().in('id', idsExtras));

  return { repostos: marcados.length, extrasComprados: extrasComprados.length };
}

// ── Listas auxiliares ──────────────────────────────────────────

export function valoresUnicos(campo) {
  return [...new Set(estado.itens.map(i => i[campo]).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

// ── Backup e carga em lote ─────────────────────────────────────

function normalizarDocumento(bruto) {
  const doc = documentoVazio();
  if (!bruto || typeof bruto !== 'object') return doc;
  doc.itens = Array.isArray(bruto.itens) ? bruto.itens.map(normalizarItem).filter(i => i.nome) : [];
  doc.extras = Array.isArray(bruto.extras) ? bruto.extras.map(normalizarExtra).filter(e => e.nome) : [];
  const marcadosBackup = new Set(Array.isArray(bruto.marcados) ? bruto.marcados.map(String) : []);
  doc.itens.forEach(i => { if (marcadosBackup.has(i.id)) i.marcado = true; });
  doc.marcados = doc.itens.filter(i => i.marcado).map(i => i.id);
  doc.atualizadoEm = new Date().toISOString();
  return doc;
}

export function exportarTexto() {
  sincronizarMarcados();
  return JSON.stringify(estado, null, 2);
}

// Substitui todo o inventário da nuvem pelo conteúdo do backup.
export async function importarTexto(texto) {
  const doc = normalizarDocumento(JSON.parse(texto));
  if (!doc.itens.length) throw new Error('O arquivo não tem itens válidos.');

  estado = doc;
  notificar();

  await sb.from('itens').delete().neq('id', ' ');
  await sb.from('extras').delete().neq('id', ' ');
  if (doc.itens.length) await enviar(sb.from('itens').insert(doc.itens.map(paraLinha)));
  if (doc.extras.length) await enviar(sb.from('extras').insert(doc.extras.map(extraParaLinha)));
  return doc.itens.length;
}

export async function limparTudo() {
  estado = documentoVazio();
  notificar();
  await sb.from('itens').delete().neq('id', ' ');
  await sb.from('extras').delete().neq('id', ' ');
}

export function adicionarVarios(itens) {
  const existentes = new Set(estado.itens.map(i => i.nome.toLowerCase()));
  const novos = [];
  itens.forEach(bruto => {
    const chave = String(bruto.nome).toLowerCase();
    if (existentes.has(chave)) return;
    const item = normalizarItem({ ...bruto, id: gerarId() });
    estado.itens.push(item);
    novos.push(item);
    existentes.add(chave);
  });
  if (novos.length) {
    notificar();
    enviar(sb.from('itens').insert(novos.map(paraLinha)));
  }
  return novos.length;
}
