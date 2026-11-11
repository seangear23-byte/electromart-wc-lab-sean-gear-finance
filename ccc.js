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
    const policy = Object.fromEntries(['bank_rate', 'supplier_discount', 'discount_days', 'net_days'].map(key => [key, number(assumptions.find(row => row.assumption === key)?.value, key)]));
    if (policy.supplier_discount >= 1 || policy.net_days <= policy.discount_days) throw new Error('Invalid supplier terms.');
    const bankLine = balance('liability_or_equity', 'notes_payable', 'before');
    return { days, before, after, freed, policy, bankLine };
  }
  function scenario(model, inputs) {
    const dio = number(inputs.dio, 'DIO');
    const dso = number(inputs.dso, 'DSO');
    const dpo = number(inputs.dpo, 'DPO');
    const inventory = dio * model.before.cogs / model.days;
    const receivables = dso * model.before.revenue / model.days;
    const payables = dpo * model.before.cogs / model.days;
    const freed = { inventory: model.before.inventory - inventory, receivables: model.before.receivables - receivables, payables: payables - model.before.payables };
    freed.total = freed.inventory + freed.receivables + freed.payables;
    const debtPaydown = Math.min(freed.total, model.bankLine);
    const takesDiscount = dpo <= model.policy.discount_days;
    return { dio, dso, dpo, ccc: dio + dso - dpo, inventory, receivables, payables, freed,
      debtPaydown, bankRemaining: model.bankLine - debtPaydown,
      excessCash: Math.max(0, freed.total - model.bankLine),
      interestSaved: debtPaydown * model.policy.bank_rate,
      pastDue: Math.max(0, dpo - model.policy.net_days), takesDiscount,
      discountCost: takesDiscount ? null : model.policy.supplier_discount / (1 - model.policy.supplier_discount) * model.days / (dpo - model.policy.discount_days) };
  }
  const api = { parseCSV, calculate, scenario };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CCC = api;
})(globalThis);
