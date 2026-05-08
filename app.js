/**
 * NSW Leave Calculator - Core Logic
 * Fixed: Resignation Strategy now calculates projected accrual based on Target Last Day
 */

// 1. GLOBAL VARIABLES
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
let nswHolidays = [];
let db;

// 2. DROP-DOWN UTILITIES
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

function getDropdownDate(prefix) {
    const d = document.getElementById(prefix + 'Day').value;
    const m = document.getElementById(prefix + 'Month').value;
    const y = document.getElementById(prefix + 'Year').value;
    return new Date(y, m, d);
}

function setDropdownDate(prefix, dateStr) {
    if (!dateStr) return;
    const date = new Date(dateStr);
    const dEl = document.getElementById(prefix + 'Day');
    const mEl = document.getElementById(prefix + 'Month');
    const yEl = document.getElementById(prefix + 'Year');
    if (dEl) dEl.value = date.getDate();
    if (mEl) mEl.value = date.getMonth();
    if (yEl) yEl.value = date.getFullYear();
}

// 3. HOLIDAY DATA
async function fetchHolidays() {
    try {
        const apiUrl = 'https://data.gov.au/data/api/3/action/datastore_search?resource_id=d256f282-ba27-4c64-ade7-0d7ad2530554&limit=1000';
        const response = await fetch(apiUrl);
        const data = await response.json();
        nswHolidays = data.result.records
            .filter(r => r.Jurisdiction && r.Jurisdiction.toLowerCase() === 'nsw')
            .map(r => { 
                const d = r.Date.toString(); 
                return `${d.substring(0,4)}-${d.substring(4,6)}-${d.substring(6,8)}`; 
            });
    } catch (e) {
        nswHolidays = ["2026-01-01", "2026-01-26", "2026-04-03", "2026-04-06", "2026-04-25", "2026-06-08", "2026-10-05", "2026-12-25", "2026-12-28"];
    }
    calculateLeave();
}

// 4. DATABASE & INITIALIZATION
const dbRequest = indexedDB.open("NSWLeaveTracker", 1);
dbRequest.onupgradeneeded = (e) => e.target.result.createObjectStore("userData");

dbRequest.onsuccess = (e) => {
    db = e.target.result;
    const today = new Date();
    const curYear = today.getFullYear();
    
    populateDropdowns('hire', 1995, curYear + 1);
    populateDropdowns('balance', 1995, curYear + 1);
    populateDropdowns('leaveStart', curYear - 1, curYear + 2);
    populateDropdowns('leaveEnd', curYear - 1, curYear + 2);
    populateDropdowns('opt', curYear, curYear + 2);
    populateDropdowns('resig', curYear, curYear + 2); 

    setDropdownDate('resig', today.toISOString());
    document.getElementById('optDay').value = 31;
    document.getElementById('optMonth').value = 11;
    document.getElementById('optYear').value = curYear + 1;

    fetchHolidays();
    loadFromDB();
};

// 5. CORE ACCRUAL
function calculateLeave() {
    const mode = document.getElementById('calcMode').value;
    const hireDate = getDropdownDate('hire');
    const weeklyHours = parseFloat(document.getElementById('weeklyHours').value) || 38;
    const today = new Date();
    
    let serviceWeeksTotal = (today - hireDate) / (1000 * 60 * 60 * 24 * 7);
    let annualAccrued = 0;

    if (mode === 'startDate') {
        annualAccrued = serviceWeeksTotal * (4 / 52) * weeklyHours;
    } else {
        const bDate = getDropdownDate('balance');
        const weeksSince = (today - bDate) / (1000 * 60 * 60 * 24 * 7);
        const startBal = parseFloat(document.getElementById('startBalance').value) || 0;
        annualAccrued = startBal + (weeksSince * (4 / 52) * weeklyHours);
    }

    const taken = Array.from(document.querySelectorAll('.history-item')).reduce((s, el) => s + parseFloat(el.dataset.amount), 0);
    const finalHours = Math.max(0, annualAccrued - taken);
    const hrsPerDay = weeklyHours / 5;

    document.getElementById('resAnnual').innerText = finalHours.toFixed(2);
    document.getElementById('resDays').innerText = (finalHours / hrsPerDay).toFixed(1);
    document.getElementById('resLSL').innerText = Math.max(0, (serviceWeeksTotal / 52) * 0.8667).toFixed(3);
}

