let nswHolidays = [];
let db;

async function fetchHolidays() {
    try {
        const apiUrl = 'https://data.gov.au/data/api/3/action/datastore_search?resource_id=d256f282-ba27-4c64-ade7-0d7ad2530554&limit=1000';
        const response = await fetch(apiUrl);
        const data = await response.json();
        nswHolidays = data.result.records
            .filter(record => record.Jurisdiction && record.Jurisdiction.toLowerCase() === 'nsw')
            .map(record => {
                const d = record.Date.toString();
                return `${d.substring(0,4)}-${d.substring(4,6)}-${d.substring(6,8)}`;
            });
        calculateLeave();
    } catch (error) {
        nswHolidays = ["2026-01-01", "2026-01-26", "2026-04-03", "2026-04-04", "2026-04-05", "2026-04-06", "2026-04-25", "2026-04-27", "2026-06-08", "2026-10-05", "2026-12-25", "2026-12-26", "2026-12-28"];
        calculateLeave();
    }
}

const dbRequest = indexedDB.open("NSWLeaveTracker", 1);
dbRequest.onupgradeneeded = (e) => e.target.result.createObjectStore("userData");
dbRequest.onsuccess = (e) => { db = e.target.result; fetchHolidays(); loadFromDB(); };

function toggleMode() {
    const mode = document.getElementById('calcMode').value;
    document.getElementById('balanceSection').style.display = mode === 'knownBalance' ? 'block' : 'none';
    calculateLeave();
    saveToDB();
}

function saveToDB() {
    if (!db) return;
    const profile = {
        hireDate: document.getElementById('hireDate').value,
        calcMode: document.getElementById('calcMode').value,
        weeklyHours: document.getElementById('weeklyHours').value,
        balanceDate: document.getElementById('balanceDate').value,
        startBalance: document.getElementById('startBalance').value,
        roster: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map(id => document.getElementById(id).checked),
        history: Array.from(document.querySelectorAll('.history-item')).map(item => ({
            id: item.dataset.id, note: item.querySelector('.note-text').innerText, amount: parseFloat(item.dataset.amount)
        }))
    };
    const tx = db.transaction("userData", "readwrite");
    tx.objectStore("userData").put(profile, "profile");
}

function loadFromDB() {
    const tx = db.transaction("userData", "readonly");
    const req = tx.objectStore("userData").get("profile");
    req.onsuccess = () => {
        const d = req.result; if (!d) return;
        document.getElementById('hireDate').value = d.hireDate || '';
        document.getElementById('calcMode').value = d.calcMode || 'startDate';
        document.getElementById('weeklyHours').value = d.weeklyHours || 38;
        document.getElementById('balanceDate').value = d.balanceDate || '';
        document.getElementById('startBalance').value = d.startBalance || 0;
        const ids = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        if (d.roster) d.roster.forEach((c, i) => document.getElementById(ids[i]).checked = c);
        if (d.history) {
            document.getElementById('historyList').innerHTML = '';
            d.history.forEach(appendHistoryDOM);
        }
        toggleMode();
    };
}

function calculateLeave() {
    const mode = document.getElementById('calcMode').value;
    const hireDateValue = document.getElementById('hireDate').value;
    const weeklyHours = parseFloat(document.getElementById('weeklyHours').value) || 38;
    const today = new Date();
    
    let annualAccrued = 0;
    let totalServiceWeeks = 0;

    // 1. Calculate Total Service (Always from Hire Date for LSL)
    if (hireDateValue) {
        const hireDate = new Date(hireDateValue);
        totalServiceWeeks = (today - hireDate) / (1000 * 60 * 60 * 24 * 7);
    }

    // 2. Calculate Annual Accrual
    if (mode === 'startDate' && hireDateValue) {
        annualAccrued = totalServiceWeeks * (4 / 52) * weeklyHours;
    } else if (mode === 'knownBalance') {
        const bDateInput = document.getElementById('balanceDate').value;
        if (bDateInput) {
            const bDate = new Date(bDateInput);
            const weeksSinceBalance = (today - bDate) / (1000 * 60 * 60 * 24 * 7);
            annualAccrued = parseFloat(document.getElementById('startBalance').value) + (weeksSinceBalance * (4 / 52) * weeklyHours);
        }
    }

    const taken = Array.from(document.querySelectorAll('.history-item')).reduce((s, el) => s + parseFloat(el.dataset.amount), 0);
    
    document.getElementById('resAnnual').innerText = Math.max(0, annualAccrued - taken).toFixed(2);
    // NSW LSL: 8.667 weeks after 10 years (0.8667 weeks per year)
    document.getElementById('resLSL').innerText = Math.max(0, (totalServiceWeeks / 52) * 0.8667).toFixed(3);
}

function addHistoryEntry() {
    const startInput = document.getElementById('leaveStart').value;
    const endInput = document.getElementById('leaveEnd').value;
    if (!startInput || !endInput) return;
    const start = new Date(startInput);
    const end = new Date(endInput);
    const daily = parseFloat(document.getElementById('weeklyHours').value) / 5;
    const ids = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    let total = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        if (document.getElementById(ids[d.getDay()]).checked && !nswHolidays.includes(dateStr)) total += daily;
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