// Busca o nome de um produto pelo código de barras na base aberta Open Food Facts.
// Só o número do código sai do aparelho; preço, validade e o resto ficam locais.
// Sem chave, sem login. Offline ou produto desconhecido: devolve null e segue no manual.

const BASE = 'https://world.openfoodfacts.org/api/v2/product';
const CAMPOS = 'product_name,product_name_pt,brands,quantity';

export async function buscarProduto(codigo) {
  const c = String(codigo || '').trim();
  if (!c || !navigator.onLine) return null;

  try {
    const resposta = await fetch(`${BASE}/${encodeURIComponent(c)}.json?fields=${CAMPOS}`, {
      headers: { Accept: 'application/json' }
    });
    if (!resposta.ok) return null;

    const dados = await resposta.json();
    if (dados.status !== 1 || !dados.product) return null;

    const p = dados.product;
    const nome = (p.product_name_pt || p.product_name || '').trim();
    const marca = (p.brands || '').split(',')[0].trim();

    return {
      nome: nome || marca || '',
      quantidade: (p.quantity || '').trim()
    };
  } catch {
    return null; // rede fora, CORS bloqueado, JSON estranho — cai no cadastro manual
  }
}
