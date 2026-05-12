import { db, auth } from "../firebase/firebaseConfig.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

onAuthStateChanged(auth, (user) => {

  if (!user) {
    window.location.href = "../login/login.html";
  }

});

import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

console.log("CADASTRO FIREBASE RODANDO");

const formCadastro = document.getElementById("formCadastro");
const listaClientes = document.getElementById("listaClientes");
const pesquisaClientes = document.getElementById("pesquisaClientes");
const paginacaoClientes = document.getElementById("paginacaoClientes");

let cadastros = [];

let paginaAtual = 1;
const clientesPorPagina = 5;

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function formatarData(data) {
  if (!data) return "-";

  return new Date(data + "T00:00:00").toLocaleDateString("pt-BR");
}

function calcularFluxo180(valorCredito) {
  const fluxo = [];
  const parcela04 = valorCredito * 0.004;

  for (let i = 1; i <= 9; i++) {
    fluxo.push({
      mes: i,
      percentual: "0.4%",
      valor: parcela04,
      descricao: `Parcela ${i} - 0.4%`
    });
  }

  fluxo.push({
    mes: 12,
    percentual: "1%",
    valor: valorCredito * 0.01,
    descricao: "12ª parcela - 1%"
  });

  fluxo.push({
    mes: 999,
    percentual: "1.4%",
    valor: valorCredito * 0.014,
    descricao: "Saldo pendente contemplação"
  });

  fluxo.push({
    mes: 999,
    percentual: "1.2%",
    valor: valorCredito * 0.012,
    descricao: "Referência de adiantamento - 3 parcelas"
  });

  return fluxo;
}

function calcularFluxo222(valorCredito) {
  const fluxo = [];
  const parcela025 = valorCredito * 0.0025;

  for (let i = 1; i <= 18; i++) {
    fluxo.push({
      mes: i,
      percentual: "0.25%",
      valor: parcela025,
      descricao: `Parcela ${i} - 0.25%`
    });
  }

  fluxo.push({
    mes: 999,
    percentual: "1.5%",
    valor: valorCredito * 0.015,
    descricao: "Saldo pendente contemplação"
  });

  fluxo.push({
    mes: 999,
    percentual: "0.75%",
    valor: valorCredito * 0.0075,
    descricao: "Referência de adiantamento - 3 parcelas"
  });

  return fluxo;
}

function calcularComissao(plano, valorCredito) {
  if (plano === "180") {
    return calcularFluxo180(valorCredito);
  }

  return calcularFluxo222(valorCredito);
}

async function carregarCadastros() {

  try {

    const querySnapshot = await getDocs(
      collection(db, "clientes")
    );

    cadastros = [];

    querySnapshot.forEach((docItem) => {

      cadastros.push({
        firebaseId: docItem.id,
        ...docItem.data()
      });

    });

    renderizarClientes();

  } catch (erro) {

    console.error("Erro ao carregar clientes:", erro);

  }

}

formCadastro.addEventListener("submit", async function(event) {

  event.preventDefault();

  const cliente = document.getElementById("cliente").value.trim();
  const vendedor = document.getElementById("vendedor").value.trim();
  const numeroCota = document.getElementById("numeroCota").value.trim();
  const plano = document.getElementById("plano").value;
  const valorCredito = Number(document.getElementById("valorCredito").value);
  const dataVenda = document.getElementById("dataVenda").value;

  const fluxo = calcularComissao(plano, valorCredito);

  const novoCadastro = {
    id: Date.now(),
    cliente,
    vendedor,
    numeroCota,
    plano,
    valorCredito,
    dataVenda,

    contemplado: false,
    dataContemplacao: null,
    contemplacaoPaga: false,
    dataPagamentoContemplacao: null,

    ativo: true,
    dataInativacao: null,

    calculo: {
      fluxo
    },

    criadoEm: new Date().toISOString()
  };

  try {

    await addDoc(
      collection(db, "clientes"),
      novoCadastro
    );

    formCadastro.reset();

    paginaAtual = 1;

    await carregarCadastros();

    alert("Venda cadastrada com sucesso.");

  } catch (erro) {

    console.error("Erro ao salvar:", erro);

    alert("Erro ao salvar venda.");

  }

});

if (pesquisaClientes) {

  pesquisaClientes.addEventListener("input", function() {

    paginaAtual = 1;

    renderizarClientes();

  });

}

function limparPesquisaClientes() {

  if (!pesquisaClientes) return;

  pesquisaClientes.value = "";

  paginaAtual = 1;

  renderizarClientes();

}

function mudarPaginaClientes(pagina) {

  paginaAtual = pagina;

  renderizarClientes();

  const secao = document.querySelector(".resultado");

  if (secao) {

    secao.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

  }

}

