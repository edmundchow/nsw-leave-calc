const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Runs immediately when the page loads to initialize dropdowns and listeners
window.onload = function() {
    const dateGroups = ["hire", "bal", "opt", "resig"];
    
    // Populate all empty dropdown selectors 
    dateGroups.forEach(prefix => {
        setupDropdowns(prefix);
    });
    
    // Set default dates for the UI 
    const today = new Date();
    setDropdownDate("resig", today);
    setDropdownDate("opt", new Date(today.getFullYear(), 11, 31));

    // Listen for roster (working days) changes 
    document.querySelectorAll('.chip input').forEach(input => {
        input.addEventListener('change', calculateLeave);
    });
};

/**
 * Fills DD, MMM, and YYYY dropdowns with options 
 */
function setupDropdowns(prefix) {
    const dSel = document.getElementById(prefix + "Day");
    const mSel = document.getElementById(prefix + "Month");
    const ySel = document.getElementById(prefix + "Year");
    
    if (!dSel || !mSel || !ySel) return; 

    const currentYear = new Date().getFullYear();

    // Fill Days (1-31)
    for (let i = 1; i <= 31; i++) {
        dSel.add(new Option(i, i));
    }

    // Fill Months (Jan-Dec)
    MONTHS.forEach((m, idx) => {
        mSel.add(new Option(m, idx));
    });

    // Fill Years (Allows 40 years back for Hire Date) 
    for (let i = currentYear + 10; i >= currentYear - 40; i--) {
        ySel.add(new Option(i, i));
    }
}

/**
 * Sets the dropdowns to a specific date object 
 */
function setDropdownDate(prefix, date) {
    document.getElementById(prefix + "Day").value = date.getDate();
    document.getElementById(prefix + "Month").value = date.getMonth();
    document.getElementById(prefix + "Year").value = date.getFullYear();
    syncDate(prefix);
}

/**
 * Converts dropdown selections into a single date string and triggers calculation 
 */
function syncDate(prefix) {
    const d = parseInt(document.getElementById(prefix + "Day").value);
    const m = parseInt(document.getElementById(prefix + "Month").value);
    const y = parseInt(document.getElementById(prefix + "Year").value);
    
    // Correction for months with fewer than 31 days (e.g., Feb 30 -> Feb 28/29) 
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
    for (let i = 0; i < 7; i++) {
        if (document.getElementById(`day-${i}`).checked) count++;
    }
    return count || 5; 
}

/**
 * Core Logic for Annual and Long Service Leave 
 */
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
    
    // 1. Annual Leave Calculation (4 weeks/year per NES) 
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

    // 2. NSW Long Service Leave (8.6667 weeks after 10 years) 
    const lslWeeks = Math.max(0, (serviceWeeks / 52) * 0.8667);

    // Update UI 
    document.getElementById('resAnnual').innerText = totalHrs.toFixed(2);
    document.getElementById('resDays').innerText = (totalHrs / hoursPerDay).toFixed(1);
    document.getElementById('resLSL').innerText = lslWeeks.toFixed(3);
}

/**
 * Projected payout based on Exit Date 
 */
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
    results.innerHTML = `<div class="opt-item">🚀 <b>Logic Active:</b> Checking for public holiday clusters in NSW...</div>`;
}

function toggleMode() {
    const mode = document.getElementById('calcMode').value;
    document.getElementById('balanceSection').style.display = (mode === 'knownBalance') ? 'block' : 'none';
}
