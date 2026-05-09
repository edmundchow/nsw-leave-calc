const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_IDS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const MILLIS_PER_DAY = 1000 * 60 * 60 * 24;
let nswHolidays = [];
let db;
let calcTimer;

function isValidDate(date) {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

function parseDropdownDate(prefix) {
  const dEl = document.getElementById(`${prefix}Day`);
  const mEl = document.getElementById(`${prefix}Month`);
  const yEl = document.getElementById(`${prefix}Year`);
  if (!dEl || !mEl || !yEl) return null;
  const date = new Date(Number(yEl.value), Number(mEl.value), Number(dEl.value));
  return isValidDate(date) ? date : null;
}

function scheduleRecalculate() {
  clearTimeout(calcTimer);
  calcTimer = setTimeout(() => {
    calculateLeave();
    saveToDB();
  }, 80);
}

function populateDropdowns(prefix, startYear, endYear) {
  const dSel = document.getElementById(prefix + 'Day');
  const mSel = document.getElementById(prefix + 'Month');
  const ySel = document.getElementById(prefix + 'Year');
  if (!dSel || !mSel || !ySel) return;

  dSel.innerHTML = ''; mSel.innerHTML = ''; ySel.innerHTML = '';
  for (let i = 1; i <= 31; i++) dSel.options.add(new Option(i, i));
  months.forEach((m, i) => mSel.options.add(new Option(m, i)));
  for (let i = startYear; i <= endYear; i++) ySel.options.add(new Option(i, i));
}

function setDropdownDate(prefix, dateStr) {
  const date = new Date(dateStr);
  const dEl = document.getElementById(`${prefix}Day`);
  const mEl = document.getElementById(`${prefix}Month`);
  const yEl = document.getElementById(`${prefix}Year`);
  if (!dEl || !mEl || !yEl || !isValidDate(date)) return;
  dEl.value = date.getDate();
  mEl.value = date.getMonth();
  yEl.value = date.getFullYear();
}

function getState() {
  return {
    mode: document.getElementById('calcMode')?.value || 'startDate',
    hireDate: parseDropdownDate('hire'),
    balanceDate: parseDropdownDate('balance'),
    weeklyHours: Number(document.getElementById('weeklyHours')?.value || 0),
    startBalance: Number(document.getElementById('startBalance')?.value || 0),
    roster: DAY_IDS.map(id => !!document.getElementById(id)?.checked),
    takenHours: Array.from(document.querySelectorAll('.history-item')).reduce((s, el) => s + Number(el.dataset.amount || 0), 0),
    resignationMode: !!document.getElementById('resignationMode')?.checked,
    targetLastDay: parseDropdownDate('target'),
    noticeWeeks: Number(document.getElementById('noticeWeeks')?.value || 0),
    hourlyRate: Number(document.getElementById('hourlyRate')?.value || 0),
    superRate: Number(document.getElementById('superRate')?.value || 11.5)
  };
}

function validateState(state) {
  if (!isValidDate(state.hireDate)) return 'Please select a valid hire date.';
  if (state.mode === 'knownBalance' && !isValidDate(state.balanceDate)) return 'Please select a valid balance date.';
  if (!Number.isFinite(state.weeklyHours) || state.weeklyHours <= 0) return 'Weekly hours must be greater than zero.';
  const workingDays = state.roster.filter(Boolean).length;
  if (workingDays === 0) return 'Select at least one ordinary working day.';
  if (state.resignationMode && !isValidDate(state.targetLastDay)) return 'Please select a valid target last day.';
  if (state.noticeWeeks < 0) return 'Notice weeks cannot be negative.';
  if (state.resignationMode && state.hourlyRate <= 0) return 'Enter an hourly rate for resignation analysis.';
  return null;
}

function calculateServiceYears(start, end) {
  const msDiff = end.getTime() - start.getTime();
  return msDiff / (365.2425 * MILLIS_PER_DAY);
}

function calculateLeaveFromState(state) {
  const today = new Date();
  const serviceYears = Math.max(0, calculateServiceYears(state.hireDate, today));
  const annualPerYearHours = state.weeklyHours * 4;
  let annualAccrued = annualPerYearHours * serviceYears;

  if (state.mode === 'knownBalance') {
    const yearsSinceBalance = Math.max(0, calculateServiceYears(state.balanceDate, today));
    annualAccrued = state.startBalance + (annualPerYearHours * yearsSinceBalance);
  }

  const finalHours = Math.max(0, annualAccrued - state.takenHours);
  const workingDays = state.roster.filter(Boolean).length;
  const hrsPerDay = state.weeklyHours / workingDays;

  return {
    annualHours: finalHours,
    annualDays: finalHours / hrsPerDay,
    lslWeeks: serviceYears * (8.6667 / 10),
    serviceYears
  };
}


function calculateExitStrategies(state, output) {
  if (!state.resignationMode) return null;
  const workingDays = state.roster.filter(Boolean).length;
  const hrsPerDay = state.weeklyHours / workingDays;
  const availableDays = output.annualHours / hrsPerDay;
  const noticeDaysRequired = (state.noticeWeeks * 7) * (workingDays / 7);
  const coverage = availableDays >= noticeDaysRequired ? 'Fully covered' : (availableDays > 0 ? 'Partially covered' : 'Not covered');

  const payoutValue = output.annualHours * state.hourlyRate;
  const payoutSuperLost = payoutValue * (state.superRate / 100);

  const extraAccrualHours = Math.max(0, Math.min(availableDays, noticeDaysRequired)) * (state.weeklyHours * 4 / 260);
  const runDownHours = output.annualHours + extraAccrualHours;
  const runDownValue = runDownHours * state.hourlyRate;

  return { coverage, noticeDaysRequired, availableDays, payoutValue, payoutSuperLost, runDownValue, extraAccrualHours };
}

function renderStrategies(result) {
  const el = document.getElementById('strategyResults');
  if (!el) return;
  if (!result) {
    el.innerHTML = 'Enable resignation mode to compare payout vs run-down.';
    return;
  }
  const diff = result.runDownValue - (result.payoutValue - result.payoutSuperLost);
  const winner = diff >= 0 ? 'Run-down strategy leads' : 'Lump-sum payout leads';
  el.innerHTML = `
    <b>Notice Coverage:</b> ${result.coverage}<br>
    <b>Available leave days:</b> ${result.availableDays.toFixed(1)} / ${result.noticeDaysRequired.toFixed(1)} needed<br>
    <b>Lump Sum:</b> $${result.payoutValue.toFixed(2)} (super opportunity loss: $${result.payoutSuperLost.toFixed(2)})<br>
    <b>Run-Down:</b> $${result.runDownValue.toFixed(2)} (includes +${result.extraAccrualHours.toFixed(2)} hrs accrued)<br>
    <b>Result:</b> ${winner} by $${Math.abs(diff).toFixed(2)}
  `;
}

function renderValidation(msg) {
  const annual = document.getElementById('resAnnual');
  const days = document.getElementById('resDays');
  const lsl = document.getElementById('resLSL');
  annual.innerText = '—';
  days.innerText = '—';
  lsl.innerText = '—';
  annual.title = msg;
  days.title = msg;
  lsl.title = msg;
}

function clearValidation() {
  ['resAnnual', 'resDays', 'resLSL'].forEach(id => document.getElementById(id).title = '');
}

function calculateLeave() {
  const state = getState();
  const validationError = validateState(state);
  if (validationError) {
    renderValidation(validationError);
    return;
  }
  clearValidation();
  const output = calculateLeaveFromState(state);
  const strategy = calculateExitStrategies(state, output);
  renderStrategies(strategy);
  document.getElementById('resAnnual').innerText = output.annualHours.toFixed(2);
  document.getElementById('resDays').innerText = output.annualDays.toFixed(1);
  document.getElementById('resLSL').innerText = output.lslWeeks.toFixed(3);
}

async function fetchHolidays() { /* unchanged */
  try {
    const apiUrl = 'https://data.gov.au/data/api/3/action/datastore_search?resource_id=d256f282-ba27-4c64-ade7-0d7ad2530554&limit=1000';
    const response = await fetch(apiUrl);
    const data = await response.json();
    nswHolidays = data.result.records.filter(r => r.Jurisdiction && r.Jurisdiction.toLowerCase() === 'nsw').map(r => {
      const d = r.Date.toString();
      return `${d.substring(0, 4)}-${d.substring(4, 6)}-${d.substring(6, 8)}`;
    });
  } catch (e) {
    nswHolidays = ["2026-01-01", "2026-01-26", "2026-04-03", "2026-04-06", "2026-04-25", "2026-06-08", "2026-10-05", "2026-12-25", "2026-12-28", "2027-01-01", "2027-01-26", "2027-03-26", "2027-03-29", "2027-04-26", "2027-06-14", "2027-10-04", "2027-12-25", "2027-12-27", "2027-12-28"];
  }
  calculateLeave();
}

function toggleMode() {
  const mode = document.getElementById('calcMode')?.value;
  const section = document.getElementById('balanceSection');
  if (section) section.style.display = mode === 'knownBalance' ? 'block' : 'none';
  scheduleRecalculate();
}

function saveToDB() {
  if (!db) return;
  const hireDate = parseDropdownDate('hire');
  const balanceDate = parseDropdownDate('balance');
  const profile = {
    hireDate: hireDate ? hireDate.toISOString() : null,
    calcMode: document.getElementById('calcMode')?.value || 'startDate',
    weeklyHours: document.getElementById('weeklyHours')?.value || 38,
    balanceDate: balanceDate ? balanceDate.toISOString() : null,
    startBalance: document.getElementById('startBalance')?.value || 0,
    roster: DAY_IDS.map(id => !!document.getElementById(id)?.checked),
    history: Array.from(document.querySelectorAll('.history-item')).map(item => ({ id: item.dataset.id, note: item.querySelector('.note-text').innerText, amount: Number(item.dataset.amount) })),
    resignationMode: !!document.getElementById('resignationMode')?.checked,
    targetLastDay: parseDropdownDate('target')?.toISOString() || null,
    noticeWeeks: Number(document.getElementById('noticeWeeks')?.value || 0),
    hourlyRate: Number(document.getElementById('hourlyRate')?.value || 0),
    superRate: Number(document.getElementById('superRate')?.value || 11.5)
  };
  db.transaction('userData', 'readwrite').objectStore('userData').put(profile, 'profile');
}

function loadFromDB() {
  db.transaction('userData', 'readonly').objectStore('userData').get('profile').onsuccess = (e) => {
    const d = e.target.result; if (!d) return;
    setDropdownDate('hire', d.hireDate);
    setDropdownDate('balance', d.balanceDate);
    if (document.getElementById('calcMode')) document.getElementById('calcMode').value = d.calcMode || 'startDate';
    if (document.getElementById('weeklyHours')) document.getElementById('weeklyHours').value = d.weeklyHours || 38;
    if (document.getElementById('startBalance')) document.getElementById('startBalance').value = d.startBalance || 0;
    if (d.roster) d.roster.forEach((c, i) => { const el = document.getElementById(DAY_IDS[i]); if (el) el.checked = c; });
    if (document.getElementById('resignationMode')) document.getElementById('resignationMode').checked = !!d.resignationMode;
    setDropdownDate('target', d.targetLastDay);
    if (document.getElementById('noticeWeeks')) document.getElementById('noticeWeeks').value = d.noticeWeeks ?? 2;
    if (document.getElementById('hourlyRate')) document.getElementById('hourlyRate').value = d.hourlyRate ?? 35;
    if (document.getElementById('superRate')) document.getElementById('superRate').value = d.superRate ?? 11.5;
    if (d.history) { document.getElementById('historyList').innerHTML = ''; d.history.forEach(appendHistoryDOM); }
    toggleMode();
  };
}

function addHistoryEntry() {
  const start = parseDropdownDate('leaveStart');
  const end = parseDropdownDate('leaveEnd');
  const weeklyHours = Number(document.getElementById('weeklyHours')?.value || 38);
  const workingDays = DAY_IDS.filter(id => document.getElementById(id)?.checked).length;
  if (!start || !end || workingDays === 0) return;
  const daily = weeklyHours / workingDays;
  let total = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (document.getElementById(DAY_IDS[d.getDay()])?.checked && !nswHolidays.includes(d.toISOString().split('T')[0])) total += daily;
  }
  appendHistoryDOM({ id: Date.now(), note: document.getElementById('leaveNote').value || 'Leave', amount: total });
  scheduleRecalculate();
}

