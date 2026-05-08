let nswHolidays = [];

window.onload = () => {
    // Set default dates for buttons
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('resigDate').value = today;
    document.getElementById('optDate').value = `${new Date().getFullYear()}-12-31`;

    // Initialize roster listeners
    document.querySelectorAll('.chip input').forEach(input => {
        input.addEventListener('change', calculateLeave);
    });
};

function getWorkingDaysCount() {
    let count = 0;
    for (let i = 0; i < 7; i++) {
        if (document.getElementById(`day-${i}`).checked) count++;
    }
    return count || 5; 
}

function calculateLeave() {
    const hireDateStr = document.getElementById('hireDate').value;
    const weeklyHours = parseFloat(document.getElementById('weeklyHours').value) || 38;
    const workingDaysCount = getWorkingDaysCount();
    const hoursPerDay = weeklyHours / workingDaysCount;
    const mode = document.getElementById('calcMode').value;
    const today = new Date();
    
    if (!hireDateStr) return;
    
    const hireDate = new Date(hireDateStr);
    const serviceWeeks = (today - hireDate) / (1000 * 60 * 60 * 24 * 7);
    
    let totalHrs = 0;
    if (mode === 'startDate') {
        totalHrs = serviceWeeks * (4 / 52) * weeklyHours;
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
    document.getElementById('resLSL').innerText = Math.max(0, (serviceWeeks / 52) * 0.8667).toFixed(3);
}

function calculateResignation() {
    const rate = parseFloat(document.getElementById('hourlyRate').value) || 0;
    const exitDateStr = document.getElementById('resigDate').value;
    const currentBalance = parseFloat(document.getElementById('resAnnual').innerText) || 0;
    const weeklyHours = parseFloat(document.getElementById('weeklyHours').value) || 38;

    if (rate <= 0) {
        alert("Please enter your hourly rate first.");
        return;
    }

    const weeksToExit = (new Date(exitDateStr) - new Date()) / (1000 * 60 * 60 * 24 * 7);
    const projectedBal = currentBalance + (Math.max(0, weeksToExit) * (weeklyHours * (4/52)));
    const payout = projectedBal * rate;

    document.getElementById('resignationResults').innerHTML = `
        <div class="opt-item" style="border-color: #007AFF; background: #f0f7ff;">
            <strong>Est. Payout: $${payout.toLocaleString(undefined, {minimumFractionDigits:2})}</strong><br>
            <small>Based on ${projectedBal.toFixed(2)} hours</small>
        </div>`;
}

function optimizeLeave() {
    const results = document.getElementById('optimizationResults');
    results.innerHTML = `<div class="opt-item">Checking NSW Public Holidays...</div>`;
    
    // Simple mock logic for demonstration
    setTimeout(() => {
        results.innerHTML = `<div class="opt-item">🚀 <b>Easter Break:</b> Take April 14-17 off to get 10 days away using only 4 days leave.</div>`;
    }, 500);
}

function toggleMode() {
    const mode = document.getElementById('calcMode').value;
    document.getElementById('balanceSection').style.display = (mode === 'knownBalance') ? 'block' : 'none';
}
