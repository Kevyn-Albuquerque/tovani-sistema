import { auth } from "../firebase/firebaseConfig.js";

import {
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const formLogin = document.getElementById("formLogin");
const mensagemErro = document.getElementById("mensagemErro");

// Se já estiver logado, entra direto no sistema
onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = "../Dashboard/dashboard.html";
  }
});

formLogin.addEventListener("submit", async function(event) {
  event.preventDefault();

  const usuario = document.getElementById("usuario").value.trim();
  const senha = document.getElementById("senha").value.trim();

  mensagemErro.textContent = "";
  mensagemErro.classList.remove("ativo");

  try {

    await signInWithEmailAndPassword(
      auth,
      usuario,
      senha
    );

    window.location.href = "../Dashboard/dashboard.html";

  } catch (erro) {

    console.error("Erro login:", erro);

    let mensagem = "Erro ao fazer login.";

    switch (erro.code) {

      case "auth/invalid-email":
        mensagem = "E-mail inválido.";
        break;

      case "auth/user-not-found":
        mensagem = "Usuário não encontrado.";
        break;

      case "auth/wrong-password":
        mensagem = "Senha incorreta.";
        break;

      case "auth/invalid-credential":
        mensagem = "Usuário ou senha inválidos.";
        break;

      case "auth/too-many-requests":
        mensagem = "Muitas tentativas. Tente novamente mais tarde.";
        break;
    }

    mensagemErro.textContent = mensagem;
    mensagemErro.classList.add("ativo");
  }
});