function appendHistoryDOM(h) { const div = document.createElement('div'); div.className = 'history-item'; div.dataset.id = h.id; div.dataset.amount = h.amount; div.innerHTML = `<span class="note-text">${h.note} (${h.amount.toFixed(1)} hrs)</span><button class="btn-del" onclick="this.parentElement.remove(); scheduleRecalculate();">Delete</button>`; document.getElementById('historyList').appendChild(div); }
function optimizeLeave() { /* unchanged logic */ const resultsDiv = document.getElementById('optimizationResults'); resultsDiv.innerHTML = 'Analyzing...'; if (nswHolidays.length === 0) return; const tips = []; const today = new Date(); const endDate = parseDropdownDate('opt'); const hData = nswHolidays.map(h => new Date(h)).sort((a, b) => a - b); hData.forEach(h => { if (h < today || h > endDate) return; const day = h.getDay(); const dateStr = h.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }); if (day === 2) tips.push({ title: `Long Weekend Hack: ${dateStr}`, desc: 'Take Monday off to create a 4-day weekend.', mult: '4 days off for 1 day leave' }); if (day === 4) tips.push({ title: `Long Weekend Hack: ${dateStr}`, desc: 'Take Friday off to create a 4-day weekend.', mult: '4 days off for 1 day leave' }); if (day === 3) tips.push({ title: `Mid-week Win: ${dateStr}`, desc: 'Take Mon+Tue OR Thu+Fri off for a 5-day break.', mult: '5 days off for 2 days leave' }); if (day === 5 && (h.getMonth() === 2 || h.getMonth() === 3)) tips.push({ title: 'Easter Mega-Break', desc: 'Take the 4 days after Easter Monday off.', mult: '10 days off for 4 days leave' }); if (h.getMonth() === 11 && h.getDate() === 25) tips.push({ title: 'End of Year Reset', desc: "Take the 3 days between Boxing Day and New Year's Day.", mult: '10 days off for 3 days leave' }); }); const uniqueTips = Array.from(new Set(tips.map(a => JSON.stringify(a)))).map(a => JSON.parse(a)); resultsDiv.innerHTML = uniqueTips.length > 0 ? uniqueTips.map(t => `<div class="opt-item"><span class="opt-tag">${t.title}</span><br>${t.desc}<br><small style="color:#28a745;"><b>${t.mult}</b></small></div>`).join('') : 'No high-value clusters found in this period.'; }

