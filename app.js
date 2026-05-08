const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

window.onload = function() {
    ["hire", "bal", "opt", "resig"].forEach(prefix => {
        if(document.getElementById(prefix + "Day")) setupDropdowns(prefix);
    });
    
    const today = new Date();
    setDropdownDate("hire", new Date(today.getFullYear() - 1, today.getMonth(), today.getDate())); // Default 1 year ago
    
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
    for (let i = currentYear + 10; i >= currentYear - 40; i--) ySel.add(new Option(i, i));
}

function setDropdownDate(prefix, date) {
    const d = document.getElementById(prefix + "Day");
    if(!d) return;
    document.getElementById(prefix + "Day").value = date.getDate();
    document.getElementById(prefix + "Month").value = date.getMonth();
    document.getElementById(prefix + "Year").value = date.getFullYear();
    syncDate(prefix);
}

function syncDate(prefix) {
    const d = parseInt(document.getElementById(prefix + "Day").value);
    const m = parseInt(document.getElementById(prefix + "Month").value);
    const y = parseInt(document.getElementById(prefix + "Year").value);
    
    const dateObj = new Date(y, m, d);
    document.getElementById(prefix + "Date").value = dateObj.toISOString().split('T')[0];
    calculateLeave();
}

function calculateLeave() {
    const hireDateStr = document.getElementById('hireDate').value;
    const weeklyHours = parseFloat(document.getElementById('weeklyHours').value) || 38;
    
    let workingDays = 0;
    for (let i = 0; i < 7; i++) { if (document.getElementById(`day-${i}`).checked) workingDays++; }
    const hrsPerDay = weeklyHours / (workingDays || 5);

    const today = new Date();
    const hireDate = new Date(hireDateStr);
    const diffWeeks = (today - hireDate) / (1000 * 60 * 60 * 24 * 7);

    // Annual Leave (4 weeks per year)
    const annualHrs = diffWeeks * (4 / 52) * weeklyHours;
    
    // NSW LSL (8.6667 weeks after 10 years)
    const lslWeeks = (diffWeeks / 52) * 0.8667;

    // UPDATE THE HEADER
    document.getElementById('resAnnual').innerText = Math.max(0, annualHrs).toFixed(2);
    document.getElementById('resDays').innerText = Math.max(0, annualHrs / hrsPerDay).toFixed(1);
    document.getElementById('resLSL').innerText = Math.max(0, lslWeeks).toFixed(3);
}

function toggleMode() {
    const mode = document.getElementById('calcMode').value;
    document.getElementById('balanceSection').style.display = (mode === 'knownBalance') ? 'block' : 'none';
}

function optimizeLeave() {
    document.getElementById('optimizationResults').innerHTML = "<p style='margin-top:10px;'>Checking NSW Holidays...</p>";
}
