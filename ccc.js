// Pure finance functions: no page or network dependencies.
(function (root) {
  function parseCSV(text) {
    const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
    const headers = lines.shift().split(',');
    return lines.filter(line => line.trim()).map(line => {
      const cells = line.split(',');
      if (cells.length !== headers.length) throw new Error('CSV row has an unexpected number of columns.');
      return Object.fromEntries(headers.map((key, i) => [key.trim(), cells[i].trim()]));
    });
  }
  function number(value, label) {
    if (value === undefined || value === '') throw new Error(`Missing ${label}.`);
    const result = Number(value);
    if (!Number.isFinite(result) || result < 0) throw new Error(`Invalid ${label}.`);
    return result;
  }
  function calculate(statement, assumptions) {
    const days = number(assumptions.find(row => row.assumption === 'days_in_year')?.value, 'days_in_year');
    if (!days) throw new Error('Days in year must be positive.');
    function balance(section, item, period) {
      const matches = statement.filter(row => row.section === section && row.item === item);
      if (matches.length !== 1) throw new Error(`Expected one ${section}/${item} row.`);
      return number(matches[0][period], `${period} ${item}`);
    }
    function period(name) {
      const revenue = balance('income_statement', 'revenue', name);
      const cogs = balance('income_statement', 'cogs', name);
      if (!revenue || !cogs) throw new Error('Revenue and COGS must be positive.');
      const inventory = balance('asset', 'inventory', name);
      const receivables = balance('asset', 'accounts_receivable', name);
      const payables = balance('liability_or_equity', 'accounts_payable', name);
      const dio = inventory / cogs * days;
      const dso = receivables / revenue * days;
      const dpo = payables / cogs * days;
      return { revenue, cogs, inventory, receivables, payables, dio, dso, dpo, ccc: dio + dso - dpo };
    }
    const before = period('before');
    const after = period('after');
    const freed = { inventory: before.inventory - after.inventory, receivables: before.receivables - after.receivables, payables: after.payables - before.payables };
    freed.total = freed.inventory + freed.receivables + freed.payables;
    return { days, before, after, freed };
  }
  const api = { parseCSV, calculate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CCC = api;
})(globalThis);
