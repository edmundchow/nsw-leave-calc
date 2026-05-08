/**
 * NSW Leave Calculator - Core Logic
 * Features: Roster-based accrual, Local-First Sync, Dynamic Fallbacks
 */

let nswHolidays = [];
let db;

// 1. DATABASE & INITIALIZATION
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
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('resigDate').value = today;
    
    const nextYear = new Date().getFullYear() + 1;
    document.getElementById('optDate').value = `${nextYear}-12-31`;

    // Listen for roster changes
    document.querySelectorAll('.chip input').forEach(input => {
        input.addEventListener('change', calculateLeave);
    });

    syncHolidays();
    loadFromDB();
}

// 2. HOLIDAY SYNC (Local + Dynamic Fallback)
function generateStandardHolidays(year) {
    return [`${year}-01-01`, `${year}-01-26`, `${year}-04-25`, `${year}-12-25`, `${year}-12-26` ];
}

async function syncHolidays() {
    const curYear = new Date().getFullYear();
    let fallback = [...generateStandardHolidays(curYear), ...generateStandardHolidays(curYear+1), ...generateStandardHolidays(curYear+2)];

    try {
        const tx = db.transaction("holidayData", "readonly");
        const store = tx.objectStore("holidayData");
        const getRequest = store.get("nsw_list");

        getRequest.onsuccess = () => {
            nswHolidays = getRequest.result || fallback;
            calculateLeave();
            attemptNetworkFetch();
        };
    } catch (e) {
        nswHolidays = fallback;
        calculateLeave();
    }
}

async function attemptNetworkFetch() {
    try {
        const response = await fetch('https://data.gov.au/data/api/3/action/datastore_search?resource_id=d256f282-ba27-4c64-ade7-0d7ad2530554&limit=1000');
        const data = await response.json();
        const fresh = data.result.records
            .filter(r => r.Jurisdiction?.toLowerCase() === 'nsw')
            .map(r => { 
                const d = r.Date.toString(); 
                return `${d.substring(0,4)}-${d.substring(4,6)}-${d.substring(6,8)}`; 
            });

        if (fresh.length > 0) {
            nswHolidays = fresh;
            const tx = db.transaction("holidayData", "readwrite");
            tx.objectStore("holidayData").put(fresh, "nsw_list");
            document.getElementById('lastSync').innerText = "Holidays updated: NSW Gov API";
            calculateLeave();
        }
    } catch (e) { console.warn("Using offline/fallback holidays."); }
}

// 3. CORE CALCULATION LOGIC
function getWorkingDaysCount() {
    let count = 0;
    for (let i = 0; i < 7; i++) {
        if (document.getElementById(`day-${i}`).checked) count++;
    }
    return count || 5; 
}

function calculateLeave() {
    const mode = document.getElementById('calcMode').value;
    const hireDateStr = document.getElementById('hireDate').value;
    const weeklyHours = parseFloat(document.getElementById('weeklyHours').value) || 38;
    const workingDaysCount = getWorkingDaysCount();
    const hoursPerDay = weeklyHours / workingDaysCount;
    const today = new Date();
    
    if (!hireDateStr) return;
    const hireDate = new Date(hireDateStr);

    let serviceWeeks = (today - hireDate) / (1000 * 60 * 60 * 24 * 7);
    let totalAccruedHours = 0;

    if (mode === 'startDate') {
        totalAccruedHours = serviceWeeks * (4 / 52) * weeklyHours;
    } else {
        const bDateStr = document.getElementById('balanceDate').value;
        const startBal = parseFloat(document.getElementById('startBalance').value) || 0;
        if (bDateStr) {
            const bDate = new Date(bDateStr);
            const weeksSince = (today - bDate) / (1000 * 60 * 60 * 24 * 7);
            totalAccruedHours = startBal + (weeksSince * (4 / 52) * weeklyHours);
        } else {
            totalAccruedHours = startBal;
        }
    }

    // UI Updates
    document.getElementById('resAnnual').innerText = totalAccruedHours.toFixed(2);
    document.getElementById('resDays').innerText = (totalAccruedHours / hoursPerDay).toFixed(1);
    document.getElementById('resLSL').innerText = Math.max(0, (serviceWeeks / 52) * 0.8667).toFixed(3);
    
    saveToDB();
    calculateResignation();
    optimizeLeave();
}

