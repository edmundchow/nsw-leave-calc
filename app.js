let nswHolidays = [];
let db;

const dbRequest = indexedDB.open("NSWLeaveTracker", 2);

dbRequest.onupgradeneeded = (e) => {
    const database = e.target.result;
    if (!database.objectStoreNames.contains("userData")) database.createObjectStore("userData");
    if (!database.objectStoreNames.contains("holidayData")) database.createObjectStore("holidayData");
};

dbRequest.onsuccess = (e) => {
    db = e.target.result;
    initApp();
};

function initApp() {
    setupDateDropdowns("hire");
    setupDateDropdowns("bal");
    
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('resigDate').value = today;
    document.getElementById('optDate').value = `${new Date().getFullYear() + 1}-12-31`;

    document.querySelectorAll('.chip input').forEach(input => {
        input.addEventListener('change', calculateLeave);
    });

    syncHolidays();
    loadFromDB();
}

// 1. DATE DROPDOWN GENERATOR
function setupDateDropdowns(prefix) {
    const yearSelect = document.getElementById(prefix + "Year");
    const daySelect = document.getElementById(prefix + "Day");
    const currentYear = new Date().getFullYear();

    // Generate years (40 years back to 5 years forward)
    for (let i = currentYear + 5; i >= currentYear - 40; i--) {
        const opt = document.createElement("option");
        opt.value = i; opt.text = i;
        yearSelect.add(opt);
    }
    yearSelect.value = currentYear;

    // Generate days 1-31
    for (let i = 1; i <= 31; i++) {
        const opt = document.createElement("option");
        opt.value = i; opt.text = i;
        daySelect.add(opt);
    }
}

function syncHireDate() {
    const y = document.getElementById("hireYear").value;
    const m = document.getElementById("hireMonth").value;
    const d = document.getElementById("hireDay").value;
    document.getElementById("hireDate").value = `${y}-${String(parseInt(m)+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    calculateLeave();
}

function syncBalDate() {
    const y = document.getElementById("balYear").value;
    const m = document.getElementById("balMonth").value;
    const d = document.getElementById("balDay").value;
    document.getElementById("balanceDate").value = `${y}-${String(parseInt(m)+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    calculateLeave();
}

// 2. HOLIDAY & CALC LOGIC
async function syncHolidays() {
    const curYear = new Date().getFullYear();
    nswHolidays = [`${curYear}-01-01`, `${curYear}-12-25` ]; // Simple fallback
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
        const weeksSince = (today - new Date(bDateStr)) / (604800000);
        totalHrs = startBal + (weeksSince * (4 / 52) * weeklyHours);
    }

    document.getElementById('resAnnual').innerText = totalHrs.toFixed(2);
    document.getElementById('resDays').innerText = (totalHrs / hoursPerDay).toFixed(1);
    document.getElementById('resLSL').innerText = Math.max(0, (serviceWeeks / 52) * 0.8667).toFixed(3);
    
    saveToDB();
    calculateResignation();
}

function calculateResignation() {
    const rate = parseFloat(document.getElementById('hourlyRate').value) || 0;
    const weeklyHours = parseFloat(document.getElementById('weeklyHours').value) || 38;
    const curBal = parseFloat(document.getElementById('resAnnual').innerText) || 0;
    const exitDateStr = document.getElementById('resigDate').value;
    
    if (rate <= 0 || !exitDateStr) return;
    const weeksToExit = Math.max(0, (new Date(exitDateStr) - new Date()) / 604800000);
    const payout = (curBal + (weeksToExit * (weeklyHours * (4/52)))) * rate;

    document.getElementById('resignationResults').innerHTML = `
        <div class="opt-item" style="border-color: #007AFF; background: #f0f7ff;">
            <strong>Est. Payout: $${payout.toLocaleString(undefined, {minimumFractionDigits:2})}</strong>
        </div>`;
}

function optimizeLeave() { /* Optimization Logic here... */ }

function toggleMode() {
    document.getElementById('balanceSection').style.display = document.getElementById('calcMode').value === 'knownBalance' ? 'block' : 'none';
}

function saveToDB() {
    if (!db) return;
    const roster = [];
    for (let i = 0; i < 7; i++) { roster.push(document.getElementById(`day-${i}`).checked); }
    const profile = {
        hireYear: document.getElementById('hireYear').value,
        hireMonth: document.getElementById('hireMonth').value,
        hireDay: document.getElementById('hireDay').value,
        weeklyHours: document.getElementById('weeklyHours').value,
        hourlyRate: document.getElementById('hourlyRate').value,
        roster: roster
    };
    db.transaction("userData", "readwrite").objectStore("userData").put(profile, "profile");
}

function loadFromDB() {
    db.transaction("userData", "readonly").objectStore("userData").get("profile").onsuccess = (e) => {
        const d = e.target.result; if (!d) return;
        document.getElementById('hireYear').value = d.hireYear;
        document.getElementById('hireMonth').value = d.hireMonth;
        document.getElementById('hireDay').value = d.hireDay;
        document.getElementById('weeklyHours').value = d.weeklyHours;
        document.getElementById('hourlyRate').value = d.hourlyRate;
        if (d.roster) d.roster.forEach((c, i) => document.getElementById(`day-${i}`).checked = c);
        syncHireDate();
    };
}
