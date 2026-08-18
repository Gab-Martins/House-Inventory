// Camada de persistência: tudo que lê ou escreve dados passa por aqui.
// Trocar localStorage por um backend depois significa mexer só neste arquivo.

const CHAVE = 'inventario-casa-v1';
const VERSAO = 1;

const ouvintes = new Set();
let estado = ler();
let temporizador = null;

// ── Leitura e normalização ─────────────────────────────────────

function documentoVazio() {
  return { versao: VERSAO, itens: [], extras: [], marcados: [], atualizadoEm: null };
}

function numero(valor, padrao = 0) {
  const n = Number(valor);
  return Number.isFinite(n) && n >= 0 ? n : padrao;
}

export function arredondar(n) {
  return Math.round(n * 100) / 100;
}

function normalizarItem(bruto) {
  return {
    id: String(bruto.id || gerarId()),
    nome: String(bruto.nome || '').trim(),
    categoria: String(bruto.categoria || '').trim(),
    local: String(bruto.local || '').trim(),
    quantidade: numero(bruto.quantidade),
    unidade: String(bruto.unidade || 'un').trim(),
    quantidadeMinima: numero(bruto.quantidadeMinima, 1),
    quantidadeAlvo: numero(bruto.quantidadeAlvo, 1),
    preco: bruto.preco === '' || bruto.preco == null ? null : numero(bruto.preco),
    loja: String(bruto.loja || '').trim(),
    observacoes: String(bruto.observacoes || '').trim(),
    atualizadoEm: bruto.atualizadoEm || new Date().toISOString()
  };
}

function normalizarDocumento(bruto) {
  const doc = documentoVazio();
  if (!bruto || typeof bruto !== 'object') return doc;
  doc.itens = Array.isArray(bruto.itens) ? bruto.itens.map(normalizarItem).filter(i => i.nome) : [];
  doc.extras = Array.isArray(bruto.extras)
    ? bruto.extras.map(e => ({
        id: String(e.id || gerarId()),
        nome: String(e.nome || '').trim(),
        preco: e.preco == null || e.preco === '' ? null : numero(e.preco),
        marcado: Boolean(e.marcado)
      })).filter(e => e.nome)
    : [];
  const ids = new Set(doc.itens.map(i => i.id));
  doc.marcados = Array.isArray(bruto.marcados) ? bruto.marcados.map(String).filter(id => ids.has(id)) : [];
  doc.atualizadoEm = bruto.atualizadoEm || null;
  return doc;
}

function ler() {
  try {
    const bruto = localStorage.getItem(CHAVE);
    return bruto ? normalizarDocumento(JSON.parse(bruto)) : documentoVazio();
  } catch (erro) {
    console.error('Não foi possível ler os dados salvos:', erro);
    return documentoVazio();
  }
}

export function gerarId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ── Escrita ────────────────────────────────────────────────────

export function gravar() {
  clearTimeout(temporizador);
  temporizador = null;
  try {
    localStorage.setItem(CHAVE, JSON.stringify(estado));
    return true;
  } catch (erro) {
    console.error('Não foi possível salvar:', erro);
    window.dispatchEvent(new CustomEvent('inventario:erro', {
      detail: 'Não deu para salvar. O armazenamento do navegador pode estar cheio ou bloqueado.'
    }));
    return false;
  }
}

function agendarGravacao() {
  estado.atualizadoEm = new Date().toISOString();
  clearTimeout(temporizador);
  temporizador = setTimeout(gravar, 400);
}

function alterou() {
  agendarGravacao();
  ouvintes.forEach(fn => fn(estado));
}

// Um fechamento repentino do app não pode levar junto a última alteração.
window.addEventListener('pagehide', () => { if (temporizador) gravar(); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && temporizador) gravar();
});

export function obter() {
  return estado;
}

