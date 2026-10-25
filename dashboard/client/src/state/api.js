import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const rawBaseUrl = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/+$/, '')}/api`
  : '/api';

// BaseQuery com retry exponencial (3 tentativas) para lidar com cold start no plano free do Render
const baseQueryWithRetry = async (args, api, extraOptions) => {
  const rawBaseQuery = fetchBaseQuery({ baseUrl: rawBaseUrl });
  let result = await rawBaseQuery(args, api, extraOptions);

  if (result.error && (result.error.status === 'FETCH_ERROR' || result.error.status >= 500)) {
    // Retry 1 (1.5s)
    await new Promise((r) => setTimeout(r, 1500));
    result = await rawBaseQuery(args, api, extraOptions);

    if (result.error && (result.error.status === 'FETCH_ERROR' || result.error.status >= 500)) {
      // Retry 2 (3s)
      await new Promise((r) => setTimeout(r, 3000));
      result = await rawBaseQuery(args, api, extraOptions);
    }
  }

  return result;
};

// Converte objeto de filtros em query string limpa
const buildQueryString = (params = {}) => {
  const query = new URLSearchParams();
  Object.keys(params).forEach((key) => {
    const val = params[key];
    if (val !== undefined && val !== null && val !== '') {
      query.append(key, val);
    }
  });
  const qs = query.toString();
  return qs ? `?${qs}` : '';
};

export const api = createApi({
  reducerPath: 'adminApi',
  baseQuery: baseQueryWithRetry,
  tagTypes: ['Meta', 'Overview', 'Excesso', 'Ruptura', 'Score', 'VendasAv', 'Inventario'],
  endpoints: (build) => ({
    // Meta
    getHealth: build.query({
      query: () => '/health',
    }),
    getMetaFiltros: build.query({
      query: () => '/meta/filtros',
      providesTags: ['Meta'],
    }),

    // Overview Executivo
    getOverviewKpis: build.query({
      query: (params) => `/overview/kpis${buildQueryString(params)}`,
      providesTags: ['Overview'],
    }),
    getOverviewSerieMensal: build.query({
      query: (params) => `/overview/serie-mensal${buildQueryString(params)}`,
      providesTags: ['Overview'],
    }),
    getOverviewMixAv: build.query({
      query: (params) => `/overview/mix-av${buildQueryString(params)}`,
      providesTags: ['Overview'],
    }),
    getOverviewFiliais: build.query({
      query: (params) => `/overview/filiais${buildQueryString(params)}`,
      providesTags: ['Overview'],
    }),

    // Excesso de Estoque
    getExcessoKpis: build.query({
      query: (params) => `/excesso/kpis${buildQueryString(params)}`,
      providesTags: ['Excesso'],
    }),
    getExcessoTreemap: build.query({
      query: (params) => `/excesso/treemap${buildQueryString(params)}`,
      providesTags: ['Excesso'],
    }),
    getExcessoPorCategoria: build.query({
      query: (params) => `/excesso/por-categoria${buildQueryString(params)}`,
      providesTags: ['Excesso'],
    }),
    getExcessoFiliais: build.query({
      query: (params) => `/excesso/filiais${buildQueryString(params)}`,
      providesTags: ['Excesso'],
    }),

    // Monitor de Ruptura
    getRupturaKpis: build.query({
      query: (params) => `/ruptura/kpis${buildQueryString(params)}`,
      providesTags: ['Ruptura'],
    }),
    getRupturaDistribuicao: build.query({
      query: (params) => `/ruptura/distribuicao${buildQueryString(params)}`,
      providesTags: ['Ruptura'],
    }),
    getRupturaTabela: build.query({
      query: (params) => `/ruptura/tabela${buildQueryString(params)}`,
      providesTags: ['Ruptura'],
    }),

    // Score de Auditoria
    getScoreKpis: build.query({
      query: (params) => `/score/kpis${buildQueryString(params)}`,
      providesTags: ['Score'],
    }),
    getScoreDistribuicao: build.query({
      query: (params) => `/score/distribuicao${buildQueryString(params)}`,
      providesTags: ['Score'],
    }),
    getScoreAcoes: build.query({
      query: (params) => `/score/acoes${buildQueryString(params)}`,
      providesTags: ['Score'],
    }),
    getScoreHeatmap: build.query({
      query: (params) => `/score/heatmap${buildQueryString(params)}`,
      providesTags: ['Score'],
    }),
    getScoreTabela: build.query({
      query: (params) => `/score/tabela${buildQueryString(params)}`,
      providesTags: ['Score'],
    }),
    getScoreProdutoDetalhe: build.query({
      query: ({ filial, codigo }) => `/score/produto/${filial}/${codigo}`,
      providesTags: ['Score'],
    }),

    // Vendas de Produtos A Vencer (AV)
    getVendasAvKpis: build.query({
      query: (params) => `/vendas-av/kpis${buildQueryString(params)}`,
      providesTags: ['VendasAv'],
    }),
    getVendasAvEvolucao: build.query({
      query: (params) => `/vendas-av/evolucao${buildQueryString(params)}`,
      providesTags: ['VendasAv'],
    }),
    getVendasAvTopVendedores: build.query({
      query: (params) => `/vendas-av/top-vendedores${buildQueryString(params)}`,
      providesTags: ['VendasAv'],
    }),
    getVendasAvPorCategoria: build.query({
      query: (params) => `/vendas-av/por-categoria${buildQueryString(params)}`,
      providesTags: ['VendasAv'],
    }),
    getVendasAvTabela: build.query({
      query: (params) => `/vendas-av/tabela${buildQueryString(params)}`,
      providesTags: ['VendasAv'],
    }),

    // Acuracidade de Estoque e Inventário
    getInventarioKpis: build.query({
      query: (params) => `/inventario/kpis${buildQueryString(params)}`,
      providesTags: ['Inventario'],
    }),
    getInventarioEvolucao: build.query({
      query: (params) => `/inventario/evolucao${buildQueryString(params)}`,
      providesTags: ['Inventario'],
    }),
    getInventarioUltimo: build.query({
      query: (params) => `/inventario/ultimo-inventario${buildQueryString(params)}`,
      providesTags: ['Inventario'],
    }),
    getInventarioDivergenciasCat: build.query({
      query: (params) => `/inventario/divergencias-categoria${buildQueryString(params)}`,
      providesTags: ['Inventario'],
    }),
    getInventarioTopProdutos: build.query({
      query: (params) => `/inventario/top-produtos${buildQueryString(params)}`,
      providesTags: ['Inventario'],
    }),
  }),
});

export const {
  useGetHealthQuery,
  useGetMetaFiltrosQuery,
  useGetOverviewKpisQuery,
  useGetOverviewSerieMensalQuery,
  useGetOverviewMixAvQuery,
  useGetOverviewFiliaisQuery,
  useGetExcessoKpisQuery,
  useGetExcessoTreemapQuery,
  useGetExcessoPorCategoriaQuery,
  useGetExcessoFiliaisQuery,
  useGetRupturaKpisQuery,
  useGetRupturaDistribuicaoQuery,
  useGetRupturaTabelaQuery,
  useGetScoreKpisQuery,
  useGetScoreDistribuicaoQuery,
  useGetScoreAcoesQuery,
  useGetScoreHeatmapQuery,
  useGetScoreTabelaQuery,
  useGetScoreProdutoDetalheQuery,
  useGetVendasAvKpisQuery,
  useGetVendasAvEvolucaoQuery,
  useGetVendasAvTopVendedoresQuery,
  useGetVendasAvPorCategoriaQuery,
  useGetVendasAvTabelaQuery,
  useGetInventarioKpisQuery,
  useGetInventarioEvolucaoQuery,
  useGetInventarioUltimoQuery,
  useGetInventarioDivergenciasCatQuery,
  useGetInventarioTopProdutosQuery,
} = api;

export default api;
