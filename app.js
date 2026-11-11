'use strict';
const daysFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const moneyFormat = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
async function loadCSV(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Could not load ${path} (${response.status}).`);
  return CCC.parseCSV(await response.text());
}
async function start() {
  try {
    const [statement, assumptions] = await Promise.all([loadCSV('data/electromart.csv'), loadCSV('data/assumptions.csv')]);
    const result = CCC.calculate(statement, assumptions);
    const metrics = [ ['dio', 'DIO', 'Inventory held'], ['dso', 'DSO', 'Customer collection'], ['dpo', 'DPO', 'Supplier payment'], ['ccc', 'CCC', 'Cash conversion cycle'] ];
    document.querySelector('#metrics').innerHTML = metrics.map(([key, label, meaning]) => `<tr><th scope="row">${label}<span>${meaning}</span></th><td>${daysFormat.format(result.before[key])}</td><td>${daysFormat.format(result.after[key])}</td></tr>`).join('');
    document.querySelector('#cycle-summary').textContent = `${daysFormat.format(result.before.ccc)} → ${daysFormat.format(result.after.ccc)} days`;
    const levers = [ ['inventory', 'Inventory', 'Carry less stock'], ['receivables', 'Receivables', 'Collect from customers faster'], ['payables', 'Payables', 'Use more supplier financing'] ];
    document.querySelector('#cash-cards').innerHTML = levers.map(([key, label, explanation]) => `<article class="card"><h3>${label}</h3><strong>${moneyFormat.format(result.freed[key])}</strong><p>${explanation}</p><small>${moneyFormat.format(result.before[key])} → ${moneyFormat.format(result.after[key])}</small></article>`).join('');
    document.querySelector('#cash-total').textContent = moneyFormat.format(result.freed.total);
    document.querySelector('#conventions').textContent = `Uses a ${result.days}-day year from assumptions.csv. Calculations retain full precision; displayed days are rounded to two decimals and dollars to the nearest dollar.`;
    document.querySelector('#results').hidden = false;
    document.querySelector('#status').textContent = 'Loaded from the case CSV files.';
  } catch (error) {
    document.querySelector('#status').textContent = `Unable to calculate: ${error.message} Check the CSV files and reload. Serve this page through a web server so the browser can read the files.`;
    document.querySelector('#status').setAttribute('role', 'alert');
  }
}
start();
