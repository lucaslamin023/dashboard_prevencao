/**
 * Serviço centralizado de extração e construção de filtros MongoDB.
 * Trata filtros globais: regiao, estado, filial, comprador, categoria, dataIni, dataFim.
 */

export function parseGlobalFilters(query = {}) {
  const {
    regiao,
    estado,
    filial,
    comprador,
    categoria,
    dataIni,
    dataFim,
  } = query;

  return {
    regiao: regiao && regiao.trim() !== '' ? regiao.trim() : null,
    estado: estado && estado.trim() !== '' ? estado.trim() : null,
    filial: filial && !isNaN(Number(filial)) ? Number(filial) : null,
    comprador: comprador && comprador.trim() !== '' ? comprador.trim() : null,
    categoria: categoria && categoria.trim() !== '' ? categoria.trim() : null,
    dataIni: dataIni && dataIni.trim() !== '' ? dataIni.trim() : null,
    dataFim: dataFim && dataFim.trim() !== '' ? dataFim.trim() : null,
  };
}

/**
 * Constrói cláusula $match para cubo, cubo_acoes e indicadores
 */
export function buildMatchCubo(query = {}) {
  const f = parseGlobalFilters(query);
  const match = {};

  if (f.filial !== null) {
    match.Filial = f.filial;
  } else {
    if (f.estado) match.Estado = new RegExp(`^${f.estado}$`, 'i');
    if (f.regiao) match.Regiao = new RegExp(`^${f.regiao}$`, 'i');
  }

  if (f.comprador) match.Comprador = new RegExp(`^${f.comprador}$`, 'i');
  if (f.categoria) match.Categoria = new RegExp(`^${f.categoria}$`, 'i');

  return match;
}

/**
 * Constrói cláusula $match para cubo_mensal (inclui filtro de período Ano_Mes)
 */
export function buildMatchCuboMensal(query = {}) {
  const f = parseGlobalFilters(query);
  const match = {};

  if (f.filial !== null) {
    match.Filial = f.filial;
  } else {
    if (f.estado) match.Estado = new RegExp(`^${f.estado}$`, 'i');
    if (f.regiao) match.Regiao = new RegExp(`^${f.regiao}$`, 'i');
  }

  if (f.comprador) match.Comprador = new RegExp(`^${f.comprador}$`, 'i');
  if (f.categoria) match.Categoria = new RegExp(`^${f.categoria}$`, 'i');

  // dataIni e dataFim afetam apenas o cubo_mensal
  if (f.dataIni && f.dataFim) {
    match.Ano_Mes = { $gte: f.dataIni, $lte: f.dataFim };
  } else if (f.dataIni) {
    match.Ano_Mes = { $gte: f.dataIni };
  } else if (f.dataFim) {
    match.Ano_Mes = { $lte: f.dataFim };
  }

  return match;
}

/**
 * Constrói paginação e ordenação padrão para tabelas
 */
export function parsePagination(query = {}, defaultSort = '_id', defaultOrder = 1, fieldMap = {}) {
  const page = Math.max(0, parseInt(query.page, 10) || 0);
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize, 10) || 25));

  const rawField = query.sort || defaultSort;
  const sortField = (fieldMap && fieldMap[rawField]) ? fieldMap[rawField] : rawField;
  let sortOrder = defaultOrder;

  if (query.order) {
    const o = String(query.order).toLowerCase();
    sortOrder = (o === 'desc' || o === '-1') ? -1 : 1;
  }

  return {
    page,
    pageSize,
    skip: page * pageSize,
    limit: pageSize,
    sort: { [sortField]: sortOrder },
  };
}

export default {
  parseGlobalFilters,
  buildMatchCubo,
  buildMatchCuboMensal,
  parsePagination,
};
