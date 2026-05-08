const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

window.onload = () => {
    ["hire", "bal", "opt", "resig"].forEach(prefix => setupDropdowns(prefix));
    
    // Set default dates
    const today = new Date();
    setDropdownDate("resig", today);
    setDropdownDate("opt", new Date(today.getFullYear(), 11, 31));

    document.querySelectorAll('.chip input').forEach(input => {
        input.addEventListener('change', calculateLeave);
    });
};

function setupDropdowns(prefix) {
    const dSel = document.getElementById(prefix + "Day");
    const mSel = document.getElementById(prefix + "Month");
    const ySel = document.getElementById(prefix + "Year");
    const currentYear = new Date().getFullYear();

    for (let i = 1; i <= 31; i++) dSel.add(new Option(i, i));
    MONTHS.forEach((m, idx) => mSel.add(new Option(m, idx)));
    // Hire date allows 40 years back; others follow current context
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
    
    // Handle months with fewer than 31 days
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

function getWorkingDaysCount() {
    let count = 0;
    for (let i = 0; i < 7; i++) { if (document.getElementById(`day-${i}`).checked) count++; }
    return count || 5; 
}

function calculateLeave() {
    const hireDateStr = document.getElementById('hireDate').value;
    const weeklyHours = parseFloat(document.getElementById('weeklyHours').value) || 38;
    const hoursPerDay = weeklyHours / getWorkingDaysCount();
    const mode = document.getElementById('calcMode').value;
    const today = new Date();
    
    if (!hireDateStr) return;
    const serviceWeeks = (today - new Date(hireDateStr)) / (1000 * 60 * 60 * 24 * 7);
    
    let totalHrs = 0;
    if (mode === 'startDate') {
        totalHrs = serviceWeeks * (4 / 52) * weeklyHours; // Annual leave formula [cite: 30]
    } else {
        const startBal = parseFloat(document.getElementById('startBalance').value) || 0;
        const bDateStr = document.getElementById('balanceDate').value;
        if (bDateStr) {
            const weeksSince = (today - new Date(bDateStr)) / (1000 * 60 * 60 * 24 * 7);
            totalHrs = startBal + (weeksSince * (4 / 52) * weeklyHours);
        }
    }

    document.getElementById('resAnnual').innerText = totalHrs.toFixed(2);
    document.getElementById('resDays').innerText = (totalHrs / hoursPerDay).toFixed(1);
    document.getElementById('resLSL').innerText = Math.max(0, (serviceWeeks / 52) * 0.8667).toFixed(3); // LSL formula [cite: 35]
}

function calculateResignation() {
    const rate = parseFloat(document.getElementById('hourlyRate').value) || 0;
    const exitDateStr = document.getElementById('resigDate').value;
    const currentBalance = parseFloat(document.getElementById('resAnnual').innerText) || 0;
    const weeklyHours = parseFloat(document.getElementById('weeklyHours').value) || 38;

    const weeksToExit = (new Date(exitDateStr) - new Date()) / (1000 * 60 * 60 * 24 * 7);
    const payout = (currentBalance + (weeksToExit * (weeklyHours * (4/52)))) * rate;

    document.getElementById('resignationResults').innerHTML = `
        <div class="opt-item" style="border-color: #007AFF; background: #f0f7ff;">
            <strong>Est. Payout: $${payout.toLocaleString(undefined, {minimumFractionDigits:2})}</strong>
        </div>`;
}

function optimizeLeave() { /* Optimization logic here... */ }

function toggleMode() {
    const mode = document.getElementById('calcMode').value;
    document.getElementById('balanceSection').style.display = (mode === 'knownBalance') ? 'block' : 'none';
}