function calculateResignation() {
    const rate = parseFloat(document.getElementById('hourlyRate').value) || 0;
    const weeklyHours = parseFloat(document.getElementById('weeklyHours').value) || 38;
    const currentBalance = parseFloat(document.getElementById('resAnnual').innerText) || 0;
    const exitDateStr = document.getElementById('resigDate').value;
    const today = new Date();
    
    if (rate <= 0 || !exitDateStr) return;
    const exitDate = new Date(exitDateStr);

    let weeksToExit = Math.max(0, (exitDate - today) / (1000 * 60 * 60 * 24 * 7));
    const projectedBal = currentBalance + (weeksToExit * (weeklyHours * (4/52)));
    const payout = projectedBal * rate;
    const superLost = payout * 0.115;

    document.getElementById('resignationResults').innerHTML = `
        <div class="opt-item" style="border-color: #007AFF; background: #f0f7ff;">
            <strong>Est. Payout: $${payout.toLocaleString(undefined, {minimumFractionDigits:2})}</strong><br>
            <small>⚠️ Super Lost on Payout: -$${superLost.toFixed(2)}</small>
        </div>`;
}

function optimizeLeave() {
    const results = document.getElementById('optimizationResults');
    const endDateStr = document.getElementById('optDate').value;
    if (!endDateStr) return;
    const endDate = new Date(endDateStr);
    const today = new Date();
    
    const tips = nswHolidays.map(h => new Date(h))
        .filter(h => h > today && h < endDate)
        .sort((a,b) => a-b)
        .map(h => {
            const day = h.getDay();
            const dStr = h.toLocaleDateString('en-AU', {day:'numeric', month:'short'});
            // Strategy based on standard weekend or adjacent days
            if (day === 2 || day === 4) return `<div class="opt-item">🚀 <b>${dStr} Bridge:</b> Take 1 day, get 4 off.</div>`;
            if (day === 1 || day === 5) return `<div class="opt-item">☀️ <b>${dStr}:</b> Long weekend.</div>`;
            return null;
        }).filter(x => x).join('');

    results.innerHTML = tips || "No major clusters found.";
}

// 4. PERSISTENCE
function toggleMode() {
    const mode = document.getElementById('calcMode').value;
    document.getElementById('balanceSection').style.display = mode === 'knownBalance' ? 'block' : 'none';
    calculateLeave();
}

function saveToDB() {
    if (!db) return;
    const roster = [];
    for (let i = 0; i < 7; i++) {
        roster.push(document.getElementById(`day-${i}`).checked);
    }

    const profile = {
        hireDate: document.getElementById('hireDate').value,
        calcMode: document.getElementById('calcMode').value,
        weeklyHours: document.getElementById('weeklyHours').value,
        hourlyRate: document.getElementById('hourlyRate').value,
        balanceDate: document.getElementById('balanceDate').value,
        startBalance: document.getElementById('startBalance').value,
        roster: roster
    };
    db.transaction("userData", "readwrite").objectStore("userData").put(profile, "profile");
}

function loadFromDB() {
    db.transaction("userData", "readonly").objectStore("userData").get("profile").onsuccess = (e) => {
        const d = e.target.result;
        if (!d) return;
        document.getElementById('hireDate').value = d.hireDate || "";
        document.getElementById('calcMode').value = d.calcMode || "startDate";
        document.getElementById('weeklyHours').value = d.weeklyHours || 38;
        document.getElementById('hourlyRate').value = d.hourlyRate || "";
        document.getElementById('balanceDate').value = d.balanceDate || "";
        document.getElementById('startBalance').value = d.startBalance || 0;
        
        if (d.roster) {
            d.roster.forEach((checked, i) => {
                document.getElementById(`day-${i}`).checked = checked;
            });
        }
        toggleMode();
    };
}
