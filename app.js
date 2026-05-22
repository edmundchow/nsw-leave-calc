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
  const items = Array.from(document.querySelectorAll('.history-item'));
  const mode = document.getElementById('calcMode')?.value || 'startDate';
  const balanceDate = parseDropdownDate('balance');
  const balanceDateMs = balanceDate ? balanceDate.getTime() : 0;
  return {
    mode,
    hireDate: parseDropdownDate('hire'),
    balanceDate,
    weeklyHours: Number(document.getElementById('weeklyHours')?.value || 0),
    startBalance: Number(document.getElementById('startBalance')?.value || 0),
    roster: DAY_IDS.map(id => !!document.getElementById(id)?.checked),
    annualTakenHours: items.reduce((s, el) => {
      if (el.dataset.type && el.dataset.type !== 'annual') return s;
      const amount = Number(el.dataset.amount || 0);
      if (mode === 'knownBalance' && el.dataset.end) {
        const endDate = new Date(el.dataset.end);
        if (isValidDate(endDate) && endDate.getTime() <= balanceDateMs) return s;
      }
      return s + amount;
    }, 0),
    lslTakenHours: items.reduce((s, el) => s + (el.dataset.type === 'lsl' ? Number(el.dataset.amount || 0) : 0), 0),
    personalTakenHours: items.reduce((s, el) => s + (el.dataset.type === 'personal' ? Number(el.dataset.amount || 0) : 0), 0),
    casualLoading: !!document.getElementById('casualLoading')?.checked,
    enableProjectDate: !!document.getElementById('enableProjectDate')?.checked,
    projectDate: parseDropdownDate('project'),
    resignationMode: !!document.getElementById('resignationMode')?.checked,
    targetLastDay: parseDropdownDate('target'),
    noticeWeeks: Number(document.getElementById('noticeWeeks')?.value || 0),
    acceptedNoticeDays: Number(document.getElementById('acceptedNoticeDays')?.value || 0),
    hourlyRate: Number(document.getElementById('hourlyRate')?.value || 0),
    superRate: Number(document.getElementById('superRate')?.value || 11.5),
    leaveLoading: Number(document.getElementById('leaveLoading')?.value || 0)
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
  if (state.acceptedNoticeDays < 0) return 'Accepted notice days cannot be negative.';
  if (state.resignationMode && state.hourlyRate <= 0) return 'Enter an hourly rate for resignation analysis.';
  return null;
}

function calculateServiceYears(start, end) {
  const msDiff = end.getTime() - start.getTime();
  return msDiff / (365.2425 * MILLIS_PER_DAY);
}

function calculateLeaveFromState(state) {
  const today = state.enableProjectDate && isValidDate(state.projectDate) ? state.projectDate : new Date();
  const serviceYears = Math.max(0, calculateServiceYears(state.hireDate, today));
  const annualPerYearHours = state.weeklyHours * 4;
  let annualAccrued = annualPerYearHours * serviceYears;

  if (state.mode === 'knownBalance') {
    const yearsSinceBalance = Math.max(0, calculateServiceYears(state.balanceDate, today));
    annualAccrued = state.startBalance + (annualPerYearHours * yearsSinceBalance);
  }

  const finalHours = Math.max(0, annualAccrued - state.annualTakenHours);
  const workingDays = state.roster.filter(Boolean).length;
  const hrsPerDay = state.weeklyHours / workingDays;
  const lslWeeksAccrued = serviceYears * (8.6667 / 10);
  const lslTakenWeeks = state.lslTakenHours / state.weeklyHours;
  const lslWeeks = Math.max(0, lslWeeksAccrued - lslTakenWeeks);
  const personalPerYearHours = (state.weeklyHours / state.roster.filter(Boolean).length) * 10;
  const personalAccrued = personalPerYearHours * serviceYears;
  const personalHours = Math.max(0, personalAccrued - state.personalTakenHours);

  return {
    annualHours: finalHours,
    annualDays: finalHours / hrsPerDay,
    lslWeeks,
    personalHours,
    serviceYears
  };
}


function getEffectiveRate(state) {
  return state.hourlyRate * (state.casualLoading ? 1.25 : 1);
}

