import { getDB } from '../config/db.js';
import cache from '../utils/cache.js';
import { buildMatchCubo, buildMatchCuboMensal, parsePagination } from '../services/filtros.js';

export async function getVendasAvKpis(req, res) {
  const cacheKey = cache.generateKey('vendas-av:kpis', req.query);
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const db = getDB();
    if (!db) return res.status(503).json({ erro: 'Banco de dados não conectado' });

    const match = buildMatchCuboMensal(req.query);

    const agg = await db.collection('cubo_mensal_av').aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          faturamento_av: { $sum: '$faturamento_av' },
          total_av: { $sum: '$total_av' },
          qtd_vendida_av: { $sum: '$qtd_vendida_av' },
          venda_av_transacoes: { $sum: '$venda_av_transacoes' },
          qtd_abaixo_custo: { $sum: '$qtd_abaixo_custo' },
          valor_abaixo_custo: { $sum: '$valor_abaixo_custo' },
          faturamento_total: { $sum: '$faturamento' },
        },
      },
    ]).toArray();

    const row = agg[0] || {};
    const fatAv = Math.round((row.faturamento_av || 0) * 100) / 100;
    const totalAv = Math.round((row.total_av || 0) * 100) / 100;
    const qtdAv = row.qtd_vendida_av || 0;
    const transacoes = row.venda_av_transacoes || 0;
    const qtdAbaixo = row.qtd_abaixo_custo || 0;
    const valorAbaixo = Math.round((row.valor_abaixo_custo || 0) * 100) / 100;

    const percConversao = totalAv > 0 ? Math.round((fatAv / totalAv) * 10000) / 100 : 0;
    const ticketMedio = transacoes > 0 ? Math.round((fatAv / transacoes) * 100) / 100 : 0;
    const percAbaixoCusto = qtdAv > 0 ? Math.round((qtdAbaixo / qtdAv) * 10000) / 100 : 0;

    const result = {
      faturamento_av: fatAv,
      total_av: totalAv,
      qtd_vendida_av: qtdAv,
      transacoes_av: transacoes,
      ticket_medio_av: ticketMedio,
      qtd_abaixo_custo: qtdAbaixo,
      valor_abaixo_custo: valorAbaixo,
      perc_conversao_av: percConversao,
      meta_conversao: 80.0,
      perc_abaixo_custo: percAbaixoCusto,
    };

    cache.set(cacheKey, result, 300);
    res.json(result);
  } catch (error) {
    console.error('Erro em getVendasAvKpis:', error);
    res.status(500).json({ erro: 'Erro ao calcular KPIs de Vendas AV', detalhe: error.message });
  }
}

export async function getEvolucaoMensal(req, res) {
  const cacheKey = cache.generateKey('vendas-av:evolucao', req.query);
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const db = getDB();
    if (!db) return res.status(503).json({ erro: 'Banco de dados não conectado' });

    const match = buildMatchCuboMensal(req.query);

    const agg = await db.collection('cubo_mensal_av').aggregate([
      { $match: match },
      {
        $group: {
          _id: '$Ano_Mes',
          faturamento_av: { $sum: '$faturamento_av' },
          total_av: { $sum: '$total_av' },
          qtd_vendida_av: { $sum: '$qtd_vendida_av' },
          valor_abaixo_custo: { $sum: '$valor_abaixo_custo' },
        },
      },
      { $sort: { _id: 1 } },
    ]).toArray();

    const result = agg.map((r) => {
      const fat = Math.round(r.faturamento_av * 100) / 100;
      const tot = Math.round(r.total_av * 100) / 100;
      const perc = tot > 0 ? Math.round((fat / tot) * 10000) / 100 : 0;
      return {
        ano_mes: r._id,
        faturamento_av: fat,
        total_av: tot,
        qtd_vendida_av: r.qtd_vendida_av,
        valor_abaixo_custo: Math.round(r.valor_abaixo_custo * 100) / 100,
        perc_conversao: perc,
        meta: 80.0,
      };
    });

    cache.set(cacheKey, result, 300);
    res.json(result);
  } catch (error) {
    console.error('Erro em getEvolucaoMensal:', error);
    res.status(500).json({ erro: 'Erro ao buscar evolução mensal de vendas AV', detalhe: error.message });
  }
}

export async function getTopVendedores(req, res) {
  const cacheKey = cache.generateKey('vendas-av:vendedores', req.query);
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const db = getDB();
    if (!db) return res.status(503).json({ erro: 'Banco de dados não conectado' });

    const match = buildMatchCuboMensal(req.query);

    const agg = await db.collection('vendas_av').aggregate([
      { $match: match },
      {
        $group: {
          _id: '$ID_Vendedor',
          nome_vendedor: { $first: '$Nome_Vendedor' },
          filial: { $first: '$Filial' },
          nome_filial: { $first: '$Nome_Filial' },
          total_itens: { $sum: '$Quantidade_Vendida' },
          total_vendas: { $sum: 1 },
          valor_total: { $sum: '$Valor_Total' },
          vendas_abaixo_custo: { $sum: '$Is_Abaixo_Custo' },
        },
      },
      { $sort: { valor_total: -1 } },
      { $limit: 15 },
    ]).toArray();

    const result = agg.map((v) => ({
      id_vendedor: v._id,
      nome_vendedor: v.nome_vendedor || `Vendedor ${v._id}`,
      filial: v.filial,
      nome_filial: v.nome_filial,
      total_itens: v.total_itens,
      total_vendas: v.total_vendas,
      valor_total: Math.round(v.valor_total * 100) / 100,
      ticket_medio: v.total_vendas > 0 ? Math.round((v.valor_total / v.total_vendas) * 100) / 100 : 0,
      vendas_abaixo_custo: v.vendas_abaixo_custo,
    }));

    cache.set(cacheKey, result, 300);
    res.json(result);
  } catch (error) {
    console.error('Erro em getTopVendedores:', error);
    res.status(500).json({ erro: 'Erro ao buscar top vendedores AV', detalhe: error.message });
  }
}

