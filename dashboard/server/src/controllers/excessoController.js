import { getDB } from '../config/db.js';
import cache from '../utils/cache.js';
import { buildMatchCubo, parsePagination } from '../services/filtros.js';

export async function getExcessoKpis(req, res) {
  const cacheKey = cache.generateKey('excesso:kpis', req.query);
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const db = getDB();
    if (!db) return res.status(503).json({ erro: 'Banco de dados não conectado' });

    const matchCubo = buildMatchCubo(req.query);

    const [aggGeral, aggFiliais] = await Promise.all([
      db.collection('cubo').aggregate([
        { $match: matchCubo },
        {
          $group: {
            _id: null,
            estoque_un: { $sum: '$estoque_un' },
            excesso_un: { $sum: '$excesso_un' },
            valor_estoque_custo: { $sum: '$valor_estoque_custo' },
            valor_excesso_custo: { $sum: '$valor_excesso_custo' },
          },
        },
      ]).toArray(),

      // Agrupa por filial para calcular lojas com excesso > 15%
      db.collection('cubo').aggregate([
        { $match: matchCubo },
        {
          $group: {
            _id: '$Filial',
            estoque_un: { $sum: '$estoque_un' },
            excesso_un: { $sum: '$excesso_un' },
          },
        },
      ]).toArray(),
    ]);

    const g = aggGeral[0] || {};
    const estoqueTotal = g.estoque_un || 0;
    const excessoTotal = g.excesso_un || 0;
    const valorEstoque = Math.round((g.valor_estoque_custo || 0) * 100) / 100;
    const valorExcesso = Math.round((g.valor_excesso_custo || 0) * 100) / 100;
    const percIndice = estoqueTotal > 0 ? Math.round((excessoTotal / estoqueTotal) * 10000) / 100 : 0;

    const totalFiliais = aggFiliais.length;
    let qtdFiliaisCriticas = 0;
    aggFiliais.forEach((f) => {
      if (f.estoque_un > 0 && (f.excesso_un / f.estoque_un) > 0.05) {
        qtdFiliaisCriticas++;
      }
    });
    const percFiliaisCriticas = totalFiliais > 0 ? Math.round((qtdFiliaisCriticas / totalFiliais) * 10000) / 100 : 0;

    const result = {
      estoque_total_un: estoqueTotal,
      excesso_total_un: excessoTotal,
      valor_estoque_custo: valorEstoque,
      valor_excesso_custo: valorExcesso,
      perc_indice_excesso: percIndice,
      qtd_filiais_criticas: qtdFiliaisCriticas,
      total_filiais: totalFiliais,
      perc_filiais_criticas: percFiliaisCriticas,
    };

    cache.set(cacheKey, result, 300);
    res.json(result);
  } catch (error) {
    console.error('Erro em getExcessoKpis:', error);
    res.status(500).json({ erro: 'Erro ao calcular KPIs de Excesso', detalhe: error.message });
  }
}

export async function getTreemap(req, res) {
  const cacheKey = cache.generateKey('excesso:treemap', req.query);
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const db = getDB();
    if (!db) return res.status(503).json({ erro: 'Banco de dados não conectado' });

    const matchCubo = buildMatchCubo(req.query);

    const filiaisAgg = await db.collection('cubo').aggregate([
      { $match: matchCubo },
      {
        $group: {
          _id: { filial: '$Filial', supervisor: '$Supervisor' },
          nome_filial: { $first: '$Nome_Filial' },
          cidade: { $first: '$Cidade' },
          estoque_un: { $sum: '$estoque_un' },
          excesso_un: { $sum: '$excesso_un' },
          valor_excesso_custo: { $sum: '$valor_excesso_custo' },
        },
      },
    ]).toArray();

    // Monta hierarquia Supervisor -> Filial para Nivo Treemap
    const supervisorMap = new Map();

    filiaisAgg.forEach((f) => {
      const supervisor = f._id.supervisor || 'Outros';
      const filialNum = f._id.filial;
      const nome = f.nome_filial || `Filial ${filialNum}`;
      const estoque = f.estoque_un || 0;
      const excesso = f.excesso_un || 0;
      const valorExcesso = Math.round((f.valor_excesso_custo || 0) * 100) / 100;
      const percExcesso = estoque > 0 ? Math.round((excesso / estoque) * 10000) / 100 : 0;

      if (!supervisorMap.has(supervisor)) {
        supervisorMap.set(supervisor, []);
      }

      supervisorMap.get(supervisor).push({
        name: `${nome} (#${filialNum})`,
        filial: filialNum,
        loc: estoque, // Nivo treemap metric size
        estoque_un: estoque,
        excesso_un: excesso,
        valor_excesso: valorExcesso,
        perc_excesso: percExcesso,
      });
    });

    const children = [];
    for (const [supervisor, listaFiliais] of supervisorMap.entries()) {
      children.push({
        name: supervisor,
        children: listaFiliais,
      });
    }

    const topFiliais = filiaisAgg
      .map((f) => {
        const nome = f.nome_filial || `Filial ${f._id.filial}`;
        const estoque = f.estoque_un || 0;
        const excesso = f.excesso_un || 0;
        const valorExcesso = Math.round((f.valor_excesso_custo || 0) * 100) / 100;
        const percExcesso = estoque > 0 ? Math.round((excesso / estoque) * 10000) / 100 : 0;
        return {
          filial: f._id.filial,
          nome,
          nome_curto: nome.length > 18 ? `${nome.substring(0, 16)}...` : nome,
          cidade: f.cidade || '—',
          supervisor: f._id.supervisor || '—',
          estoque_un: estoque,
          excesso_un: excesso,
          valor_excesso: valorExcesso,
          perc_excesso: percExcesso,
        };
      })
      .sort((a, b) => b.valor_excesso - a.valor_excesso)
      .slice(0, 10);

    const result = {
      name: 'Rede',
      children,
      top_filiais: topFiliais,
    };

    cache.set(cacheKey, result, 300);
    res.json(result);
  } catch (error) {
    console.error('Erro em getTreemap:', error);
    res.status(500).json({ erro: 'Erro ao gerar treemap de excesso', detalhe: error.message });
  }
}

