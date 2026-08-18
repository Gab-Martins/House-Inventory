// Itens comuns de casa para não começar do zero.
// Quantidade vem "cheia" (igual ao ideal): você percorre a casa e vai baixando com o − .
// Os preços são chutes iniciais — ajuste para os da sua região.

const bruto = [
  ['Arroz', 'Mercearia', 'Despensa', 'pacote', 1, 2, 28.90],
  ['Feijão', 'Mercearia', 'Despensa', 'pacote', 1, 3, 9.50],
  ['Macarrão', 'Mercearia', 'Despensa', 'pacote', 1, 3, 5.50],
  ['Óleo de soja', 'Mercearia', 'Despensa', 'un', 1, 2, 8.90],
  ['Açúcar', 'Mercearia', 'Despensa', 'pacote', 1, 2, 5.20],
  ['Sal', 'Mercearia', 'Despensa', 'pacote', 1, 2, 3.20],
  ['Café', 'Mercearia', 'Despensa', 'pacote', 1, 2, 22.90],
  ['Farinha de trigo', 'Mercearia', 'Despensa', 'pacote', 1, 2, 6.50],
  ['Molho de tomate', 'Mercearia', 'Despensa', 'un', 2, 4, 4.20],
  ['Papel alumínio', 'Mercearia', 'Cozinha', 'rolo', 1, 2, 9.00],
  ['Leite', 'Geladeira', 'Cozinha', 'L', 2, 6, 5.60],
  ['Ovos', 'Geladeira', 'Cozinha', 'dúzia', 1, 2, 12.90],
  ['Manteiga', 'Geladeira', 'Cozinha', 'un', 1, 2, 12.50],
  ['Queijo', 'Geladeira', 'Cozinha', 'un', 1, 2, 18.00],
  ['Pão de forma', 'Padaria', 'Cozinha', 'un', 1, 2, 9.90],
  ['Detergente', 'Limpeza', 'Cozinha', 'un', 1, 3, 3.20],
  ['Esponja de louça', 'Limpeza', 'Cozinha', 'un', 1, 3, 3.50],
  ['Saco de lixo', 'Limpeza', 'Cozinha', 'pacote', 1, 2, 9.90],
  ['Papel toalha', 'Limpeza', 'Cozinha', 'rolo', 1, 2, 8.00],
  ['Sabão em pó', 'Limpeza', 'Lavanderia', 'pacote', 1, 2, 14.90],
  ['Amaciante', 'Limpeza', 'Lavanderia', 'un', 1, 2, 12.00],
  ['Água sanitária', 'Limpeza', 'Lavanderia', 'un', 1, 2, 5.50],
  ['Desinfetante', 'Limpeza', 'Lavanderia', 'un', 1, 2, 7.50],
  ['Papel higiênico', 'Higiene', 'Banheiro', 'pacote', 1, 2, 22.90],
  ['Sabonete', 'Higiene', 'Banheiro', 'un', 2, 6, 3.00],
  ['Shampoo', 'Higiene', 'Banheiro', 'un', 1, 2, 18.90],
  ['Condicionador', 'Higiene', 'Banheiro', 'un', 1, 2, 18.90],
  ['Creme dental', 'Higiene', 'Banheiro', 'un', 1, 2, 6.50],
  ['Desodorante', 'Higiene', 'Banheiro', 'un', 1, 2, 14.90],
  ['Pilha AA', 'Casa', 'Armário', 'cartela', 1, 2, 18.00],
  ['Lâmpada LED', 'Casa', 'Armário', 'un', 1, 2, 14.00]
];

export const itensExemplo = bruto.map(([nome, categoria, local, unidade, minima, alvo, preco]) => ({
  nome, categoria, local, unidade,
  quantidade: alvo,
  quantidadeMinima: minima,
  quantidadeAlvo: alvo,
  preco
}));
