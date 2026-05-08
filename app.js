const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
let nswHolidays = [];
let db;

function initDropdowns() {
    const d = document.getElementById("hireDay");
    const m = document.getElementById("hireMonth");
    const y = document.getElementById("hireYear");

    // ✅ SAFETY CHECK (this is what you are missing)
    if (!d || !m || !y) {
        console.warn("Dropdown elements missing in DOM");
        return;
    }

    d.innerHTML = "";
    m.innerHTML = "";
    y.innerHTML = "";

    for (let i = 1; i <= 31; i++) {
        d.add(new Option(i, i));
    }

    MONTHS.forEach((x, i) => {
        m.add(new Option(x, i));
    });

    const yr = new Date().getFullYear();
    for (let i = yr; i > yr - 60; i--) {
        y.add(new Option(i, i));
    }
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
        // Robust Fallback for 2026 & 2027
        nswHolidays = [
            "2026-01-01", "2026-01-26", "2026-04-03", "2026-04-06", "2026-04-25", "2026-06-08", "2026-10-05", "2026-12-25", "2026-12-28",
            "2027-01-01", "2027-01-26", "2027-03-26", "2027-03-29", "2027-04-26", "2027-06-14", "2027-10-04", "2027-12-25", "2027-12-27", "2027-12-28"
        ];
    }
    calculateLeave();
}

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

    document.getElementById('optDay').value = 31;
    document.getElementById('optMonth').value = 11; // December
    document.getElementById('optYear').value = curYear + 1;

    fetchHolidays();
    loadFromDB();
};

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
    
    // Convert holiday strings to objects for easier day-of-week manipulation
    const hData = nswHolidays.map(h => new Date(h)).sort((a,b) => a-b);

    hData.forEach(h => {
        if (h < today || h > endDate) return;
        const day = h.getDay();
        const dateStr = h.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });

        // TUESDAY HOLIDAY -> Bridge Monday
        if (day === 2) {
            tips.push({ title: `Long Weekend Hack: ${dateStr}`, desc: `Take Monday off to create a 4-day weekend.`, mult: "4 days off for 1 day leave" });
        }
        // THURSDAY HOLIDAY -> Bridge Friday
        if (day === 4) {
            tips.push({ title: `Long Weekend Hack: ${dateStr}`, desc: `Take Friday off to create a 4-day weekend.`, mult: "4 days off for 1 day leave" });
        }
        // WEDNESDAY HOLIDAY -> The Split
        if (day === 3) {
            tips.push({ title: `Mid-week Win: ${dateStr}`, desc: `Take Mon+Tue OR Thu+Fri off for a 5-day break.`, mult: "5 days off for 2 days leave" });
        }
        // Easter Strategy (Check if Good Friday)
        if (day === 5 && (h.getMonth() === 2 || h.getMonth() === 3)) {
            tips.push({ title: `Easter Mega-Break`, desc: `Take the 4 days after Easter Monday off.`, mult: "10 days off for 4 days leave" });
        }
        // Christmas Strategy (End of Dec)
        if (h.getMonth() === 11 && h.getDate() === 25) {
            tips.push({ title: `End of Year Reset`, desc: `Take the 3 days between Boxing Day and New Year's Day.`, mult: "10 days off for 3 days leave" });
        }
    });

    // Remove duplicates if any strategies overlap
    const uniqueTips = Array.from(new Set(tips.map(a => JSON.stringify(a)))).map(a => JSON.parse(a));

    resultsDiv.innerHTML = uniqueTips.length > 0 
        ? uniqueTips.map(t => `<div class="opt-item"><span class="opt-tag">${t.title}</span><br>${t.desc}<br><small style="color:#28a745;"><b>${t.mult}</b></small></div>`).join('')
        : "No high-value clusters found in this period.";
}
