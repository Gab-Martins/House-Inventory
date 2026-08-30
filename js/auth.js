// Login com a conta compartilhada da casa: as duas telas entram no mesmo e-mail
// e passam a ver o mesmo inventário. A sessão fica guardada, então cada aparelho
// entra uma vez só.

import * as dados from './dados.js';
import { aviso } from './util.js';

const login = document.getElementById('login');
const form = document.getElementById('form-login');
const erro = document.getElementById('login-erro');
const botao = document.getElementById('btn-entrar');
const rotuloConta = document.getElementById('conta-email');

function mostrarApp(logado) {
  login.hidden = logado;
  document.body.classList.toggle('logado', logado);
}

dados.sb.auth.onAuthStateChange(async (_evento, sessao) => {
  if (sessao) {
    if (rotuloConta) rotuloConta.textContent = sessao.user?.email || '';
    mostrarApp(true);
    try {
      await dados.carregar();
    } catch (falha) {
      console.error(falha);
      aviso('Não deu para carregar os dados da nuvem.');
    }
  } else {
    dados.esquecer();
    mostrarApp(false);
  }
});

form.addEventListener('submit', async evento => {
  evento.preventDefault();
  erro.hidden = true;
  botao.disabled = true;
  botao.textContent = 'Entrando…';

  const { error } = await dados.sb.auth.signInWithPassword({
    email: form.email.value.trim(),
    password: form.senha.value
  });

  botao.disabled = false;
  botao.textContent = 'Entrar';

  if (error) {
    erro.textContent = 'E-mail ou senha incorretos.';
    erro.hidden = false;
  } else {
    form.reset();
  }
});

export async function sair() {
  await dados.sb.auth.signOut();
  aviso('Você saiu da conta.');
}