export async function getPorCategoria(req, res) {
  const cacheKey = cache.generateKey('excesso:por-categoria', req.query);
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const db = getDB();
    if (!db) return res.status(503).json({ erro: 'Banco de dados não conectado' });

    const match = buildMatchCubo(req.query);

    const agg = await db.collection('indicadores').aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            categoria: '$Categoria',
            nivel: '$Nivel_Excesso',
          },
          count: { $sum: 1 },
          excesso_un: { $sum: '$Qtd_Estoque_Excesso' },
          valor_excesso: { $sum: '$Valor_Excesso_Custo' },
        },
      },
    ]).toArray();

    const catMap = new Map();

    agg.forEach((item) => {
      const cat = item._id.categoria || 'OUTROS';
      const nivel = item._id.nivel;

      if (!catMap.has(cat)) {
        catMap.set(cat, {
          categoria: cat,
          normal: 0,
          elevado: 0,
          critico: 0,
          total: 0,
          valor_excesso_total: 0,
        });
      }

      const cData = catMap.get(cat);
      cData.total += item.count;
      cData.valor_excesso_total += item.valor_excesso || 0;

      if (nivel === 'Excesso Crítico') {
        cData.critico += item.count;
      } else if (nivel === 'Excesso Elevado') {
        cData.elevado += item.count;
      } else {
        cData.normal += item.count;
      }
    });

    const result = Array.from(catMap.values())
      .map((c) => ({
        ...c,
        valor_excesso_total: Math.round(c.valor_excesso_total * 100) / 100,
      }))
      .sort((a, b) => b.total - a.total);

    cache.set(cacheKey, result, 300);
    res.json(result);
  } catch (error) {
    console.error('Erro em getPorCategoria:', error);
    res.status(500).json({ erro: 'Erro ao agrupar excesso por categoria', detalhe: error.message });
  }
}

export async function getFiliaisExcesso(req, res) {
  try {
    const db = getDB();
    if (!db) return res.status(503).json({ erro: 'Banco de dados não conectado' });

    const matchCubo = buildMatchCubo(req.query);

    // Agrega do cubo principal por filial
    const agg = await db.collection('cubo').aggregate([
      { $match: matchCubo },
      {
        $group: {
          _id: '$Filial',
          nome_filial: { $first: '$Nome_Filial' },
          regiao: { $first: '$Regiao' },
          estado: { $first: '$Estado' },
          estoque_un: { $sum: '$estoque_un' },
          excesso_un: { $sum: '$excesso_un' },
          valor_estoque_custo: { $sum: '$valor_estoque_custo' },
          valor_excesso_custo: { $sum: '$valor_excesso_custo' },
        },
      },
    ]).toArray();

    // Obtém supervisor de dFilial para enriquecer a tabela gerencial
    const filiaisMeta = await db.collection('dFilial').find({}, {
      projection: { Filial: 1, Supervisor: 1 }
    }).toArray();
    const supMap = new Map();
    filiaisMeta.forEach((f) => supMap.set(f.Filial, f.Supervisor));

    let lista = agg.map((f) => {
      const estoque = f.estoque_un || 0;
      const excesso = f.excesso_un || 0;
      const valorExcesso = Math.round((f.valor_excesso_custo || 0) * 100) / 100;
      const valorEstoque = Math.round((f.valor_estoque_custo || 0) * 100) / 100;
      const percExcesso = estoque > 0 ? Math.round((excesso / estoque) * 10000) / 100 : 0;

      return {
        filial: f._id,
        nome_filial: f.nome_filial || `Filial ${f._id}`,
        supervisor: supMap.get(f._id) || 'N/A',
        regiao: f.regiao,
        estado: f.estado,
        estoque_un: estoque,
        excesso_un: excesso,
        valor_estoque_custo: valorEstoque,
        valor_excesso_custo: valorExcesso, // Capital imobilizado em excesso
        perc_excesso: percExcesso,
      };
    });

    const { page, pageSize, sort } = parsePagination(req.query, 'valor_excesso_custo', -1);
    const sortField = Object.keys(sort)[0];
    const sortDir = sort[sortField];

    lista.sort((a, b) => {
      let va = a[sortField];
      let vb = b[sortField];
      if (typeof va === 'string') return sortDir * va.localeCompare(vb);
      return sortDir * ((va || 0) - (vb || 0));
    });

    const total = lista.length;
    const paginada = lista.slice(page * pageSize, (page + 1) * pageSize);

    res.json({
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      dados: paginada,
    });
  } catch (error) {
    console.error('Erro em getFiliaisExcesso:', error);
    res.status(500).json({ erro: 'Erro ao buscar filiais com excesso', detalhe: error.message });
  }
}

export default {
  getExcessoKpis,
  getTreemap,
  getPorCategoria,
  getFiliaisExcesso,
};
