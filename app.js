let nswHolidays = [];
let db;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const dbRequest = indexedDB.open("NSWLeaveTracker", 2);

dbRequest.onsuccess = (e) => {
    db = e.target.result;
    initApp();
};

function initApp() {
    // Setup all 4 date picker instances
    ["hire", "bal", "opt", "resig"].forEach(p => setupDropdowns(p));
    
    // Set default values for near-future pickers
    const today = new Date();
    setDropdownDate("resig", today);
    setDropdownDate("opt", new Date(today.getFullYear() + 1, 11, 31));

    document.querySelectorAll('.chip input').forEach(input => {
        input.addEventListener('change', calculateLeave);
    });

    syncHolidays();
    loadFromDB();
}

function setupDropdowns(prefix) {
    const dSel = document.getElementById(prefix + "Day");
    const mSel = document.getElementById(prefix + "Month");
    const ySel = document.getElementById(prefix + "Year");
    const currentYear = new Date().getFullYear();

    for (let i = 1; i <= 31; i++) dSel.add(new Option(i, i));
    MONTHS.forEach((m, idx) => mSel.add(new Option(m, idx)));
    for (let i = currentYear + 10; i >= currentYear - 40; i--) ySel.add(new Option(i, i));
}

function setDropdownDate(prefix, date) {
    document.getElementById(prefix + "Day").value = date.getDate();
    document.getElementById(prefix + "Month").value = date.getMonth();
    document.getElementById(prefix + "Year").value = date.getFullYear();
    syncDate(prefix);
}

function syncDate(prefix) {
    const d = parseInt(document.getElementById(prefix + "Day").value);
    const m = parseInt(document.getElementById(prefix + "Month").value);
    const y = parseInt(document.getElementById(prefix + "Year").value);
    
    // Auto-correct invalid dates (e.g. 31 Feb -> 28/29 Feb)
    const validDate = new Date(y, m, d);
    if (validDate.getMonth() !== m) {
        const lastDay = new Date(y, m + 1, 0).getDate();
        document.getElementById(prefix + "Day").value = lastDay;
        document.getElementById(prefix + "Date").value = `${y}-${String(m+1).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
    } else {
        document.getElementById(prefix + "Date").value = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    }
    
    calculateLeave();
}

async function syncHolidays() {
    // Holiday logic as per previous version...
    calculateLeave();
}

function getWorkingDaysCount() {
    let count = 0;
    for (let i = 0; i < 7; i++) { if (document.getElementById(`day-${i}`).checked) count++; }
    return count || 5; 
}

function calculateLeave() {
    const mode = document.getElementById('calcMode').value;
    const hireDateStr = document.getElementById('hireDate').value;
    const weeklyHours = parseFloat(document.getElementById('weeklyHours').value) || 38;
    const hoursPerDay = weeklyHours / getWorkingDaysCount();
    const today = new Date();
    
    if (!hireDateStr) return;
    const hireDate = new Date(hireDateStr);
    let serviceWeeks = (today - hireDate) / (604800000);
    let totalHrs = 0;

    if (mode === 'startDate') {
        totalHrs = serviceWeeks * (4 / 52) * weeklyHours;
    } else {
        const bDateStr = document.getElementById('balanceDate').value;
        const startBal = parseFloat(document.getElementById('startBalance').value) || 0;
        if (bDateStr) {
            const weeksSince = (today - new Date(bDateStr)) / (604800000);
            totalHrs = startBal + (weeksSince * (4 / 52) * weeklyHours);
        }
    }

    document.getElementById('resAnnual').innerText = totalHrs.toFixed(2);
    document.getElementById('resDays').innerText = (totalHrs / hoursPerDay).toFixed(1);
    document.getElementById('resLSL').innerText = Math.max(0, (serviceWeeks / 52) * 0.8667).toFixed(3);
    
    saveToDB();
    calculateResignation();
    optimizeLeave();
}

function calculateResignation() {
    const rate = parseFloat(document.getElementById('hourlyRate').value) || 0;
    const curBal = parseFloat(document.getElementById('resAnnual').innerText) || 0;
    const exitDateStr = document.getElementById('resigDate').value;
    const weeklyHours = parseFloat(document.getElementById('weeklyHours').value) || 38;
    
    if (rate <= 0 || !exitDateStr) return;
    const weeksToExit = Math.max(0, (new Date(exitDateStr) - new Date()) / 604800000);
    const payout = (curBal + (weeksToExit * (weeklyHours * (4/52)))) * rate;

    document.getElementById('resignationResults').innerHTML = `
        <div class="opt-item" style="border-color: #007AFF; background: #f0f7ff;">
            <strong>Est. Payout: $${payout.toLocaleString(undefined, {minimumFractionDigits:2})}</strong>
        </div>`;
}

function optimizeLeave() {
    // Optimization logic as per previous version...
}

function toggleMode() {
    document.getElementById('balanceSection').style.display = document.getElementById('calcMode').value === 'knownBalance' ? 'block' : 'none';
}

function saveToDB() {
    if (!db) return;
    const roster = [];
    for (let i = 0; i < 7; i++) { roster.push(document.getElementById(`day-${i}`).checked); }
    const profile = {
        hireD: document.getElementById('hireDay').value,
        hireM: document.getElementById('hireMonth').value,
        hireY: document.getElementById('hireYear').value,
        weeklyHours: document.getElementById('weeklyHours').value,
        hourlyRate: document.getElementById('hourlyRate').value,
        roster: roster
    };
    db.transaction("userData", "readwrite").objectStore("userData").put(profile, "profile");
}

function loadFromDB() {
    db.transaction("userData", "readonly").objectStore("userData").get("profile").onsuccess = (e) => {
        const d = e.target.result; if (!d) return;
        document.getElementById('hireDay').value = d.hireD;
        document.getElementById('hireMonth').value = d.hireM;
        document.getElementById('hireYear').value = d.hireY;
        document.getElementById('weeklyHours').value = d.weeklyHours;
        document.getElementById('hourlyRate').value = d.hourlyRate;
        if (d.roster) d.roster.forEach((c, i) => document.getElementById(`day-${i}`).checked = c);
        syncDate('hire');
    };
}
