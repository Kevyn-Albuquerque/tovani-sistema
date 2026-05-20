/* =========================================================
   01. IMPORTAÇÕES FIREBASE
========================================================= */

import { db, auth } from "../firebase/firebaseConfig.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";


/* =========================================================
   02. PROTEÇÃO DE LOGIN
========================================================= */

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "../Login/login.html";
    return;
  }

  carregarCadastros();
});


/* =========================================================
   03. ELEMENTOS DO DOM
========================================================= */

console.log("CADASTRO FIREBASE RODANDO");

const formCadastro = document.getElementById("formCadastro");
const listaClientes = document.getElementById("listaClientes");
const pesquisaClientes = document.getElementById("pesquisaClientes");
const paginacaoClientes = document.getElementById("paginacaoClientes");

const quantidadeCotas = document.getElementById("quantidadeCotas");
const listaCotasMassa = document.getElementById("listaCotasMassa");


/* =========================================================
   04. ESTADO DA TELA
========================================================= */

let cadastros = [];
let paginaAtual = 1;

const clientesPorPagina = 5;


/* =========================================================
   05. FORMATADORES
========================================================= */

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function formatarValorInput(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function obterNumeroMoeda(valor) {
  const valorNormalizado = String(valor || "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");

  return Number(valorNormalizado || 0);
}

function atualizarCampoMoeda(input) {
  const valorBruto = input.dataset.valorBruto || "";

  input.value = valorBruto
    ? formatarValorInput(Number(valorBruto))
    : "";
}

function aplicarMascaraMoeda(input) {
  if (!input) return;

  input.dataset.valorBruto = "";

  input.addEventListener("beforeinput", function(event) {
    const valorBruto = input.dataset.valorBruto || "";

    if (event.inputType === "insertText") {
      event.preventDefault();

      if (/^\d$/.test(event.data || "")) {
        input.dataset.valorBruto = `${valorBruto}${event.data}`;
        atualizarCampoMoeda(input);
      }

      return;
    }

    if (
      event.inputType === "deleteContentBackward" ||
      event.inputType === "deleteContentForward"
    ) {
      event.preventDefault();

      input.dataset.valorBruto = valorBruto.slice(0, -1);
      atualizarCampoMoeda(input);
    }
  });

  input.addEventListener("input", function() {
    if (!input.value) {
      input.dataset.valorBruto = "";
      return;
    }

    input.dataset.valorBruto = String(Math.trunc(obterNumeroMoeda(input.value)));
    atualizarCampoMoeda(input);
  });
}

function formatarData(data) {
  if (!data) return "-";

  return new Date(data + "T00:00:00").toLocaleDateString("pt-BR");
}


/* =========================================================
   06. CÁLCULO DE COMISSÃO — PLANO 180
========================================================= */

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


/* =========================================================
   07. CÁLCULO DE COMISSÃO — PLANO 222
========================================================= */

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


/* =========================================================
   08. CÁLCULO GERAL DE COMISSÃO
========================================================= */

function calcularComissao(plano, valorCredito) {
  if (plano === "180") {
    return calcularFluxo180(valorCredito);
  }

  return calcularFluxo222(valorCredito);
}


/* =========================================================
   09. CARREGAR CADASTROS DO FIREBASE
========================================================= */

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


/* =========================================================
   10. GERAR CAMPOS DE GRUPO E COTA
========================================================= */

function gerarCamposDeCotas() {
  if (!quantidadeCotas || !listaCotasMassa) return;

  const quantidade = Number(quantidadeCotas.value || 1);

  if (!quantidade || quantidade < 1) {
    listaCotasMassa.innerHTML = "";
    return;
  }

  let html = "";

  for (let i = 0; i < quantidade; i++) {
    html += `
      <div class="linha-cota-massa">

        <div class="form-group">
          <label>Grupo ${quantidade > 1 ? i + 1 : ""}</label>

          <input
            type="text"
            class="grupo-massa"
            placeholder="Ex: 45"
            required
          />
        </div>

        <div class="form-group">
          <label>Cota ${quantidade > 1 ? i + 1 : ""}</label>

          <input
            type="text"
            class="cota-massa"
            placeholder="Ex: 10293"
            required
          />
        </div>

      </div>
    `;
  }

  listaCotasMassa.innerHTML = html;
}

if (quantidadeCotas) {
  quantidadeCotas.addEventListener("input", gerarCamposDeCotas);
}


/* =========================================================
   11. CADASTRAR VENDA — UMA OU VÁRIAS COTAS
========================================================= */

formCadastro.addEventListener("submit", async function(event) {
  event.preventDefault();

  const cliente = document.getElementById("cliente").value.trim();
  const vendedor = document.getElementById("vendedor").value.trim();
  const plano = document.getElementById("plano").value;
  const valorCredito = obterNumeroMoeda(
    document.getElementById("valorCredito").value
  );
  const dataVenda = document.getElementById("dataVenda").value;

  const grupos = document.querySelectorAll(".grupo-massa");
  const cotas = document.querySelectorAll(".cota-massa");

  if (!cliente || !vendedor || !plano || !valorCredito || !dataVenda) {
    alert("Preencha todos os dados principais da venda.");
    return;
  }

  if (grupos.length === 0 || cotas.length === 0) {
    alert("Informe pelo menos um grupo e uma cota.");
    return;
  }

  try {
    for (let i = 0; i < cotas.length; i++) {
      const grupo = grupos[i].value.trim();
      const numeroCota = cotas[i].value.trim();

      if (!grupo || !numeroCota) {
        alert("Preencha todos os grupos e cotas.");
        return;
      }

      const fluxo = calcularComissao(plano, valorCredito);

      const novoCadastro = {
        id: Date.now() + i,

        cliente,
        vendedor,

        grupo,
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

        quantidadeCotas: cotas.length,
        cadastroEmMassa: cotas.length > 1,

        criadoEm: new Date().toISOString()
      };

      await addDoc(
        collection(db, "clientes"),
        novoCadastro
      );
    }

    formCadastro.reset();
    document.getElementById("valorCredito").dataset.valorBruto = "";

    if (listaCotasMassa) {
      listaCotasMassa.innerHTML = "";
    }

    paginaAtual = 1;

    await carregarCadastros();

    alert(
      cotas.length > 1
        ? `${cotas.length} cotas cadastradas com sucesso.`
        : "Venda cadastrada com sucesso."
    );

    gerarCamposDeCotas();

  } catch (erro) {
    console.error("Erro ao salvar venda:", erro);
    alert("Erro ao salvar venda.");
  }
});


/* =========================================================
   12. PESQUISA DE CLIENTES
========================================================= */

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
      String(cadastro.grupo || "").toLowerCase().includes(termo) ||
      String(cadastro.numeroCota || "").toLowerCase().includes(termo) ||
      String(cadastro.plano || "").toLowerCase().includes(termo) ||
      formatarMoeda(cadastro.valorCredito).toLowerCase().includes(termo) ||
      formatarData(cadastro.dataVenda).toLowerCase().includes(termo)
    );
  });
}


/* =========================================================
   13. PAGINAÇÃO
========================================================= */

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


/* =========================================================
   14. EXCLUIR CADASTRO
========================================================= */

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


/* =========================================================
   15. RENDERIZAR CLIENTES
========================================================= */

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
                <strong>Grupo:</strong>
                ${cadastro.grupo || "-"}
              </span>

              <span>
                <strong>Cota:</strong>
                ${cadastro.numeroCota || "-"}
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


/* =========================================================
   16. FUNÇÕES GLOBAIS PARA O HTML
========================================================= */

window.excluirCadastro = excluirCadastro;
window.mudarPaginaClientes = mudarPaginaClientes;
window.limparPesquisaClientes = limparPesquisaClientes;


/* =========================================================
   17. INICIALIZAÇÃO DA TELA
========================================================= */

gerarCamposDeCotas();
aplicarMascaraMoeda(document.getElementById("valorCredito"));