function calculateExitStrategies(state, output) {
  if (!state.resignationMode) return null;
  const workingDays = state.roster.filter(Boolean).length;
  const hrsPerDay = state.weeklyHours / workingDays;
  const availableDays = output.annualHours / hrsPerDay;
  const noticeDaysRequired = (state.noticeWeeks * 7) * (workingDays / 7);
  const coverage = availableDays >= noticeDaysRequired ? 'Fully covered' : (availableDays > 0 ? 'Partially covered' : 'Not covered');
  const effRate = getEffectiveRate(state);

  const loadingMultiplier = 1 + state.leaveLoading / 100;
  const payoutValue = output.annualHours * effRate * loadingMultiplier;
  const payoutSuperLost = payoutValue * (state.superRate / 100);

  const extraAccrualHours = Math.max(0, Math.min(availableDays, noticeDaysRequired)) * (state.weeklyHours * 4 / 260);
  const runDownHours = output.annualHours + extraAccrualHours;
  const runDownValue = runDownHours * effRate;

  return { coverage, noticeDaysRequired, availableDays, payoutValue, payoutSuperLost, runDownValue, extraAccrualHours, leaveLoading: state.leaveLoading };
}

function renderStrategies(result) {
  const el = document.getElementById('strategyResults');
  if (!el) return;
  if (!result) {
    el.innerHTML = 'Enable exit strategy analysis to compare payout vs run-down.';
    return;
  }
  const diff = result.runDownValue - (result.payoutValue - result.payoutSuperLost);
  const winner = diff >= 0 ? 'Run-down strategy leads' : 'Lump-sum payout leads';
  el.innerHTML = `
    <b>Notice Coverage:</b> ${result.coverage}<br>
    <b>Available leave days:</b> ${result.availableDays.toFixed(1)} / ${result.noticeDaysRequired.toFixed(1)} needed<br>
    <b>Lump Sum:</b> $${result.payoutValue.toFixed(2)}${result.leaveLoading > 0 ? ` (incl. ${result.leaveLoading}% loading)` : ''} (super opportunity loss: $${result.payoutSuperLost.toFixed(2)})<br>
    <b>Run-Down:</b> $${result.runDownValue.toFixed(2)} (includes +${result.extraAccrualHours.toFixed(2)} hrs accrued)<br>
    <b>Result:</b> ${winner} by $${Math.abs(diff).toFixed(2)}
  `;
}

function isWorkingDay(date, state) {
  const idx = date.getDay();
  if (!state.roster[idx]) return false;
  return !nswHolidays.includes(date.toISOString().split('T')[0]);
}

function findResignationDate(targetLastDay, requiredWorkingDays, state) {
  if (requiredWorkingDays <= 0) return new Date(targetLastDay);
  const cursor = new Date(targetLastDay);
  let counted = 0;
  while (counted < requiredWorkingDays) {
    cursor.setDate(cursor.getDate() - 1);
    if (isWorkingDay(cursor, state)) counted += 1;
  }
  return cursor;
}

function renderNoticePlanner(state) {
  const el = document.getElementById('noticePlannerResults');
  if (!el) return;
  if (!state.resignationMode || !isValidDate(state.targetLastDay)) {
    el.innerHTML = '';
    return;
  }
  const workingDays = state.roster.filter(Boolean).length;
  const dailyHours = state.weeklyHours / workingDays;
  const dailyPay = dailyHours * getEffectiveRate(state);
  const requiredDays = Math.max(0, Math.round(state.noticeWeeks * workingDays));
  const acceptedDays = Math.min(requiredDays, Math.max(0, Math.round(state.acceptedNoticeDays)));
  const fullDate = findResignationDate(state.targetLastDay, requiredDays, state);
  const partialDate = findResignationDate(state.targetLastDay, acceptedDays, state);
  const lossDays = requiredDays - acceptedDays;
  const incomeLoss = lossDays * dailyPay;
  const superLoss = incomeLoss * (state.superRate / 100);
  const fmt = (d) => d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
  let partialLine;
  if (acceptedDays === 0) {
    partialLine = `If released on submission day: last day is submission day, loss is ${lossDays} working day${lossDays === 1 ? '' : 's'}.`;
  } else {
    partialLine = `If notice reduced to ${acceptedDays} working day${acceptedDays === 1 ? '' : 's'}: submit by <b>${fmt(partialDate)}</b>.`;
  }
  el.innerHTML = `
    <b>Notice planner:</b><br>
    Serve full ${requiredDays} working day notice: submit by <b>${fmt(fullDate)}</b> to leave on ${fmt(state.targetLastDay)}.<br>
    ${partialLine}<br>
    Notice shortfall: <b>${lossDays}</b> working day${lossDays === 1 ? '' : 's'}.<br>
    Estimated income loss: <b>$${incomeLoss.toFixed(2)}</b><br>
    Estimated super loss: <b>$${superLoss.toFixed(2)}</b>
  `;
}