// 6. FIXED RESIGNATION STRATEGY
function calculateResignation() {
    const rate = parseFloat(document.getElementById('hourlyRate').value) || 0;
    const weeklyHours = parseFloat(document.getElementById('weeklyHours').value) || 38;
    const currentBalance = parseFloat(document.getElementById('resAnnual').innerText) || 0;
    const targetLastDay = getDropdownDate('resig');
    const today = new Date();
    
    if (rate <= 0 || currentBalance <= 0) {
        document.getElementById('resignationResults').innerHTML = `<p style="color:red;">Enter rate and check balance.</p>`;
        return;
    }

    // A: Calculate Accrual between TODAY and TARGET LAST DAY
    let weeksUntilExit = (targetLastDay - today) / (1000 * 60 * 60 * 24 * 7);
    if (weeksUntilExit < 0) weeksUntilExit = 0; // If date is in the past
    
    const projectedAccrual = weeksUntilExit * (weeklyHours * (4 / 52));
    const balanceAtExit = currentBalance + projectedAccrual;

    // B: Scenario 1 - Payout at Exit
    const payoutGross = balanceAtExit * rate;
    const superLost = payoutGross * 0.115; 

    // C: Scenario 2 - Run-Down starting from Exit
    const weeksToRunDown = balanceAtExit / weeklyHours;
    const bonusAccrualHours = weeksToRunDown * (weeklyHours * (4 / 52));
    const bonusValue = bonusAccrualHours * rate;
    
    const totalAdvantage = superLost + bonusValue;

    document.getElementById('resignationResults').innerHTML = `
        <div style="background:#f0f7ff; border:1px solid #007bff; padding:15px; border-radius:8px; margin-top:10px;">
            <strong style="color:#007bff;">Exit Strategy: ${targetLastDay.toLocaleDateString('en-AU')}</strong>
            <p>📈 <b>Projected Accrual to Exit:</b> +${projectedAccrual.toFixed(2)} hrs</p>
            <p>💰 <b>Est. Payout at Exit:</b> $${payoutGross.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
            <p>⚠️ <b>Super Lost if Paid Out:</b> <span style="color:#dc3545;">-$${superLost.toFixed(2)}</span></p>
            <p>🎁 <b>Extra Accrual (Run-down):</b> +${bonusAccrualHours.toFixed(2)} hrs ($${bonusValue.toFixed(2)})</p>
            <hr>
            <p style="font-size:1.1em; color:#28a745;"><b>Total Strategy Benefit: +$${totalAdvantage.toLocaleString()}</b></p>
            <small style="color:#666;">This is the extra value gained by taking leave after your last day instead of a cash payout.</small>
        </div>`;
}

// 7. DATA PERSISTENCE
function toggleMode() {
    const mode = document.getElementById('calcMode').value;
    const section = document.getElementById('balanceSection');
    if (section) section.style.display = mode === 'knownBalance' ? 'block' : 'none';
    calculateLeave(); 
    saveToDB();
}

function saveToDB() {
    if (!db) return;
    const profile = {
        hireDate: getDropdownDate('hire').toISOString(),
        calcMode: document.getElementById('calcMode').value,
        weeklyHours: document.getElementById('weeklyHours').value,
        balanceDate: getDropdownDate('balance').toISOString(),
        startBalance: document.getElementById('startBalance').value,
        hourlyRate: document.getElementById('hourlyRate').value,
        roster: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map(id => document.getElementById(id).checked),
        history: Array.from(document.querySelectorAll('.history-item')).map(item => ({
            id: item.dataset.id, note: item.querySelector('.note-text').innerText, amount: parseFloat(item.dataset.amount)
        }))
    };
    db.transaction("userData", "readwrite").objectStore("userData").put(profile, "profile");
}

function loadFromDB() {
    db.transaction("userData", "readonly").objectStore("userData").get("profile").onsuccess = (e) => {
        const d = e.target.result; if (!d) return;
        setDropdownDate('hire', d.hireDate);
        setDropdownDate('balance', d.balanceDate);
        document.getElementById('calcMode').value = d.calcMode || 'startDate';
        document.getElementById('weeklyHours').value = d.weeklyHours || 38;
        document.getElementById('startBalance').value = d.startBalance || 0;
        if (d.hourlyRate) document.getElementById('hourlyRate').value = d.hourlyRate;
        const ids = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        if (d.roster) d.roster.forEach((c, i) => document.getElementById(ids[i]).checked = c);
        if (d.history) { document.getElementById('historyList').innerHTML = ''; d.history.forEach(appendHistoryDOM); }
        toggleMode();
    };
}

// 8. HISTORY & OPTIMIZER (Simplified for brevity)
function addHistoryEntry() {
    const start = getDropdownDate('leaveStart');
    const end = getDropdownDate('leaveEnd');
    const daily = (parseFloat(document.getElementById('weeklyHours').value) || 38) / 5;
    const ids = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    let total = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        if (document.getElementById(ids[d.getDay()]).checked && !nswHolidays.includes(d.toISOString().split('T')[0])) total += daily;
    }
    appendHistoryDOM({ id: Date.now(), note: document.getElementById('leaveNote').value || "Leave", amount: total });
    saveToDB(); calculateLeave();
}

function appendHistoryDOM(h) {
    const div = document.createElement('div');
    div.className = 'history-item'; div.dataset.id = h.id; div.dataset.amount = h.amount;
    div.innerHTML = `<span class="note-text">${h.note} (${h.amount.toFixed(1)} hrs)</span><button class="btn-del" onclick="this.parentElement.remove(); saveToDB(); calculateLeave();">Delete</button>`;
    document.getElementById('historyList').appendChild(div);
}

function optimizeLeave() {
    const resultsDiv = document.getElementById('optimizationResults');
    resultsDiv.innerHTML = 'Analyzing...';
    if (nswHolidays.length === 0) return;
    const tips = [];
    const today = new Date();
    const hData = nswHolidays.map(h => new Date(h)).sort((a,b) => a-b);
    hData.forEach(h => {
        if (h < today) return;
        const day = h.getDay();
        const dStr = h.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
        if (day === 2 || day === 4) tips.push({ title: `Bridge: ${dStr}`, desc: `Take a bridge day for 4 days off.`, mult: "4 for 1" });
    });
    resultsDiv.innerHTML = tips.map(t => `<div class="opt-item"><span class="opt-tag">${t.title}</span><br>${t.desc}</div>`).join('') || "No clusters found.";
}