function initializeUI() {
  const curYear = new Date().getFullYear();
  populateDropdowns('hire', 1995, curYear + 1);
  populateDropdowns('balance', 1995, curYear + 1);
  populateDropdowns('leaveStart', curYear - 1, curYear + 2);
  populateDropdowns('leaveEnd', curYear - 1, curYear + 2);
  populateDropdowns('opt', curYear, curYear + 2);
  populateDropdowns('target', curYear, curYear + 2);
  document.getElementById('optDay').value = 31;
  document.getElementById('targetDay').value = new Date().getDate();
  document.getElementById('targetMonth').value = new Date().getMonth();
  document.getElementById('targetYear').value = curYear;
  document.getElementById('optMonth').value = 11;
  document.getElementById('optYear').value = curYear + 1;

  document.querySelectorAll('input, select').forEach(el => {
    if (el.id !== 'calcMode') {
      el.addEventListener('input', scheduleRecalculate);
      el.addEventListener('change', scheduleRecalculate);
    }
  });
}

const dbRequest = indexedDB.open('NSWLeaveTracker', 1);
dbRequest.onupgradeneeded = (e) => e.target.result.createObjectStore('userData');
dbRequest.onsuccess = (e) => {
  db = e.target.result;
  initializeUI();
  fetchHolidays();
  loadFromDB();
  calculateLeave();
};

dbRequest.onerror = () => {
  initializeUI();
  fetchHolidays();
  calculateLeave();
};