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
  getDocs,
  updateDoc,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const listaClientes = document.getElementById("listaClientes");
const pesquisaClientes = document.getElementById("pesquisaClientes");
const paginacaoClientes = document.getElementById("paginacaoClientes");

const totalClientes = document.getElementById("totalClientes");
const totalCotas = document.getElementById("totalCotas");
const totalAtivas = document.getElementById("totalAtivas");
const totalInativas = document.getElementById("totalInativas");
const totalFinalizadas = document.getElementById("totalFinalizadas");
const valorTotalVendido = document.getElementById("valorTotalVendido");
const valorAtivoCarteira = document.getElementById("valorAtivoCarteira");
const totalContempladas = document.getElementById("totalContempladas");
const totalFaltamContemplar = document.getElementById("totalFaltamContemplar");
const totalContemplacoesPendentes = document.getElementById("totalContemplacoesPendentes");

let cadastros = [];
let paginaAtual = 1;

const clientesPorPagina = 5;

async function carregarClientesFirebase() {
  try {
    const snapshot = await getDocs(collection(db, "clientes"));

    cadastros = [];

    snapshot.forEach(docItem => {
      cadastros.push({
        firebaseId: docItem.id,
        ...docItem.data()
      });
    });

    await normalizarCadastrosAntigos();
    renderizarClientes();

  } catch (erro) {
    console.error("Erro ao carregar clientes:", erro);

    if (listaClientes) {
      listaClientes.innerHTML = `
        <div class="card">
          Erro ao carregar clientes do Firebase.
        </div>
      `;
    }
  }
}

async function atualizarClienteFirebase(firebaseId, dados) {
  await updateDoc(doc(db, "clientes", firebaseId), dados);
}

async function excluirClienteFirebase(firebaseId) {
  await deleteDoc(doc(db, "clientes", firebaseId));
}

async function normalizarCadastrosAntigos() {
  const atualizacoes = [];

  cadastros.forEach(cadastro => {
    const dadosAtualizar = {};

    if (cadastro.contemplacaoPaga === undefined) {
      cadastro.contemplacaoPaga = false;
      dadosAtualizar.contemplacaoPaga = false;
    }

    if (cadastro.dataPagamentoContemplacao === undefined) {
      cadastro.dataPagamentoContemplacao = null;
      dadosAtualizar.dataPagamentoContemplacao = null;
    }

    if (cadastro.ativo === undefined) {
      cadastro.ativo = true;
      dadosAtualizar.ativo = true;
    }

    if (cadastro.dataInativacao === undefined) {
      cadastro.dataInativacao = null;
      dadosAtualizar.dataInativacao = null;
    }

    if (Object.keys(dadosAtualizar).length > 0 && cadastro.firebaseId) {
      atualizacoes.push(
        atualizarClienteFirebase(cadastro.firebaseId, dadosAtualizar)
      );
    }
  });

  if (atualizacoes.length > 0) {
    await Promise.all(atualizacoes);
  }
}

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

function dataHojeInput() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

function cotaFinalizada(cadastro) {
  if (cadastro.ativo === false) return false;

  const fluxo = cadastro.calculo?.fluxo || [];

  const parcelasNormais = fluxo.filter(item => item.mes !== 999);

  if (parcelasNormais.length === 0) return false;

  const ultimoMes = Math.max(
    ...parcelasNormais.map(item => Number(item.mes))
  );

  const dataVenda = new Date(cadastro.dataVenda + "T00:00:00");

  const dataFinal = new Date(dataVenda);
  dataFinal.setMonth(dataFinal.getMonth() + ultimoMes - 1);

  const hoje = new Date();

  const fluxoParcelasFinalizado = hoje > dataFinal;

  const saldoContemplacaoResolvido =
    !cadastro.contemplado || cadastro.contemplacaoPaga;

  return fluxoParcelasFinalizado && saldoContemplacaoResolvido;
}