export async function getPorCategoria(req, res) {
  const cacheKey = cache.generateKey('vendas-av:categorias', req.query);
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const db = getDB();
    if (!db) return res.status(503).json({ erro: 'Banco de dados não conectado' });

    const match = buildMatchCuboMensal(req.query);

    const agg = await db.collection('cubo_mensal_av').aggregate([
      { $match: match },
      {
        $group: {
          _id: '$Categoria',
          faturamento_av: { $sum: '$faturamento_av' },
          total_av: { $sum: '$total_av' },
          qtd_vendida_av: { $sum: '$qtd_vendida_av' },
          valor_abaixo_custo: { $sum: '$valor_abaixo_custo' },
        },
      },
      { $sort: { faturamento_av: -1 } },
    ]).toArray();

    const result = agg.map((c) => {
      const fat = Math.round(c.faturamento_av * 100) / 100;
      const tot = Math.round(c.total_av * 100) / 100;
      const perc = tot > 0 ? Math.round((fat / tot) * 10000) / 100 : 0;
      return {
        categoria: c._id || 'Outros',
        faturamento_av: fat,
        total_av: tot,
        qtd_vendida_av: c.qtd_vendida_av,
        valor_abaixo_custo: Math.round(c.valor_abaixo_custo * 100) / 100,
        perc_conversao: perc,
      };
    });

    cache.set(cacheKey, result, 300);
    res.json(result);
  } catch (error) {
    console.error('Erro em getPorCategoria:', error);
    res.status(500).json({ erro: 'Erro ao agrupar vendas AV por categoria', detalhe: error.message });
  }
}

export async function getTabelaVendasAv(req, res) {
  try {
    const db = getDB();
    if (!db) return res.status(503).json({ erro: 'Banco de dados não conectado' });

    const match = buildMatchCuboMensal(req.query);

    if (req.query.abaixo_custo === 'true') {
      match.Is_Abaixo_Custo = 1;
    } else if (req.query.abaixo_custo === 'false') {
      match.Is_Abaixo_Custo = 0;
    }

    if (req.query.q) {
      const q = req.query.q.trim();
      if (!isNaN(Number(q))) {
        match.$or = [{ Codigo_Produto: Number(q) }, { Filial: Number(q) }];
      } else {
        match.$or = [
          { Nome_Produto: new RegExp(q, 'i') },
          { Nome_Vendedor: new RegExp(q, 'i') },
          { Nome_Filial: new RegExp(q, 'i') },
        ];
      }
    }

    const sortMap = {
      id_venda: 'ID_Venda',
      data_venda: 'Data_Venda',
      filial: 'Filial',
      nome_filial: 'Nome_Filial',
      vendedor: 'Nome_Vendedor',
      produto: 'Nome_Produto',
      categoria: 'Categoria',
      quantidade: 'Quantidade_Vendida',
      valor_unitario: 'Valor_Unitario',
      custo_unitario: 'Custo_Ref',
      valor_total: 'Valor_Total',
      margem_perc: 'Margem_Perc',
      is_abaixo_custo: 'Is_Abaixo_Custo',
    };

    const { page, pageSize, skip, sort } = parsePagination(req.query, 'Data_Venda', -1, sortMap);

    const [total, docs] = await Promise.all([
      db.collection('vendas_av').countDocuments(match),
      db.collection('vendas_av')
        .find(match)
        .sort(sort)
        .skip(skip)
        .limit(pageSize)
        .toArray(),
    ]);

    res.json({
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      dados: docs.map((d) => ({
        id: d._id,
        id_venda: d.ID_Venda,
        data_venda: d.Data_Venda,
        filial: d.Filial,
        nome_filial: d.Nome_Filial,
        vendedor: d.Nome_Vendedor,
        codigo_produto: d.Codigo_Produto,
        produto: d.Nome_Produto,
        categoria: d.Categoria,
        quantidade: d.Quantidade_Vendida,
        valor_unitario: d.Valor_Unitario,
        custo_unitario: d.Custo_Ref,
        valor_total: d.Valor_Total,
        margem_perc: d.Margem_Perc,
        is_abaixo_custo: d.Is_Abaixo_Custo,
        desagio_valor: d.Desagio_Valor,
      })),
    });
  } catch (error) {
    console.error('Erro em getTabelaVendasAv:', error);
    res.status(500).json({ erro: 'Erro ao buscar tabela de vendas AV', detalhe: error.message });
  }
}

export default {
  getVendasAvKpis,
  getEvolucaoMensal,
  getTopVendedores,
  getPorCategoria,
  getTabelaVendasAv,
};
