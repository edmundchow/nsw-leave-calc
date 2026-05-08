// 1. GLOBAL VARIABLES (RETAINED)
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
let nswHolidays = [];
let db;

// 2. CORE UTILITY FUNCTIONS (RETAINED)
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
    document.getElementById(prefix + 'Day').value = date.getDate();
    document.getElementById(prefix + 'Month').value = date.getMonth();
    document.getElementById(prefix + 'Year').value = date.getFullYear();
}

// 3. HOLIDAY FETCHING (RETAINED & EXPANDED FALLBACK)
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
        nswHolidays = [
            "2026-01-01", "2026-01-26", "2026-04-03", "2026-04-06", "2026-04-25", "2026-06-08", "2026-10-05", "2026-12-25", "2026-12-28",
            "2027-01-01", "2027-01-26", "2027-03-26", "2027-03-29", "2027-04-26", "2027-06-14", "2027-10-04", "2027-12-25", "2027-12-27", "2027-12-28"
        ];
    }
    calculateLeave();
}

// 4. DATABASE & INITIALIZATION (RETAINED + NEW PHASE 2 DROPDOWNS)
const dbRequest = indexedDB.open("NSWLeaveTracker", 1);
dbRequest.onupgradeneeded = (e) => e.target.result.createObjectStore("userData");
dbRequest.onsuccess = (e) => {
    db = e.target.result;
    const curYear = new Date().getFullYear();
    
    populateDropdowns('hire', 1995, curYear + 1);
    populateDropdowns('balance', 1995, curYear + 1);
    populateDropdowns('leaveStart', curYear - 1, curYear + 2);
    populateDropdowns('leaveEnd', curYear - 1, curYear + 2);
    populateDropdowns('opt', curYear, curYear + 2);
    
    // NEW Phase 2 Dropdowns
    populateDropdowns('resig', curYear, curYear + 2);

    document.getElementById('optDay').value = 31;
    document.getElementById('optMonth').value = 11;
    document.getElementById('optYear').value = curYear + 1;

    fetchHolidays();
    loadFromDB();
};

// 5. PHASE 2: RESIGNATION LOGIC (NEWLY INTEGRATED)
function calculateResignation() {
    const rate = parseFloat(document.getElementById('hourlyRate').value) || 0;
    const weeklyHours = parseFloat(document.getElementById('weeklyHours').value) || 38;
    const annualBalance = parseFloat(document.getElementById('resAnnual').innerText) || 0;
    
    if (rate <= 0 || annualBalance <= 0) {
        document.getElementById('resignationResults').innerHTML = `<p style="color:red;">Please enter a rate and ensure you have a leave balance.</p>`;
        return;
    }

    // Lump Sum Payout (No Super)
    const payoutGross = annualBalance * rate;
    const superLost = payoutGross * 0.115; 

    // Run-Down (Taking Leave in Service)
    const weeksOfLeave = annualBalance / weeklyHours;
    const bonusAccrualHours = weeksOfLeave * (weeklyHours * (4 / 52)); 
    const bonusValue = bonusAccrualHours * rate;
    const totalAdvantage = superLost + bonusValue;

    document.getElementById('resignationResults').innerHTML = `
        <div style="background:#fff3f3; border:1px solid #dc3545; padding:15px; border-radius:8px; margin-top:10px;">
            <strong style="color:#dc3545;">Exit Strategy Analysis</strong>
            <p>💰 <b>Lump Sum Cash:</b> $${payoutGross.toLocaleString()}</p>
            <p>⚠️ <b>Super Lost on Payout:</b> -$${superLost.toFixed(2)}</p>
            <p>🎁 <b>Extra Leave Accrued if Taken:</b> +${bonusAccrualHours.toFixed(2)} hrs ($${bonusValue.toFixed(2)})</p>
            <hr>
            <p style="font-size:1.1em; color:#28a745;"><b>Total "Take Leave" Advantage: +$${totalAdvantage.toLocaleString()}</b></p>
        </div>`;
}

// 6. STORAGE & CALCULATION (RETAINED)
function toggleMode() {
    const mode = document.getElementById('calcMode').value;
    document.getElementById('balanceSection').style.display = mode === 'knownBalance' ? 'block' : 'none';
    calculateLeave(); saveToDB();
}

function saveToDB() {
    if (!db) return;
    const profile = {
        hireDate: getDropdownDate('hire').toISOString(),
        calcMode: document.getElementById('calcMode').value,
        weeklyHours: document.getElementById('weeklyHours').value,
        balanceDate: getDropdownDate('balance').toISOString(),
        startBalance: document.getElementById('startBalance').value,
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
        const ids = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        if (d.roster) d.roster.forEach((c, i) => document.getElementById(ids[i]).checked = c);
        if (d.history) { document.getElementById('historyList').innerHTML = ''; d.history.forEach(appendHistoryDOM); }
        toggleMode();
    };
}

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
        annualAccrued = parseFloat(document.getElementById('startBalance').value) + (weeksSince * (4 / 52) * weeklyHours);
    }

    const taken = Array.from(document.querySelectorAll('.history-item')).reduce((s, el) => s + parseFloat(el.dataset.amount), 0);
    const finalHours = Math.max(0, annualAccrued - taken);
    const hrsPerDay = weeklyHours / 5;

    document.getElementById('resAnnual').innerText = finalHours.toFixed(2);
    document.getElementById('resDays').innerText = (finalHours / hrsPerDay).toFixed(1);
    document.getElementById('resLSL').innerText = Math.max(0, (serviceWeeksTotal / 52) * 0.8667).toFixed(3);
}

// 7. LEAVE HISTORY & OPTIMIZER (RETAINED)
function addHistoryEntry() {
    const start = getDropdownDate('leaveStart');
    const end = getDropdownDate('leaveEnd');
    const weeklyHours = parseFloat(document.getElementById('weeklyHours').value) || 38;
    const daily = weeklyHours / 5;
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
    const endDate = getDropdownDate('opt');
    const hData = nswHolidays.map(h => new Date(h)).sort((a,b) => a-b);
    hData.forEach(h => {
        if (h < today || h > endDate) return;
        const day = h.getDay();
        const dateStr = h.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
        if (day === 2) tips.push({ title: `Long Weekend Hack: ${dateStr}`, desc: `Take Monday off`, mult: "4 days off for 1 day leave" });
        if (day === 4) tips.push({ title: `Long Weekend Hack: ${dateStr}`, desc: `Take Friday off`, mult: "4 days off for 1 day leave" });
        if (day === 3) tips.push({ title: `Mid-week Win: ${dateStr}`, desc: `Take Mon+Tue OR Thu+Fri`, mult: "5 days off for 2 days leave" });
        if (day === 5 && (h.getMonth() === 2 || h.getMonth() === 3)) tips.push({ title: `Easter Mega-Break`, desc: `Take 4 days after Easter Monday`, mult: "10 days off for 4 days leave" });
        if (h.getMonth() === 11 && h.getDate() === 25) tips.push({ title: `End of Year Reset`, desc: `Take 3 days between Boxing Day and NYE`, mult: "10 days off for 3 days leave" });
    });
    const uniqueTips = Array.from(new Set(tips.map(a => JSON.stringify(a)))).map(a => JSON.parse(a));
    resultsDiv.innerHTML = uniqueTips.length > 0 ? uniqueTips.map(t => `<div class="opt-item"><span class="opt-tag">${t.title}</span><br>${t.desc}<br><small style="color:#28a745;"><b>${t.mult}</b></small></div>`).join('') : "No clusters found.";
}