function calcularResumoClientes() {
  const nomesClientes = new Set();

  let cotasAtivas = 0;
  let cotasInativas = 0;
  let cotasFinalizadas = 0;
  let valorTotal = 0;
  let valorAtivo = 0;
  let contempladas = 0;
  let faltamContemplar = 0;
  let pendentesPagamento = 0;

  cadastros.forEach(cadastro => {
    if (cadastro.cliente) {
      nomesClientes.add(cadastro.cliente.trim().toLowerCase());
    }

    const valorCredito = Number(cadastro.valorCredito) || 0;

    valorTotal += valorCredito;

    const finalizada = cotaFinalizada(cadastro);

    if (cadastro.ativo === false) {
      cotasInativas++;
    } else if (finalizada) {
      cotasFinalizadas++;
    } else {
      cotasAtivas++;
      valorAtivo += valorCredito;
    }

    if (cadastro.contemplado) {
      contempladas++;

      if (!cadastro.contemplacaoPaga) {
        pendentesPagamento++;
      }
    } else if (cadastro.ativo !== false && !finalizada) {
      faltamContemplar++;
    }
  });

  if (totalClientes) totalClientes.textContent = nomesClientes.size;
  if (totalCotas) totalCotas.textContent = cadastros.length;
  if (totalAtivas) totalAtivas.textContent = cotasAtivas;
  if (totalInativas) totalInativas.textContent = cotasInativas;
  if (totalFinalizadas) totalFinalizadas.textContent = cotasFinalizadas;
  if (valorTotalVendido) valorTotalVendido.textContent = formatarMoeda(valorTotal);
  if (valorAtivoCarteira) valorAtivoCarteira.textContent = formatarMoeda(valorAtivo);
  if (totalContempladas) totalContempladas.textContent = contempladas;
  if (totalFaltamContemplar) totalFaltamContemplar.textContent = faltamContemplar;
  if (totalContemplacoesPendentes) totalContemplacoesPendentes.textContent = pendentesPagamento;
}

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
  const confirmar = confirm("Deseja excluir esta cota?");

  if (!confirmar) return;

  try {
    await excluirClienteFirebase(firebaseId);
    await carregarClientesFirebase();
  } catch (erro) {
    console.error("Erro ao excluir cliente:", erro);
    alert("Erro ao excluir cliente.");
  }
}

function abrirCampoContemplacao(firebaseId) {
  const area = document.getElementById(`area-contemplacao-${firebaseId}`);

  if (!area) return;

  area.classList.toggle("ativa");

  const input = document.getElementById(`data-contemplacao-${firebaseId}`);

  if (input && !input.value) {
    input.value = dataHojeInput();
  }
}

function confirmarContemplacao(firebaseId) {
  const input = document.getElementById(`data-contemplacao-${firebaseId}`);

  if (!input || !input.value) {
    alert("Informe a data da contemplação.");
    return;
  }

  marcarContemplado(firebaseId, input.value);
}

async function marcarContemplado(firebaseId, dataContemplacao) {
  try {
    const cadastro = cadastros.find(item => item.firebaseId === firebaseId);

    if (!cadastro) return;

    await atualizarClienteFirebase(firebaseId, {
      contemplado: true,
      dataContemplacao
    });

    await carregarClientesFirebase();

    alert("Cota marcada como contemplada.");

  } catch (erro) {
    console.error("Erro ao marcar contemplação:", erro);
    alert("Erro ao marcar contemplação.");
  }
}

async function desfazerContemplacao(firebaseId) {
  const confirmar = confirm("Deseja remover a contemplação desta cota?");

  if (!confirmar) return;

  try {
    await atualizarClienteFirebase(firebaseId, {
      contemplado: false,
      dataContemplacao: null,
      contemplacaoPaga: false,
      dataPagamentoContemplacao: null
    });

    await carregarClientesFirebase();

  } catch (erro) {
    console.error("Erro ao remover contemplação:", erro);
    alert("Erro ao remover contemplação.");
  }
}

function abrirCampoPagamentoContemplacao(firebaseId) {
  const area = document.getElementById(`area-pagamento-contemplacao-${firebaseId}`);

  if (!area) return;

  area.classList.toggle("ativa");

  const input = document.getElementById(`data-pagamento-contemplacao-${firebaseId}`);

  if (input && !input.value) {
    input.value = dataHojeInput();
  }
}

function confirmarPagamentoContemplacao(firebaseId) {
  const input = document.getElementById(`data-pagamento-contemplacao-${firebaseId}`);

  if (!input || !input.value) {
    alert("Informe a data do pagamento da contemplação.");
    return;
  }

  marcarContemplacaoPaga(firebaseId, input.value);
}

