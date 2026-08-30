// Leitor de código de barras pela câmera.
// Usa o BarcodeDetector nativo (Chrome no Android) quando existe; senão carrega
// o ZXing vendido em js/vendor/ — é o que faz a leitura funcionar no iPhone/Safari.
// abrirScanner() resolve com o código lido, ou null se a pessoa fechou.

const FORMATOS_NATIVOS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'];

// ── Carregamento sob demanda do ZXing ──────────────────────────
let zxingPromessa = null;

function carregarZXing() {
  if (window.ZXing) return Promise.resolve(window.ZXing);
  if (!zxingPromessa) {
    zxingPromessa = new Promise((resolver, rejeitar) => {
      const script = document.createElement('script');
      script.src = 'js/vendor/zxing.min.js';
      script.onload = () => window.ZXing ? resolver(window.ZXing) : rejeitar(new Error('ZXing não carregou.'));
      script.onerror = () => rejeitar(new Error('Não foi possível carregar o leitor de código.'));
      document.head.appendChild(script);
    });
  }
  return zxingPromessa;
}

// ── Duas estratégias de leitura ────────────────────────────────
// Cada uma liga a câmera, chama aoCodigo(texto) no primeiro código e devolve
// uma função que encerra tudo (para a câmera, solta o stream).

async function lerComDetector(video, aoCodigo) {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
  video.srcObject = stream;
  await video.play();

  const detector = new BarcodeDetector({ formats: FORMATOS_NATIVOS });
  let ativo = true;

  (async function laco() {
    if (!ativo) return;
    try {
      const achados = await detector.detect(video);
      if (achados.length && achados[0].rawValue) { aoCodigo(achados[0].rawValue); return; }
    } catch { /* quadro ainda sem imagem — tenta de novo */ }
    if (ativo) setTimeout(laco, 200);
  })();

  return () => {
    ativo = false;
    stream.getTracks().forEach(t => t.stop());
    video.srcObject = null;
  };
}

async function lerComZXing(video, aoCodigo) {
  const ZX = await carregarZXing();

  const dicas = new Map();
  dicas.set(ZX.DecodeHintType.POSSIBLE_FORMATS, [
    ZX.BarcodeFormat.EAN_13, ZX.BarcodeFormat.EAN_8,
    ZX.BarcodeFormat.UPC_A, ZX.BarcodeFormat.UPC_E, ZX.BarcodeFormat.CODE_128
  ]);

  const leitor = new ZX.BrowserMultiFormatReader(dicas, 300);
  let parado = false;

  leitor.decodeFromConstraints({ video: { facingMode: 'environment' }, audio: false }, video, resultado => {
    if (resultado && !parado) aoCodigo(resultado.getText());
  }).catch(erro => { if (!parado) console.error(erro); });

  return () => { parado = true; try { leitor.reset(); } catch { /* já parou */ } };
}

async function iniciarLeitura(video, aoCodigo, aoStatus) {
  if ('BarcodeDetector' in window) {
    try {
      const suportados = await BarcodeDetector.getSupportedFormats();
      if (suportados.some(f => FORMATOS_NATIVOS.includes(f))) return lerComDetector(video, aoCodigo);
    } catch { /* cai no ZXing */ }
  }
  aoStatus('Carregando o leitor…');
  return lerComZXing(video, aoCodigo);
}

function mensagemErro(erro) {
  if (erro && (erro.name === 'NotAllowedError' || erro.name === 'SecurityError'))
    return 'Permissão de câmera negada. Libere nas configurações e tente de novo.';
  if (erro && (erro.name === 'NotFoundError' || erro.name === 'OverconstrainedError'))
    return 'Nenhuma câmera encontrada neste aparelho.';
  return 'A câmera não abriu. Dá para digitar o código à mão.';
}

// ── Fluxo do modal ─────────────────────────────────────────────

export function abrirScanner() {
  const modal = document.getElementById('modal-scanner');
  const video = document.getElementById('scanner-video');
  const dica = document.getElementById('scanner-dica');
  const btnFechar = document.getElementById('btn-fechar-scanner');

  return new Promise(resolver => {
    let encerrado = false;
    let parar = () => {};

    function fechar(codigo) {
      if (encerrado) return;
      encerrado = true;
      parar();
      btnFechar.removeEventListener('click', aoFechar);
      modal.removeEventListener('cancel', aoCancelar);
      if (modal.open) modal.close();
      resolver(codigo || null);
    }

    const aoFechar = () => fechar(null);
    const aoCancelar = evento => { evento.preventDefault(); fechar(null); };

    btnFechar.addEventListener('click', aoFechar);
    modal.addEventListener('cancel', aoCancelar);
    modal.showModal();
    dica.textContent = 'Iniciando a câmera…';

    iniciarLeitura(video, codigo => {
      navigator.vibrate?.(80);
      fechar(codigo);
    }, texto => { if (!encerrado) dica.textContent = texto; })
      .then(fn => {
        if (encerrado) fn(); // fechou antes da câmera abrir: solta o stream que acabou de subir
        else { parar = fn; dica.textContent = 'Aponte para o código de barras'; }
      })
      .catch(erro => { console.error(erro); if (!encerrado) dica.textContent = mensagemErro(erro); });
  });
}
