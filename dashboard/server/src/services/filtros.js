/**
 * Serviço centralizado de extração e construção de filtros MongoDB.
 * Trata filtros globais: regiao, estado, filial, comprador, categoria, dataIni, dataFim.
 */

export function parseGlobalFilters(query = {}) {
  const {
    supervisor,
    cidade,
    regiao,
    estado,
    filial,
    comprador,
    categoria,
    dataIni,
    dataFim,
  } = query;

  return {
    supervisor: supervisor && supervisor.trim() !== '' ? supervisor.trim() : null,
    cidade: cidade && cidade.trim() !== '' ? cidade.trim() : null,
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
    if (f.cidade) match.Cidade = new RegExp(`^${f.cidade}$`, 'i');
    if (f.supervisor) match.Supervisor = new RegExp(`^${f.supervisor}$`, 'i');
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
    if (f.cidade) match.Cidade = new RegExp(`^${f.cidade}$`, 'i');
    if (f.supervisor) match.Supervisor = new RegExp(`^${f.supervisor}$`, 'i');
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
 * Constrói cláusula $match para inventarios (auditorias no nível de filial/loja)
 * Não inclui filtros de Comprador ou Categoria (inexistentes no log de inventários da filial).
 */
export function buildMatchInventarios(query = {}) {
  const f = parseGlobalFilters(query);
  const match = {};

  if (f.filial !== null) {
    match.Filial = f.filial;
  } else {
    if (f.cidade) {
      const escaped = f.cidade.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      match.Cidade = new RegExp(`^${escaped}$`, 'i');
    }
    if (f.supervisor) {
      const supClean = f.supervisor.includes(' - ') ? f.supervisor.split(' - ')[0].trim() : f.supervisor.trim();
      const escaped = supClean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      match.Supervisor = new RegExp(escaped, 'i');
    }
    if (f.estado) {
      const escaped = f.estado.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      match.Estado = new RegExp(`^${escaped}$`, 'i');
    }
    if (f.regiao) {
      const escaped = f.regiao.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      match.Regiao = new RegExp(`^${escaped}$`, 'i');
    }
  }

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