export function assinar(fn) {
  ouvintes.add(fn);
  fn(estado);
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

// Quanto comprar para voltar ao nível ideal (nunca menos que 1).
export function quantidadeAComprar(item) {
  const alvo = item.quantidadeAlvo > 0 ? item.quantidadeAlvo : Math.max(item.quantidadeMinima, 1);
  const falta = arredondar(alvo - item.quantidade);
  return falta > 0 ? falta : 1;
}

// ── Itens ──────────────────────────────────────────────────────

export function salvarItem(dados) {
  const item = normalizarItem(dados);
  item.atualizadoEm = new Date().toISOString();
  const indice = estado.itens.findIndex(i => i.id === item.id);
  if (indice >= 0) estado.itens[indice] = item;
  else estado.itens.push(item);
  alterou();
  return item;
}

export function removerItem(id) {
  estado.itens = estado.itens.filter(i => i.id !== id);
  estado.marcados = estado.marcados.filter(m => m !== id);
  alterou();
}

export function ajustarQuantidade(id, delta) {
  const item = estado.itens.find(i => i.id === id);
  if (!item) return;
  item.quantidade = Math.max(0, arredondar(item.quantidade + delta));
  item.atualizadoEm = new Date().toISOString();
  alterou();
}

// ── Itens avulsos da lista de compras ──────────────────────────

export function adicionarExtra(nome, preco) {
  estado.extras.push({
    id: gerarId(),
    nome: String(nome).trim(),
    preco: preco === '' || preco == null ? null : numero(preco),
    marcado: false
  });
  alterou();
}

export function removerExtra(id) {
  estado.extras = estado.extras.filter(e => e.id !== id);
  alterou();
}

// ── Marcações da compra ────────────────────────────────────────

export function estaMarcado(id) {
  return estado.marcados.includes(id);
}

// silencioso: a tela de compras atualiza a própria linha em vez de redesenhar a
// lista inteira — redesenhar a cada toque descartaria as caixas debaixo do dedo.
export function alternarMarcado(id, marcado, { silencioso = false } = {}) {
  const extra = estado.extras.find(e => e.id === id);
  if (extra) {
    extra.marcado = marcado;
  } else if (marcado) {
    if (!estado.marcados.includes(id)) estado.marcados.push(id);
  } else {
    estado.marcados = estado.marcados.filter(m => m !== id);
  }
  if (silencioso) agendarGravacao();
  else alterou();
}

// Repõe o estoque dos itens marcados e tira os avulsos já comprados da lista.
export function confirmarCompras() {
  const agora = new Date().toISOString();
  let repostos = 0;

  estado.marcados.forEach(id => {
    const item = estado.itens.find(i => i.id === id);
    if (!item) return;
    const alvo = item.quantidadeAlvo > 0 ? item.quantidadeAlvo : Math.max(item.quantidadeMinima, 1);
    item.quantidade = arredondar(Math.max(alvo, item.quantidade + quantidadeAComprar(item)));
    item.atualizadoEm = agora;
    repostos++;
  });

  const extrasComprados = estado.extras.filter(e => e.marcado).length;
  estado.extras = estado.extras.filter(e => !e.marcado);
  estado.marcados = [];
  alterou();
  return { repostos, extrasComprados };
}

// ── Listas auxiliares ──────────────────────────────────────────

export function valoresUnicos(campo) {
  return [...new Set(estado.itens.map(i => i[campo]).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

// ── Backup ─────────────────────────────────────────────────────

export function exportarTexto() {
  return JSON.stringify(estado, null, 2);
}

export function importarTexto(texto) {
  const doc = normalizarDocumento(JSON.parse(texto));
  if (!doc.itens.length) throw new Error('O arquivo não tem itens válidos.');
  estado = doc;
  alterou();
  gravar();
  return doc.itens.length;
}

export function limparTudo() {
  estado = documentoVazio();
  alterou();
  gravar();
}

export function adicionarVarios(itens) {
  const existentes = new Set(estado.itens.map(i => i.nome.toLowerCase()));
  let novos = 0;
  itens.forEach(bruto => {
    if (existentes.has(String(bruto.nome).toLowerCase())) return;
    estado.itens.push(normalizarItem({ ...bruto, id: gerarId() }));
    novos++;
  });
  alterou();
  return novos;
}
