// Helpers de apresentação usados pelas duas telas.

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function moeda(valor) {
  return formatadorMoeda.format(Number(valor) || 0);
}

export function numero(valor) {
  return Number(valor).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

// Reformata a string da data sem passar por Date — evita o susto de fuso.
export function formatarData(iso) {
  if (!iso) return '';
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

// Cria elementos sempre com textContent — nome de item nunca vira HTML.
export function el(tag, atributos = {}, filhos = []) {
  const node = document.createElement(tag);
  for (const [chave, valor] of Object.entries(atributos)) {
    if (valor === false || valor == null) continue;
    if (chave === 'texto') node.textContent = valor;
    else if (chave === 'classe') node.className = valor;
    else if (chave === 'ao') Object.entries(valor).forEach(([evt, fn]) => node.addEventListener(evt, fn));
    else if (chave in node && chave !== 'list') node[chave] = valor;
    else node.setAttribute(chave, valor);
  }
  (Array.isArray(filhos) ? filhos : [filhos]).forEach(f => f && node.appendChild(f));
  return node;
}

let temporizadorAviso = null;

export function aviso(mensagem) {
  const caixa = document.getElementById('aviso');
  caixa.textContent = mensagem;
  caixa.hidden = false;
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => { caixa.hidden = true; }, 2600);
}

export function baixarArquivo(nomeArquivo, conteudo, tipo) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const link = el('a', { href: url, download: nomeArquivo });
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    // Contextos sem permissão de área de transferência (iOS antigo, http simples).
    const area = el('textarea', { value: texto, style: 'position:fixed;opacity:0' });
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}
