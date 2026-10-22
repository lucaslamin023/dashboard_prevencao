/**
 * Utilitário para serialização de dados em formato CSV com UTF-8 BOM
 * (compatível com Excel em português).
 */
export function toCSV(rows, columns = null) {
  if (!rows || rows.length === 0) {
    return '\uFEFF';
  }

  // Se columns não foi fornecido, obtém as chaves do primeiro objeto
  const headers = columns || Object.keys(rows[0]);

  const escapeCell = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r') || str.includes(';')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = headers.map(escapeCell).join(';');
  const dataLines = rows.map((row) =>
    headers.map((h) => escapeCell(row[h] !== undefined ? row[h] : '')).join(';')
  );

  // Usa ponto-e-vírgula ';' para compatibilidade nativa com Excel regional pt-BR
  return '\uFEFF' + [headerLine, ...dataLines].join('\r\n');
}

export default { toCSV };
