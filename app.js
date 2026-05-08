function calculateLeave() {
    const hireDateStr = document.getElementById('hireDate').value;
    const weeklyHours = parseFloat(document.getElementById('weeklyHours').value) || 38;
    const mode = document.getElementById('calcMode').value;
    const today = new Date();
    
    if (!hireDateStr) return;
    
    const hireDate = new Date(hireDateStr);
    const serviceWeeks = (today - hireDate) / (1000 * 60 * 60 * 24 * 7);
    
    let annualLeave = 0;
    if (mode === 'startDate') {
        // Basic accrual: 4 weeks per year 
        annualLeave = serviceWeeks * (4 / 52) * weeklyHours;
    } else {
        const startBal = parseFloat(document.getElementById('startBalance').value) || 0;
        const balDateStr = document.getElementById('balanceDate').value;
        if (balDateStr) {
            const weeksSince = (today - new Date(balDateStr)) / (1000 * 60 * 60 * 24 * 7);
            annualLeave = startBal + (weeksSince * (4 / 52) * weeklyHours);
        }
    }

    // NSW LSL: 8.6667 weeks after 10 years 
    const lslWeeks = (serviceWeeks / 52) * 0.86667;

    document.getElementById('resAnnual').innerText = annualLeave.toFixed(2);
    document.getElementById('resLSL').innerText = Math.max(0, lslWeeks).toFixed(3);
}

function calculateResignation() {
    const rate = parseFloat(document.getElementById('hourlyRate').value) || 0;
    const exitDateStr = document.getElementById('resigDate').value;
    const currentLeave = parseFloat(document.getElementById('resAnnual').innerText) || 0;

    if (rate > 0 && exitDateStr) {
        const exitDate = new Date(exitDateStr);
        const weeksToExit = (exitDate - new Date()) / (1000 * 60 * 60 * 24 * 7);
        const weeklyHours = parseFloat(document.getElementById('weeklyHours').value) || 38;
        
        const finalLeave = currentLeave + (weeksToExit * (4 / 52) * weeklyHours);
        const payout = finalLeave * rate;
        
        document.getElementById('resignationResults').innerHTML = `<strong>Estimated Payout: $${payout.toFixed(2)}</strong>`;
    }
}

function toggleMode() {
    const mode = document.getElementById('calcMode').value;
    document.getElementById('balanceSection').style.display = (mode === 'knownBalance') ? 'block' : 'none';
}
