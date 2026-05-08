/**
 * NSW Leave Calculator - Core Logic
 * Integrated: IndexedDB Holiday Caching, Fixed Resignation Strategy, & Smart Optimizer
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

// 3. SMART HOLIDAY SYNC (Local-First)
async function syncHolidays() {
    // 1. Load from cache immediately for speed
    const tx = db.transaction("holidayData", "readonly");
    const store = tx.objectStore("holidayData");
    const getRequest = store.get("nsw_list");

    getRequest.onsuccess = () => {
        if (getRequest.result) {
            nswHolidays = getRequest.result;
            calculateLeave();
        }
        // 2. Try to update from API in the background
        attemptNetworkFetch();
    };
}

async function attemptNetworkFetch() {
    try {
        const apiUrl = 'https://data.gov.au/data/api/3/action/datastore_search?resource_id=d256f282-ba27-4c64-ade7-0d7ad2530554&limit=1000';
        const response = await fetch(apiUrl);
        const data = await response.json();
        
        const freshHolidays = data.result.records
            .filter(r => r.Jurisdiction && r.Jurisdiction.toLowerCase() === 'nsw')
            .map(r => { 
                const d = r.Date.toString(); 
                return `${d.substring(0,4)}-${d.substring(4,6)}-${d.substring(6,8)}`; 
            });

        if (freshHolidays.length > 0) {
            nswHolidays = freshHolidays;
            const tx = db.transaction("holidayData", "readwrite");
            tx.objectStore("holidayData").put(freshHolidays, "nsw_list");
            calculateLeave();
        }
    } catch (e) {
        console.warn("Using offline holiday cache.");
    }
}

// 4. DATABASE & INITIALIZATION
const dbRequest = indexedDB.open("NSWLeaveTracker", 2); // Version 2 for new Store

dbRequest.onupgradeneeded = (e) => {
    const database = e.target.result;
    if (!database.objectStoreNames.contains("userData")) database.createObjectStore("userData");
    if (!database.objectStoreNames.contains("holidayData")) database.createObjectStore("holidayData");
};

dbRequest.onsuccess = (e) => {
    db = e.target.result;
    const today = new Date();
    const curYear = today.getFullYear();
    
    populateDropdowns('hire', 1995, curYear + 1);
    populateDropdowns('balance', 1995, curYear + 1);
    populateDropdowns('leaveStart', curYear - 1, curYear + 3);
    populateDropdowns('leaveEnd', curYear - 1, curYear + 3);
    populateDropdowns('opt', curYear, curYear + 3);
    populateDropdowns('resig', curYear, curYear + 3); 

    setDropdownDate('resig', today.toISOString());
    document.getElementById('optDay').value = 31;
    document.getElementById('optMonth').value = 11;
    document.getElementById('optYear').value = curYear + 1;

    syncHolidays();
    loadFromDB();
};

// 5. CORE CALCULATION
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

// 6. RESIGNATION STRATEGY (Fixed for Target Date)
function calculateResignation() {
    const rate = parseFloat(document.getElementById('hourlyRate').value) || 0;
    const weeklyHours = parseFloat(document.getElementById('weeklyHours').value) || 38;
    const currentBalance = parseFloat(document.getElementById('resAnnual').innerText) || 0;
    const targetLastDay = getDropdownDate('resig');
    const today = new Date();
    
    if (rate <= 0) {
        document.getElementById('resignationResults').innerHTML = `<p style="color:red;">Enter hourly rate first.</p>`;
        return;
    }

    let weeksUntilExit = (targetLastDay - today) / (1000 * 60 * 60 * 24 * 7);
    if (weeksUntilExit < 0) weeksUntilExit = 0;
    
    const projectedAccrual = weeksUntilExit * (weeklyHours * (4 / 52));
    const balanceAtExit = currentBalance + projectedAccrual;

    const payoutGross = balanceAtExit * rate;
    const superLost = payoutGross * 0.115; 
    const weeksToRunDown = balanceAtExit / weeklyHours;
    const bonusAccrualHours = weeksToRunDown * (weeklyHours * (4 / 52));
    const bonusValue = bonusAccrualHours * rate;
    
    const totalAdvantage = superLost + bonusValue;

    document.getElementById('resignationResults').innerHTML = `
        <div style="background:#f0f7ff; border:1px solid #007bff; padding:15px; border-radius:8px;">
            <strong style="color:#007bff;">Exit Strategy: ${targetLastDay.toLocaleDateString('en-AU')}</strong>
            <p>📈 <b>Accrual to Exit:</b> +${projectedAccrual.toFixed(2)} hrs</p>
            <p>💰 <b>Est. Payout:</b> $${payoutGross.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
            <p>⚠️ <b>Super Lost (if paid out):</b> -$${superLost.toFixed(2)}</p>
            <p>🎁 <b>Bonus if taken as leave:</b> +${bonusAccrualHours.toFixed(2)} hrs ($${bonusValue.toFixed(2)})</p>
            <hr>
            <p style="font-size:1.1em; color:#28a745;"><b>Total "Run-Down" Gain: +$${totalAdvantage.toLocaleString()}</b></p>
        </div>`;
}

// 7. LEAVE OPTIMIZER (Smarter Logic)
function optimizeLeave() {
    const resultsDiv = document.getElementById('optimizationResults');
    resultsDiv.innerHTML = 'Analyzing holidays...';
    
    if (nswHolidays.length === 0) {
        resultsDiv.innerHTML = "Syncing holidays... try again in a moment.";
        return;
    }

    const tips = [];
    const today = new Date();
    const endDate = getDropdownDate('opt');
    const hData = nswHolidays.map(h => new Date(h)).sort((a,b) => a-b);

    hData.forEach(h => {
        if (h < today || h > endDate) return;
        const day = h.getDay();
        const dStr = h.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });

        if (day === 2) tips.push({ title: `Bridge: ${dStr}`, desc: `Take Monday off for 4 days total.`, eff: "4-for-1" });
        else if (day === 4) tips.push({ title: `Bridge: ${dStr}`, desc: `Take Friday off for 4 days total.`, eff: "4-for-1" });
        else if (day === 3) tips.push({ title: `Mid-Week: ${dateStr}`, desc: `Take 2 days off for a 5-day break.`, eff: "5-for-2" });
        else if (day === 1 || day === 5) tips.push({ title: `Long Weekend: ${dStr}`, desc: `Standard 3-day break.`, eff: "Relax" });
    });

    resultsDiv.innerHTML = tips.map(t => `
        <div class="opt-item">
            <span class="opt-tag">${t.title}</span><br>${t.desc}<br><small><b>${t.eff}</b></small>
        </div>`).join('') || "No significant clusters found.";
}

// 8. PERSISTENCE & HISTORY
function toggleMode() {
    const mode = document.getElementById('calcMode').value;
    document.getElementById('balanceSection').style.display = mode === 'knownBalance' ? 'block' : 'none';
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
