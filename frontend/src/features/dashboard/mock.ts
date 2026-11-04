// DADOS DE EXEMPLO. Substituir pelas chamadas à API (features/dashboard/api.ts)
// quando os endpoints existirem. Nada aqui vem do backend.
import type { CelulaDiaHorario, DadosDashboard, FaixaHorario } from "./types";

function emDias(dias: number, hora = 9): string {
  const data = new Date();
  data.setDate(data.getDate() + dias);
  data.setHours(hora, 0, 0, 0);
  return data.toISOString();
}

function haMinutos(minutos: number): string {
  return new Date(Date.now() - minutos * 60_000).toISOString();
}

// Engajamento por dia da semana e faixa de horário (gerado de forma determinística)
const FAIXAS: FaixaHorario[] = ["manha", "tarde", "noite"];
const porDiaHorario: CelulaDiaHorario[] = [];
for (let dia = 0; dia < 7; dia++) {
  FAIXAS.forEach((faixa, i) => {
    const util = dia >= 1 && dia <= 5;
    const posts = util ? 3 + ((dia + i) % 4) : 1 + (i % 2);
    const impressoes = posts * (900 + dia * 70 + i * 120);
    const fator = (util ? 0.05 : 0.03) + (faixa === "manha" ? 0.015 : 0);
    const interacoes = Math.round(impressoes * fator);
    porDiaHorario.push({
      dia,
      faixa,
      posts,
      impressoes,
      curtidas: Math.round(interacoes * 0.6),
      comentarios: Math.round(interacoes * 0.12),
      compartilhamentos: Math.round(interacoes * 0.08),
      cliques: Math.round(interacoes * 0.2),
    });
  });
}

export const dashboardMock: DadosDashboard = {
  postsPorStatus: { draft: 6, review: 2, approved: 3, published: 24 },

  proximosPosts: [
    {
      id: "p1",
      title: "5 erros ao migrar para a nuvem",
      assunto: "Cloud para PMEs",
      redes: ["linkedin", "x"],
      status: "approved",
      dataPrevista: emDias(1),
    },
    {
      id: "p2",
      title: "Bastidores do nosso processo de onboarding",
      assunto: "Cultura da empresa",
      redes: ["instagram"],
      status: "draft",
      dataPrevista: emDias(2, 18),
    },
    {
      id: "p3",
      title: "Checklist de segurança para o fim do ano",
      assunto: "Segurança da informação",
      redes: ["linkedin", "instagram", "x"],
      status: "approved",
      dataPrevista: emDias(4),
    },
    {
      id: "p4",
      title: "Como medir o ROI de automação",
      assunto: "Cloud para PMEs",
      redes: ["linkedin"],
      status: "draft",
      dataPrevista: emDias(6, 12),
    },
  ],

  ultimasExecucoes: [
    {
      id: "e1",
      modo: "creation",
      pedido: "Post sobre o checklist de segurança, com base no PDF da auditoria",
      status: "completed",
      passos: 6,
      iniciadaEm: haMinutos(35),
    },
    {
      id: "e2",
      modo: "ideation",
      pedido: "Temas para a próxima semana sobre cloud",
      status: "completed",
      passos: 4,
      iniciadaEm: haMinutos(60 * 5),
    },
    {
      id: "e3",
      modo: "creation",
      pedido: "Carrossel do Instagram sobre onboarding",
      status: "limit_reached",
      passos: 8,
      iniciadaEm: haMinutos(60 * 26),
    },
    {
      id: "e4",
      modo: "ideation",
      pedido: "O que está funcionando melhor no LinkedIn?",
      status: "error",
      passos: 2,
      iniciadaEm: haMinutos(60 * 50),
    },
  ],

  desempenho: {
    porRede: [
      {
        grupo: "linkedin",
        posts: 12,
        impressoes: 18400,
        curtidas: 640,
        comentarios: 96,
        compartilhamentos: 58,
        cliques: 310,
      },
      {
        grupo: "instagram",
        posts: 8,
        impressoes: 11200,
        curtidas: 720,
        comentarios: 64,
        compartilhamentos: 41,
        cliques: 88,
      },
      {
        grupo: "x",
        posts: 4,
        impressoes: 5300,
        curtidas: 120,
        comentarios: 18,
        compartilhamentos: 35,
        cliques: 74,
      },
    ],
    porAssunto: [
      {
        grupo: "Cloud para PMEs",
        posts: 10,
        impressoes: 16100,
        curtidas: 610,
        comentarios: 82,
        compartilhamentos: 60,
        cliques: 280,
      },
      {
        grupo: "Segurança da informação",
        posts: 7,
        impressoes: 10400,
        curtidas: 470,
        comentarios: 55,
        compartilhamentos: 44,
        cliques: 120,
      },
      {
        grupo: "Cultura da empresa",
        posts: 5,
        impressoes: 6900,
        curtidas: 330,
        comentarios: 33,
        compartilhamentos: 22,
        cliques: 52,
      },
      {
        grupo: "Eventos",
        posts: 2,
        impressoes: 1500,
        curtidas: 70,
        comentarios: 8,
        compartilhamentos: 8,
        cliques: 20,
      },
    ],
    porDiaHorario,
  },
};
