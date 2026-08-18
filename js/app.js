// Ponto de entrada: navegação entre telas, ajustes e registro do service worker.

import * as dados from './dados.js';
import { aviso, baixarArquivo } from './util.js';
import { iniciarInventario, renderizarInventario } from './inventario.js';
import { iniciarCompras, renderizarCompras } from './compras.js';
import { itensExemplo } from './exemplos.js';

// ── Navegação ──────────────────────────────────────────────────

function mostrarTela(nome) {
  document.querySelectorAll('.aba').forEach(aba => {
    const ativa = aba.dataset.tela === nome;
    aba.classList.toggle('aba--ativa', ativa);
    aba.setAttribute('aria-selected', String(ativa));
  });
  document.querySelectorAll('.tela').forEach(tela => {
    tela.classList.toggle('tela--ativa', tela.id === `tela-${nome}`);
  });
  document.getElementById('btn-novo').hidden = nome !== 'inventario';
  window.scrollTo(0, 0);
}

// ── Ajustes ────────────────────────────────────────────────────

function exportarBackup() {
  const carimbo = new Date().toISOString().slice(0, 10);
  baixarArquivo(`inventario-casa-${carimbo}.json`, dados.exportarTexto(), 'application/json');
  aviso('Backup exportado.');
}

function importarBackup(arquivo) {
  const leitor = new FileReader();
  leitor.onload = () => {
    try {
      const quantos = dados.obter().itens.length;
      if (quantos && !confirm(`Isto substitui os ${quantos} itens deste aparelho pelo conteúdo do backup. Continuar?`)) return;
      aviso(`${dados.importarTexto(leitor.result)} itens importados.`);
    } catch (erro) {
      console.error(erro);
      aviso('Arquivo inválido. Use um backup exportado pelo app.');
    }
  };
  leitor.readAsText(arquivo);
}

function atualizarInfoBackup() {
  const estado = dados.obter();
  const info = document.getElementById('info-backup');
  info.textContent = estado.atualizadoEm
    ? `Última alteração: ${new Date(estado.atualizadoEm).toLocaleString('pt-BR')} · ${estado.itens.length} itens`
    : 'Nenhum item cadastrado ainda.';
}

function ligarAjustes() {
  document.getElementById('btn-exportar').addEventListener('click', exportarBackup);

  const arquivo = document.getElementById('arquivo-importar');
  document.getElementById('btn-importar').addEventListener('click', () => arquivo.click());
  arquivo.addEventListener('change', () => {
    if (arquivo.files[0]) importarBackup(arquivo.files[0]);
    arquivo.value = '';
  });

  document.getElementById('btn-exemplos').addEventListener('click', () => {
    const novos = dados.adicionarVarios(itensExemplo);
    aviso(novos ? `${novos} itens adicionados.` : 'Esses itens já estão no inventário.');
  });

  document.getElementById('btn-limpar').addEventListener('click', () => {
    if (!confirm('Apagar todos os itens deste aparelho?')) return;
    if (!confirm('Tem certeza? Isso não pode ser desfeito. Exporte um backup antes se tiver dúvida.')) return;
    dados.limparTudo();
    aviso('Inventário apagado.');
  });
}

// ── Início ─────────────────────────────────────────────────────

document.querySelectorAll('.aba').forEach(aba => {
  aba.addEventListener('click', () => mostrarTela(aba.dataset.tela));
});

window.addEventListener('inventario:erro', evento => aviso(evento.detail));

iniciarInventario();
iniciarCompras();
ligarAjustes();

dados.assinar(() => {
  renderizarInventario();
  renderizarCompras();
  atualizarInfoBackup();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(erro => console.warn('Service worker não registrado:', erro));
  });
}