async function marcarContemplacaoPaga(firebaseId, dataPagamento) {
  try {
    const cadastro = cadastros.find(item => item.firebaseId === firebaseId);

    if (!cadastro) return;

    if (!cadastro.contemplado) {
      alert("A cota precisa estar contemplada antes de marcar o pagamento.");
      return;
    }

    await atualizarClienteFirebase(firebaseId, {
      contemplacaoPaga: true,
      dataPagamentoContemplacao: dataPagamento
    });

    await carregarClientesFirebase();

    alert("Pagamento da contemplação confirmado.");

  } catch (erro) {
    console.error("Erro ao marcar pagamento:", erro);
    alert("Erro ao marcar pagamento.");
  }
}

async function desfazerPagamentoContemplacao(firebaseId) {
  const confirmar = confirm(
    "Deseja remover a confirmação de pagamento da contemplação?"
  );

  if (!confirmar) return;

  try {
    await atualizarClienteFirebase(firebaseId, {
      contemplacaoPaga: false,
      dataPagamentoContemplacao: null
    });

    await carregarClientesFirebase();

  } catch (erro) {
    console.error("Erro ao remover pagamento:", erro);
    alert("Erro ao remover pagamento.");
  }
}

function abrirCampoInativacao(firebaseId) {
  const area = document.getElementById(`area-inativacao-${firebaseId}`);

  if (!area) return;

  area.classList.toggle("ativa");

  const input = document.getElementById(`data-inativacao-${firebaseId}`);

  if (input && !input.value) {
    input.value = dataHojeInput();
  }
}

function confirmarInativacao(firebaseId) {
  const input = document.getElementById(`data-inativacao-${firebaseId}`);

  if (!input || !input.value) {
    alert("Informe a data da inativação.");
    return;
  }

  inativarCadastro(firebaseId, input.value);
}

async function inativarCadastro(firebaseId, dataInativacao) {
  try {
    await atualizarClienteFirebase(firebaseId, {
      ativo: false,
      dataInativacao
    });

    await carregarClientesFirebase();

    alert("Cota marcada como inativa.");

  } catch (erro) {
    console.error("Erro ao inativar cota:", erro);
    alert("Erro ao inativar cota.");
  }
}

async function reativarCadastro(firebaseId) {
  const confirmar = confirm("Deseja reativar esta cota?");

  if (!confirmar) return;

  try {
    await atualizarClienteFirebase(firebaseId, {
      ativo: true,
      dataInativacao: null
    });

    await carregarClientesFirebase();

    alert("Cota reativada.");

  } catch (erro) {
    console.error("Erro ao reativar cota:", erro);
    alert("Erro ao reativar cota.");
  }
}

function renderizarFluxo(fluxo = []) {
  return fluxo.map(item => {
    return `
      <tr>
        <td>${item.mes === 999 ? "Contemplação" : item.mes}</td>
        <td>${item.percentual}</td>
        <td>${item.descricao}</td>
        <td class="texto-positivo">
          ${formatarMoeda(item.valor)}
        </td>
      </tr>
    `;
  }).join("");
}

function filtrarCadastros() {
  const termo = pesquisaClientes
    ? pesquisaClientes.value.toLowerCase().trim()
    : "";

  if (!termo) {
    return cadastros;
  }

  return cadastros.filter(cadastro => {
    const finalizada = cotaFinalizada(cadastro);

    const statusPagamento = cadastro.contemplacaoPaga
      ? "contemplação paga quitada"
      : "contemplação pendente pagamento";

    const statusAtivo = cadastro.ativo === false
      ? "inativo inadimplente desativado"
      : finalizada
        ? "finalizada finalizado encerrada encerrado"
        : "ativo ativa";

    const statusContemplacao = cadastro.contemplado
      ? "contemplado contemplada"
      : "não contemplado não contemplada falta contemplar faltam contemplar";

    return (
      String(cadastro.cliente || "").toLowerCase().includes(termo) ||
      String(cadastro.vendedor || "").toLowerCase().includes(termo) ||
      String(cadastro.numeroCota || "").toLowerCase().includes(termo) ||
      String(cadastro.plano || "").toLowerCase().includes(termo) ||
      statusPagamento.includes(termo) ||
      statusAtivo.includes(termo) ||
      statusContemplacao.includes(termo) ||
      formatarMoeda(cadastro.valorCredito).toLowerCase().includes(termo) ||
      formatarData(cadastro.dataVenda).toLowerCase().includes(termo) ||
      formatarData(cadastro.dataContemplacao).toLowerCase().includes(termo) ||
      formatarData(cadastro.dataPagamentoContemplacao).toLowerCase().includes(termo) ||
      formatarData(cadastro.dataInativacao).toLowerCase().includes(termo)
    );
  });
}