function renderValidation(msg) {
  ['resAnnual', 'resDays', 'resLSL', 'resPersonal'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.innerText = '—'; el.title = msg; }
  });
}

function clearValidation() {
  ['resAnnual', 'resDays', 'resLSL', 'resPersonal'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.title = '';
  });
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
  renderNoticePlanner(state);
  document.getElementById('resAnnual').innerText = output.annualHours.toFixed(2);
  document.getElementById('resDays').innerText = output.annualDays.toFixed(1);
  document.getElementById('resLSL').innerText = output.lslWeeks.toFixed(3);
  const personalEl = document.getElementById('resPersonal');
  if (personalEl) personalEl.innerText = output.personalHours.toFixed(2);
}

const NSW_HOLIDAY_FALLBACK = [
  "2025-01-01","2025-01-27","2025-04-18","2025-04-21","2025-04-25","2025-06-09","2025-10-06","2025-12-25","2025-12-26",
  "2026-01-01","2026-01-26","2026-04-03","2026-04-06","2026-04-25","2026-06-08","2026-10-05","2026-12-25","2026-12-28",
  "2027-01-01","2027-01-26","2027-03-26","2027-03-29","2027-04-26","2027-06-14","2027-10-04","2027-12-25","2027-12-27","2027-12-28",
  "2028-01-03","2028-01-26","2028-04-14","2028-04-17","2028-04-25","2028-06-12","2028-10-02","2028-12-25","2028-12-26",
  "2029-01-01","2029-01-26","2029-03-30","2029-04-02","2029-04-25","2029-06-11","2029-10-01","2029-12-25","2029-12-26",
  "2030-01-01","2030-01-28","2030-04-19","2030-04-22","2030-04-25","2030-06-10","2030-10-07","2030-12-25","2030-12-26"
];

async function fetchHolidays() {
  try {
    const apiUrl = 'https://data.gov.au/data/api/3/action/datastore_search?resource_id=d256f282-ba27-4c64-ade7-0d7ad2530554&limit=1000';
    const response = await fetch(apiUrl);
    const data = await response.json();
    nswHolidays = data.result.records.filter(r => r.Jurisdiction && r.Jurisdiction.toLowerCase() === 'nsw').map(r => {
      const d = r.Date.toString();
      return `${d.substring(0, 4)}-${d.substring(4, 6)}-${d.substring(6, 8)}`;
    });
    if (db) {
      db.transaction('userData', 'readwrite').objectStore('userData').put(nswHolidays, 'holidays');
    }
  } catch (e) {
    if (db) {
      const tx = db.transaction('userData', 'readonly').objectStore('userData').get('holidays');
      tx.onsuccess = (e2) => {
        nswHolidays = e2.target.result || NSW_HOLIDAY_FALLBACK;
        calculateLeave();
      };
      return;
    }
    nswHolidays = NSW_HOLIDAY_FALLBACK;
  }
  calculateLeave();
}

function toggleMode() {
  const mode = document.getElementById('calcMode')?.value;
  const section = document.getElementById('balanceSection');
  if (section) section.style.display = mode === 'knownBalance' ? 'block' : 'none';
  scheduleRecalculate();
}

