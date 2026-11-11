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
    setupLevers(result);
    document.querySelector('#conventions').textContent = `Uses a ${result.days}-day year from assumptions.csv. Calculations retain full precision; displayed days are rounded to two decimals and dollars to the nearest dollar.`;
    document.querySelector('#results').hidden = false;
    document.querySelector('#status').textContent = 'Loaded from the case CSV files.';
  } catch (error) {
    document.querySelector('#status').textContent = `Unable to calculate: ${error.message} Check the CSV files and reload. Serve this page through a web server so the browser can read the files.`;
    document.querySelector('#status').setAttribute('role', 'alert');
  }
}
start();

function setupLevers(model) {
  const percent = new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const controls = [['dio', 'DIO · Days Inventory Outstanding'], ['dso', 'DSO · Days Sales Outstanding'], ['dpo', 'DPO · Days Payable Outstanding']];
  document.querySelector('#sliders').innerHTML = controls.map(([key, label]) => `<div class="lever"><label for="${key}">${label}</label><div class="lever-inputs"><input type="range" id="${key}" min="0" max="${Math.max(model.days, model.before[key], model.after[key])}" step="any"><input type="number" id="${key}-exact" min="0" step="any" aria-label="${label}, exact days"></div><output for="${key}" id="${key}-display"></output></div>`).join('');
  const inputs = {};
  function render() {
    const s = CCC.scenario(model, inputs);
    for (const [key] of controls) {
      document.querySelector(`#${key}-display`).textContent = `${daysFormat.format(s[key])} days`;
      document.querySelector(`#${key}`).setAttribute('aria-valuetext', `${daysFormat.format(s[key])} days`);
    }
    const rows = [
      ['Cash conversion cycle', `${daysFormat.format(s.ccc)} days`],
      ['Inventory balance', moneyFormat.format(s.inventory)],
      ['Accounts receivable balance', moneyFormat.format(s.receivables)],
      ['Accounts payable balance', moneyFormat.format(s.payables)],
      ['Cash freed by inventory', moneyFormat.format(s.freed.inventory)],
      ['Cash freed by receivables', moneyFormat.format(s.freed.receivables)],
      ['Cash freed by payables', moneyFormat.format(s.freed.payables)],
      ['Total cash freed vs. Before', moneyFormat.format(s.freed.total)],
      ['Bank line remaining under paydown assumption', moneyFormat.format(s.bankRemaining)],
      ['Cash left after fully repaying the bank line', moneyFormat.format(s.excessCash)],
      ['Annual interest savings / (extra interest)', moneyFormat.format(s.interestSaved)],
      ['Days paid past supplier due date', `${daysFormat.format(s.pastDue)} days`],
      ['Nominal annual cost of missing supplier discount', s.takesDiscount ? 'Discount taken; no skipped-discount cost' : percent.format(s.discountCost)]
    ];
    document.querySelector('#scenario-results').innerHTML = `<dl class="scenario-values">${rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>`;
  }
  function setValue(key, value) {
    inputs[key] = value;
    const slider = document.querySelector(`#${key}`);
    slider.max = Math.max(Number(slider.max), value);
    slider.value = value;
    document.querySelector(`#${key}-exact`).value = value;
  }
  function preset(period) {
    for (const [key] of controls) setValue(key, model[period][key]);
    render();
  }
  for (const [key] of controls) {
    for (const id of [key, `${key}-exact`]) {
      document.querySelector(`#${id}`).addEventListener('input', event => {
        const field = event.target;
        if (field.value === '' || !field.validity.valid || !Number.isFinite(Number(field.value))) return;
        setValue(key, Number(field.value));
        render();
      });
    }
  }
  document.querySelector('#set-before').addEventListener('click', () => preset('before'));
  document.querySelector('#set-after').addEventListener('click', () => preset('after'));
  document.querySelector('#policy-note').textContent = `Bank rate: ${percent.format(model.policy.bank_rate)}. Supplier discount: ${percent.format(model.policy.supplier_discount)} within ${model.policy.discount_days} days; full payment due in ${model.policy.net_days} days. Annual discount cost = discount ÷ (1 − discount) × ${model.days} ÷ (DPO − discount days), when DPO exceeds the discount period.`;
  preset('before');
}