function renderizarPaginacao(totalItens) {
  if (!paginacaoClientes) return;

  const totalPaginas = Math.ceil(totalItens / clientesPorPagina);

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
      Página ${paginaAtual} de ${totalPaginas} • ${totalItens} cota(s)
    </div>
  `;

  paginacaoClientes.innerHTML = botoes;
}

function renderizarClientes() {
  calcularResumoClientes();

  const cadastrosFiltrados = filtrarCadastros();

  if (cadastros.length === 0) {
    listaClientes.innerHTML = `
      <div class="card">
        Nenhum cliente cadastrado.
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
        Nenhum resultado encontrado para a pesquisa.
      </div>
    `;

    if (paginacaoClientes) {
      paginacaoClientes.innerHTML = "";
    }

    return;
  }

  const ordenados = [...cadastrosFiltrados].reverse();

  const totalPaginas = Math.ceil(ordenados.length / clientesPorPagina);

  if (paginaAtual > totalPaginas) {
    paginaAtual = totalPaginas;
  }

  const inicio = (paginaAtual - 1) * clientesPorPagina;
  const fim = inicio + clientesPorPagina;

  const clientesPagina = ordenados.slice(inicio, fim);

  listaClientes.innerHTML = clientesPagina.map(cadastro => {
    const finalizada = cotaFinalizada(cadastro);
    const id = cadastro.firebaseId;

    return `
      <div class="card">

        <div class="card-topo">

          <div class="card-info">

            <div class="cliente-nome">
              ${cadastro.cliente || "-"}
            </div>

            <div class="linha-info">

              <span>
                <strong>Vendedor:</strong>
                ${cadastro.vendedor || "-"}
              </span>

              <span>
                <strong>Cota:</strong>
                ${cadastro.numeroCota || "-"}
              </span>

              <span>
                <strong>Plano:</strong>
                ${cadastro.plano || "-"} meses
              </span>

              <span>
                <strong>Crédito:</strong>
                ${formatarMoeda(cadastro.valorCredito)}
              </span>

              <span>
                <strong>Venda:</strong>
                ${formatarData(cadastro.dataVenda)}
              </span>

              ${
                cadastro.contemplado
                  ? `
                    <span>
                      <strong>Contemplação:</strong>
                      ${formatarData(cadastro.dataContemplacao)}
                    </span>
                  `
                  : ""
              }

              ${
                cadastro.contemplacaoPaga
                  ? `
                    <span>
                      <strong>Pagamento contemplação:</strong>
                      ${formatarData(cadastro.dataPagamentoContemplacao)}
                    </span>
                  `
                  : ""
              }

              ${
                cadastro.ativo === false
                  ? `
                    <span>
                      <strong>Inativada em:</strong>
                      ${formatarData(cadastro.dataInativacao)}
                    </span>
                  `
                  : ""
              }

            </div>

          </div>

          <div class="card-acoes">

            ${
              cadastro.ativo === false
                ? `<div class="status-inativo">COTA INATIVA</div>`
                : finalizada
                  ? `<div class="status-finalizada">COTA FINALIZADA</div>`
                  : `<div class="status-contemplado">COTA ATIVA</div>`
            }

            ${
              cadastro.contemplado
                ? `<div class="status-contemplado">CONTEMPLADA</div>`
                : `<div class="status-pendente">FALTA CONTEMPLAR</div>`
            }

            ${
              cadastro.contemplado
                ? cadastro.contemplacaoPaga
                  ? `<div class="status-contemplado">CONTEMPLAÇÃO PAGA</div>`
                  : `<div class="status-pendente">PGTO CONTEMPLAÇÃO PENDENTE</div>`
                : ""
            }

            <div class="area-botoes">

              ${
                !cadastro.contemplado
                  ? `
                    <button
                      class="btn-contemplado"
                      onclick="abrirCampoContemplacao('${id}')"
                    >
                      Marcar Contemplada
                    </button>
                  `
                  : `
                    <button
                      class="btn-excluir"
                      onclick="desfazerContemplacao('${id}')"
                    >
                      Remover Contemplação
                    </button>
                  `
              }

              ${
                cadastro.contemplado && !cadastro.contemplacaoPaga
                  ? `
                    <button
                      class="btn-contemplado"
                      onclick="abrirCampoPagamentoContemplacao('${id}')"
                    >
                      Marcar Pago
                    </button>
                  `
                  : ""
              }

              ${
                cadastro.contemplado && cadastro.contemplacaoPaga
                  ? `
                    <button
                      class="btn-excluir"
                      onclick="desfazerPagamentoContemplacao('${id}')"
                    >
                      Remover Pgto
                    </button>
                  `
                  : ""
              }

              ${
                cadastro.ativo === false
                  ? `
                    <button
                      class="btn-contemplado"
                      onclick="reativarCadastro('${id}')"
                    >
                      Reativar
                    </button>
                  `
                  : finalizada
                    ? ""
                    : `
                      <button
                        class="btn-inativo"
                        onclick="abrirCampoInativacao('${id}')"
                      >
                        Inativar
                      </button>
                    `
              }

              <button
                class="btn-excluir"
                onclick="excluirCadastro('${id}')"
              >
                Excluir
              </button>

            </div>

            ${
              !cadastro.contemplado
                ? `
                  <div class="area-contemplacao-card" id="area-contemplacao-${id}">
                    <input type="date" id="data-contemplacao-${id}">

                    <button onclick="confirmarContemplacao('${id}')">
                      Confirmar
                    </button>

                    <button class="btn-cancelar" onclick="abrirCampoContemplacao('${id}')">
                      Cancelar
                    </button>
                  </div>
                `
                : ""
            }

            ${
              cadastro.contemplado && !cadastro.contemplacaoPaga
                ? `
                  <div class="area-contemplacao-card" id="area-pagamento-contemplacao-${id}">
                    <input type="date" id="data-pagamento-contemplacao-${id}">

                    <button onclick="confirmarPagamentoContemplacao('${id}')">
                      Confirmar Pgto
                    </button>

                    <button class="btn-cancelar" onclick="abrirCampoPagamentoContemplacao('${id}')">
                      Cancelar
                    </button>
                  </div>
                `
                : ""
            }

            ${
              cadastro.ativo !== false && !finalizada
                ? `
                  <div class="area-contemplacao-card" id="area-inativacao-${id}">
                    <input type="date" id="data-inativacao-${id}">

                    <button onclick="confirmarInativacao('${id}')">
                      Confirmar
                    </button>

                    <button class="btn-cancelar" onclick="abrirCampoInativacao('${id}')">
                      Cancelar
                    </button>
                  </div>
                `
                : ""
            }

          </div>

        </div>

        <details class="detalhes-fluxo">

          <summary>
            Ver fluxo de comissão
          </summary>

          <div class="tabela-wrapper">

            <table class="tabela">

              <thead>
                <tr>
                  <th>Mês</th>
                  <th>%</th>
                  <th>Descrição</th>
                  <th>Valor</th>
                </tr>
              </thead>

              <tbody>
                ${renderizarFluxo(cadastro.calculo?.fluxo || [])}
              </tbody>

            </table>

          </div>

        </details>

      </div>
    `;
  }).join("");

  renderizarPaginacao(ordenados.length);
}

window.limparPesquisaClientes = limparPesquisaClientes;
window.mudarPaginaClientes = mudarPaginaClientes;
window.excluirCadastro = excluirCadastro;
window.abrirCampoContemplacao = abrirCampoContemplacao;
window.confirmarContemplacao = confirmarContemplacao;
window.desfazerContemplacao = desfazerContemplacao;
window.abrirCampoPagamentoContemplacao = abrirCampoPagamentoContemplacao;
window.confirmarPagamentoContemplacao = confirmarPagamentoContemplacao;
window.desfazerPagamentoContemplacao = desfazerPagamentoContemplacao;
window.abrirCampoInativacao = abrirCampoInativacao;
window.confirmarInativacao = confirmarInativacao;
window.reativarCadastro = reativarCadastro;

carregarClientesFirebase();