function toggleProjectDate() {
  const section = document.getElementById('projectDateSection');
  if (section) section.style.display = document.getElementById('enableProjectDate')?.checked ? 'flex' : 'none';
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
    history: Array.from(document.querySelectorAll('.history-item')).map(item => ({ id: item.dataset.id, note: item.querySelector('.note-text').innerText, amount: Number(item.dataset.amount), type: item.dataset.type, startDate: item.dataset.start || '', endDate: item.dataset.end || '' })),
    casualLoading: !!document.getElementById('casualLoading')?.checked,
    enableProjectDate: !!document.getElementById('enableProjectDate')?.checked,
    projectDate: parseDropdownDate('project')?.toISOString() || null,
    resignationMode: !!document.getElementById('resignationMode')?.checked,
    targetLastDay: parseDropdownDate('target')?.toISOString() || null,
    noticeWeeks: Number(document.getElementById('noticeWeeks')?.value || 0),
    acceptedNoticeDays: Number(document.getElementById('acceptedNoticeDays')?.value || 0),
    hourlyRate: Number(document.getElementById('hourlyRate')?.value || 0),
    superRate: Number(document.getElementById('superRate')?.value || 11.5),
    leaveLoading: Number(document.getElementById('leaveLoading')?.value || 0)
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
    if (document.getElementById('roster')) d.roster.forEach((c, i) => { const el = document.getElementById(DAY_IDS[i]); if (el) el.checked = c; });
    if (document.getElementById('casualLoading')) document.getElementById('casualLoading').checked = !!d.casualLoading;
    if (document.getElementById('enableProjectDate')) document.getElementById('enableProjectDate').checked = !!d.enableProjectDate;
    setDropdownDate('project', d.projectDate);
    if (document.getElementById('resignationMode')) document.getElementById('resignationMode').checked = !!d.resignationMode;
    setDropdownDate('target', d.targetLastDay);
    if (document.getElementById('noticeWeeks')) document.getElementById('noticeWeeks').value = d.noticeWeeks ?? 2;
    if (document.getElementById('acceptedNoticeDays')) document.getElementById('acceptedNoticeDays').value = d.acceptedNoticeDays ?? 0;
    if (document.getElementById('hourlyRate')) document.getElementById('hourlyRate').value = d.hourlyRate ?? 35;
    if (document.getElementById('superRate')) document.getElementById('superRate').value = d.superRate ?? 11.5;
    if (document.getElementById('leaveLoading')) document.getElementById('leaveLoading').value = d.leaveLoading ?? 0;
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
  if (end < start) { alert('End date must be on or after start date.'); return; }
  const daily = weeklyHours / workingDays;
  let total = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (document.getElementById(DAY_IDS[d.getDay()])?.checked && !nswHolidays.includes(d.toISOString().split('T')[0])) total += daily;
  }
  const type = document.querySelector('input[name="leaveType"]:checked')?.value || 'annual';
  appendHistoryDOM({ id: Date.now(), note: document.getElementById('leaveNote').value || 'Leave', amount: total, type, startDate: start.toISOString(), endDate: end.toISOString() });
  scheduleRecalculate();
}

function appendHistoryDOM(h) { const div = document.createElement('div'); div.className = 'history-item'; div.dataset.id = h.id; div.dataset.amount = h.amount; div.dataset.type = h.type || 'annual'; if (h.startDate) div.dataset.start = h.startDate; if (h.endDate) div.dataset.end = h.endDate; const label = h.type === 'lsl' ? 'LSL' : h.type === 'personal' ? 'Personal' : 'AL'; const start = h.startDate ? fmtDate(new Date(h.startDate)) : ''; const end = h.endDate ? fmtDate(new Date(h.endDate)) : ''; const dates = start && end ? `${start} – ${end}` : ''; div.innerHTML = `<span class="note-text">${h.note} (${h.amount.toFixed(1)} hrs) [${label}]${dates ? '<br><small style="color:#666;">' + dates + '</small>' : ''}</span><button class="btn-del" onclick="this.parentElement.remove(); scheduleRecalculate();">Delete</button>`; document.getElementById('historyList').appendChild(div); }

function calculateWhatIf() {
  const el = document.getElementById('whatifResults');
  if (!el) return;
  const start = parseDropdownDate('whatifStart');
  const end = parseDropdownDate('whatifEnd');
  const weeklyHours = Number(document.getElementById('weeklyHours')?.value || 0);
  const workingDays = DAY_IDS.filter(id => document.getElementById(id)?.checked).length;
  if (!start || !end || workingDays === 0) { el.innerHTML = 'Select valid dates and ensure at least one working day.'; return; }
  const daily = weeklyHours / workingDays;
  let total = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (document.getElementById(DAY_IDS[d.getDay()])?.checked && !nswHolidays.includes(d.toISOString().split('T')[0])) total += daily;
  }
  const type = document.getElementById('whatifType')?.value || 'annual';
  const typeLabel = type === 'lsl' ? 'LSL' : type === 'personal' ? 'Personal' : 'Annual';
  const resId = type === 'lsl' ? 'resLSL' : type === 'personal' ? 'resPersonal' : 'resAnnual';
  const res = document.getElementById(resId);
  const currentVal = res && res.innerText !== '—' ? Number(res.innerText) : null;
  const remaining = type === 'lsl'
    ? Math.max(0, (currentVal !== null ? currentVal : 0) - total / weeklyHours)
    : Math.max(0, (currentVal !== null ? currentVal : 0) - total);
  const unit = type === 'lsl' ? 'weeks' : 'hrs';
  el.innerHTML = `${typeLabel} leave taken: <b>${total.toFixed(1)} hrs</b> (${(total / daily).toFixed(1)} days).<br>Estimated remaining ${typeLabel.toLowerCase()} balance: <b>${remaining.toFixed(type === 'lsl' ? 3 : 2)}</b> ${unit}.`;
}
function fmtDate(d) { return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }); }