async function excluirCadastro(firebaseId) {

  const confirmar = confirm("Deseja excluir esta venda?");

  if (!confirmar) return;

  try {

    await deleteDoc(
      doc(db, "clientes", firebaseId)
    );

    await carregarCadastros();

  } catch (erro) {

    console.error("Erro ao excluir:", erro);

    alert("Erro ao excluir venda.");

  }

}

function filtrarCadastros() {

  const termo = pesquisaClientes
    ? pesquisaClientes.value.toLowerCase().trim()
    : "";

  if (!termo) {

    return cadastros;

  }

  return cadastros.filter(cadastro => {

    return (
      String(cadastro.cliente || "").toLowerCase().includes(termo) ||
      String(cadastro.vendedor || "").toLowerCase().includes(termo) ||
      String(cadastro.numeroCota || "").toLowerCase().includes(termo) ||
      String(cadastro.plano || "").toLowerCase().includes(termo) ||
      formatarMoeda(cadastro.valorCredito).toLowerCase().includes(termo) ||
      formatarData(cadastro.dataVenda).toLowerCase().includes(termo)
    );

  });

}

function renderizarPaginacao(totalItens) {

  if (!paginacaoClientes) return;

  const totalPaginas = Math.ceil(
    totalItens / clientesPorPagina
  );

  if (totalPaginas <= 1) {

    paginacaoClientes.innerHTML = "";

    return;

  }

  let botoes = `
    <button
      onclick="mudarPaginaClientes(${paginaAtual - 1})"
      ${paginaAtual === 1 ? "disabled" : ""}
    >
      Anterior
    </button>
  `;

  for (let i = 1; i <= totalPaginas; i++) {

    botoes += `
      <button
        class="${i === paginaAtual ? "ativo" : ""}"
        onclick="mudarPaginaClientes(${i})"
      >
        ${i}
      </button>
    `;

  }

  botoes += `
    <button
      onclick="mudarPaginaClientes(${paginaAtual + 1})"
      ${paginaAtual === totalPaginas ? "disabled" : ""}
    >
      Próxima
    </button>

    <div class="paginacao-info">
      Página ${paginaAtual} de ${totalPaginas}
      • ${totalItens} venda(s)
    </div>
  `;

  paginacaoClientes.innerHTML = botoes;

}

function renderizarClientes() {

  const cadastrosFiltrados = filtrarCadastros();

  if (cadastros.length === 0) {

    listaClientes.innerHTML = `
      <div class="card">
        Nenhuma venda cadastrada.
      </div>
    `;

    if (paginacaoClientes) {

      paginacaoClientes.innerHTML = "";

    }

    return;

  }

  if (cadastrosFiltrados.length === 0) {

    listaClientes.innerHTML = `
      <div class="card">
        Nenhum resultado encontrado.
      </div>
    `;

    if (paginacaoClientes) {

      paginacaoClientes.innerHTML = "";

    }

    return;

  }

  const ordenados = [...cadastrosFiltrados].sort((a, b) => {

    return Number(b.id || 0) - Number(a.id || 0);

  });

  const totalPaginas = Math.ceil(
    ordenados.length / clientesPorPagina
  );

  if (paginaAtual > totalPaginas) {

    paginaAtual = totalPaginas;

  }

  const inicio = (paginaAtual - 1) * clientesPorPagina;

  const fim = inicio + clientesPorPagina;

  const clientesPagina = ordenados.slice(inicio, fim);

  listaClientes.innerHTML = clientesPagina.map(cadastro => {

    return `
      <div class="card">

        <div class="card-topo">

          <div class="card-info">

            <div class="cliente-nome">
              ${cadastro.cliente}
            </div>

            <div class="linha-info">

              <span>
                <strong>Vendedor:</strong>
                ${cadastro.vendedor}
              </span>

              <span>
                <strong>Cota:</strong>
                ${cadastro.numeroCota}
              </span>

              <span>
                <strong>Plano:</strong>
                ${cadastro.plano} meses
              </span>

              <span>
                <strong>Crédito:</strong>
                ${formatarMoeda(cadastro.valorCredito)}
              </span>

              <span>
                <strong>Venda:</strong>
                ${formatarData(cadastro.dataVenda)}
              </span>

            </div>

          </div>

          <div class="card-acoes">

            <button
              class="btn-excluir"
              onclick="excluirCadastro('${cadastro.firebaseId}')"
            >
              Excluir
            </button>

          </div>

        </div>

      </div>
    `;

  }).join("");

  renderizarPaginacao(ordenados.length);

}

window.excluirCadastro = excluirCadastro;
window.mudarPaginaClientes = mudarPaginaClientes;
window.limparPesquisaClientes = limparPesquisaClientes;

carregarCadastros();