function optimizeLeave() {
  const resultsDiv = document.getElementById('optimizationResults');
  resultsDiv.innerHTML = 'Analyzing...';
  if (nswHolidays.length === 0) return;
  const tips = [];
  const today = new Date();
  const endDate = parseDropdownDate('opt');
  const hData = nswHolidays.map(h => new Date(h)).sort((a, b) => a - b);
  const addDay = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };

  hData.forEach(h => {
    if (h < today || h > endDate) return;
    const day = h.getDay();
    const dateStr = fmtDate(h);
    if (day === 2) {
      const mon = addDay(h, -1);
      tips.push({ title: `Long Weekend Hack: ${dateStr}`, desc: `Take Monday ${fmtDate(mon)} off for a 4-day weekend.`, mult: '4 days off for 1 day leave' });
    }
    if (day === 4) {
      const fri = addDay(h, 1);
      tips.push({ title: `Long Weekend Hack: ${dateStr}`, desc: `Take Friday ${fmtDate(fri)} off for a 4-day weekend.`, mult: '4 days off for 1 day leave' });
    }
    if (day === 3) {
      const mon = addDay(h, -2), tue = addDay(h, -1);
      const thu = addDay(h, 1), fri = addDay(h, 2);
      tips.push({ title: `Mid-week Win: ${dateStr}`, desc: `Take Mon ${fmtDate(mon)} + Tue ${fmtDate(tue)} OR Thu ${fmtDate(thu)} + Fri ${fmtDate(fri)} off for a 5-day break.`, mult: '5 days off for 2 days leave' });
    }
    if (day === 5 && (h.getMonth() === 2 || h.getMonth() === 3)) {
      const em = addDay(h, 3);
      tips.push({ title: `Easter Mega-Break: ${dateStr}`, desc: `Take the 4 days after Easter Monday ${fmtDate(em)} off.`, mult: '10 days off for 4 days leave' });
    }
    if (h.getMonth() === 11 && h.getDate() === 25) {
      tips.push({ title: 'End of Year Reset', desc: `Take the 3 days between Boxing Day ${fmtDate(addDay(h, 1))} and New Year's Day ${fmtDate(addDay(h, 7))} off.`, mult: '10 days off for 3 days leave' });
    }
  });

  const uniqueTips = Array.from(new Set(tips.map(a => JSON.stringify(a)))).map(a => JSON.parse(a));
  resultsDiv.innerHTML = uniqueTips.length > 0
    ? uniqueTips.map(t => `<div class="opt-item"><span class="opt-tag">${t.title}</span><br>${t.desc}<br><small style="color:#28a745;"><b>${t.mult}</b></small></div>`).join('')
    : 'No high-value clusters found in this period.';
}

function collectAllData() {
  const hireDate = parseDropdownDate('hire');
  const balanceDate = parseDropdownDate('balance');
  const projectDate = parseDropdownDate('project');
  const targetLastDay = parseDropdownDate('target');
  return {
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    hireDate: hireDate ? hireDate.toISOString() : null,
    calcMode: document.getElementById('calcMode')?.value || 'startDate',
    weeklyHours: document.getElementById('weeklyHours')?.value || 38,
    balanceDate: balanceDate ? balanceDate.toISOString() : null,
    startBalance: document.getElementById('startBalance')?.value || 0,
    roster: DAY_IDS.map(id => !!document.getElementById(id)?.checked),
    history: Array.from(document.querySelectorAll('.history-item')).map(item => ({
      id: item.dataset.id,
      note: item.querySelector('.note-text').innerText,
      amount: Number(item.dataset.amount),
      type: item.dataset.type,
      startDate: item.dataset.start || '',
      endDate: item.dataset.end || ''
    })),
    casualLoading: !!document.getElementById('casualLoading')?.checked,
    enableProjectDate: !!document.getElementById('enableProjectDate')?.checked,
    projectDate: projectDate ? projectDate.toISOString() : null,
    resignationMode: !!document.getElementById('resignationMode')?.checked,
    targetLastDay: targetLastDay ? targetLastDay.toISOString() : null,
    noticeWeeks: Number(document.getElementById('noticeWeeks')?.value || 0),
    acceptedNoticeDays: Number(document.getElementById('acceptedNoticeDays')?.value || 0),
    hourlyRate: Number(document.getElementById('hourlyRate')?.value || 0),
    superRate: Number(document.getElementById('superRate')?.value || 11.5),
    leaveLoading: Number(document.getElementById('leaveLoading')?.value || 0),
    holidays: nswHolidays
  };
}

function exportData() {
  const data = collectAllData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nsw-leave-tracker-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.exportVersion) { alert('Invalid import file.'); return; }
        applyImportedData(data);
        alert('Import successful! Your data has been restored.');
      } catch {
        alert('Invalid import file.');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

function applyImportedData(data) {
  setDropdownDate('hire', data.hireDate);
  setDropdownDate('balance', data.balanceDate);
  setDropdownDate('project', data.projectDate);
  setDropdownDate('target', data.targetLastDay);
  if (document.getElementById('calcMode')) document.getElementById('calcMode').value = data.calcMode || 'startDate';
  if (document.getElementById('weeklyHours')) document.getElementById('weeklyHours').value = data.weeklyHours || 38;
  if (document.getElementById('startBalance')) document.getElementById('startBalance').value = data.startBalance || 0;
  DAY_IDS.forEach((id, i) => { const el = document.getElementById(id); if (el) el.checked = !!data.roster?.[i]; });
  if (document.getElementById('casualLoading')) document.getElementById('casualLoading').checked = !!data.casualLoading;
  if (document.getElementById('enableProjectDate')) document.getElementById('enableProjectDate').checked = !!data.enableProjectDate;
  if (document.getElementById('resignationMode')) document.getElementById('resignationMode').checked = !!data.resignationMode;
  if (document.getElementById('noticeWeeks')) document.getElementById('noticeWeeks').value = data.noticeWeeks ?? 2;
  if (document.getElementById('acceptedNoticeDays')) document.getElementById('acceptedNoticeDays').value = data.acceptedNoticeDays ?? 0;
  if (document.getElementById('hourlyRate')) document.getElementById('hourlyRate').value = data.hourlyRate ?? 35;
  if (document.getElementById('superRate')) document.getElementById('superRate').value = data.superRate ?? 11.5;
  if (document.getElementById('leaveLoading')) document.getElementById('leaveLoading').value = data.leaveLoading ?? 0;
  document.getElementById('historyList').innerHTML = '';
  if (data.history) data.history.forEach(h => appendHistoryDOM(h));
  if (data.holidays) { nswHolidays = data.holidays; if (db) db.transaction('userData', 'readwrite').objectStore('userData').put(nswHolidays, 'holidays'); }
  toggleMode();
  scheduleRecalculate();
  saveToDB();
}

function initCollapsibleSections() {
  document.querySelectorAll('.card').forEach(card => {
    const title = card.querySelector('.section-title');
    if (!title) return;
    const body = document.createElement('div');
    let el = title.nextElementSibling;
    while (el) {
      const next = el.nextElementSibling;
      body.appendChild(el);
      el = next;
    }
    card.appendChild(body);
    body.style.display = 'none';
    title.addEventListener('click', () => {
      const open = title.classList.toggle('open');
      body.style.display = open ? '' : 'none';
    });
  });
}

function initializeUI() {
  const curYear = new Date().getFullYear();
  populateDropdowns('hire', 1995, curYear + 1);
  populateDropdowns('balance', 1995, curYear + 1);
  populateDropdowns('leaveStart', curYear - 1, curYear + 2);
  populateDropdowns('leaveEnd', curYear - 1, curYear + 2);
  populateDropdowns('opt', curYear, curYear + 2);
  populateDropdowns('target', curYear, curYear + 2);
  populateDropdowns('project', curYear, curYear + 2);
  populateDropdowns('whatifStart', curYear - 1, curYear + 2);
  populateDropdowns('whatifEnd', curYear - 1, curYear + 2);
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
  initCollapsibleSections();
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