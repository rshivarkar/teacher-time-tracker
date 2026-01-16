document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration ---
    // REPLACE THIS WITH YOUR GOOGLE APPS SCRIPT WEB APP URL
    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbybJKfrlPucpxgUr-CfezB97mtwOIv_iqeshgKu_2LxZarVOIXpzsxBoUo_EK1jeOrY/exec';

    // --- Elements ---
    const loginOverlay = document.getElementById('login-overlay');
    const passcodeInput = document.getElementById('passcode-input');
    const btnLogin = document.getElementById('btn-login');
    const loginError = document.getElementById('login-error');

    const dateDisplay = {
        day: document.getElementById('current-day'),
        date: document.getElementById('current-date'),
        time: document.getElementById('current-time')
    };
    const statusText = document.getElementById('status-text');
    const statusDot = document.querySelector('.status-indicator');
    const btnCheckin = document.getElementById('btn-checkin');
    const btnCheckout = document.getElementById('btn-checkout');
    const messageArea = document.getElementById('message-area');

    // New Elements
    const dailySummary = document.getElementById('daily-summary');
    const totalHoursEl = document.getElementById('total-hours');
    const btnHistory = document.getElementById('btn-history');
    const btnCloseHistory = document.getElementById('btn-close-history');
    const historyModal = document.getElementById('history-modal');
    const historyList = document.getElementById('history-list');

    // --- State Management ---
    let lastAction = localStorage.getItem('lastAction') || null;
    let checkinTime = localStorage.getItem('checkinTime') || null; // ISO string

    // --- Login Logic ---
    const CORRECT_PASSCODE = "ds123";

    if (sessionStorage.getItem('isLoggedIn') === 'true') {
        loginOverlay.classList.add('hidden');
    }

    btnLogin.addEventListener('click', attemptLogin);
    passcodeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') attemptLogin();
    });

    function attemptLogin() {
        if (passcodeInput.value === CORRECT_PASSCODE) {
            sessionStorage.setItem('isLoggedIn', 'true');
            loginOverlay.classList.add('hidden');
            loginError.classList.add('hidden');
        } else {
            loginError.classList.remove('hidden');
            passcodeInput.value = '';
            passcodeInput.focus();
        }
    }

    // --- Initialization ---
    updateDateTime();
    setInterval(updateDateTime, 1000);
    updateUIState();

    // --- Event Listeners ---
    btnCheckin.addEventListener('click', () => handleAction('checkin'));
    btnCheckout.addEventListener('click', () => handleAction('checkout'));
    btnHistory.addEventListener('click', openHistory);
    btnCloseHistory.addEventListener('click', () => historyModal.classList.add('hidden'));

    // --- Functions ---

    function updateDateTime() {
        const now = new Date();
        const optionsDay = { weekday: 'long' };
        const optionsDate = { month: 'short', day: 'numeric', year: 'numeric' };
        const optionsTime = { hour: 'numeric', minute: '2-digit' };

        dateDisplay.day.textContent = now.toLocaleDateString('en-US', optionsDay);
        dateDisplay.date.textContent = now.toLocaleDateString('en-US', optionsDate);
        dateDisplay.time.innerText = now.toLocaleTimeString('en-US', optionsTime);
    }

    function updateUIState() {
        // Default State
        statusDot.classList.remove('status-active');
        btnCheckin.disabled = false;
        btnCheckout.disabled = false;

        // Reset button Opacity
        btnCheckin.style.opacity = '1';
        btnCheckout.style.opacity = '1';

        dailySummary.classList.add('hidden');

        if (lastAction === 'checkin') {
            statusText.textContent = `Checked In`;
            statusDot.classList.add('status-active');

            // Prevent Double Checkin
            btnCheckin.disabled = true;
            btnCheckin.style.opacity = '0.5';

            // Highlight checkout
            btnCheckout.style.transform = 'scale(1.02)';
        } else if (lastAction === 'checkout') {
            statusText.textContent = `Checked Out`;

            // Prevent Double Checkout (Optional, but good UX)
            btnCheckout.disabled = true;
            btnCheckout.style.opacity = '0.5';

            // Show summary if we have data
            if (checkinTime) {
                const now = new Date(); // Or save the checkout time
                const start = new Date(checkinTime);
                const diffMs = now - start;
                // We use localStorage checkinTime for rough calculation. 
                // Ideally this comes from the server in a real app, 
                // but client-side diff is close enough for "simple".
                // Since 'now' is updating, we really want the time OF checkout.
                // Let's assume the user just checked out.

                // If we are reloading the page hours later, 'now' is wrong.
                // So we should save 'workedDuration' in localStorage too.
                const storedDuration = localStorage.getItem('lastWorkedDuration');
                if (storedDuration) {
                    totalHoursEl.textContent = storedDuration;
                    dailySummary.classList.remove('hidden');
                }
            }
        } else {
            statusText.textContent = 'Ready to Log';
        }
    }

    function handleAction(type) {
        if (type === 'checkin' && lastAction === 'checkin') return; // Double protection

        const now = new Date();
        const data = {
            action: type,
            // Format for Sheet
            date: now.toLocaleDateString('en-US'),
            time: now.toLocaleTimeString('en-US'),
            deviceInfo: navigator.userAgent
        };

        disableButtons(true);
        showMessage('loading', 'Logging your time...');

        fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })
            .then(() => {
                // Update State
                lastAction = type;
                localStorage.setItem('lastAction', lastAction);

                if (type === 'checkin') {
                    checkinTime = now.toISOString();
                    localStorage.setItem('checkinTime', checkinTime);
                    localStorage.removeItem('lastWorkedDuration'); // Reset for new day
                } else if (type === 'checkout') {
                    // Calculate Duration
                    if (checkinTime) {
                        const start = new Date(checkinTime);
                        const end = now;
                        const diffMs = end - start;
                        const diffHrs = Math.floor(diffMs / 3600000);
                        const diffMins = Math.floor((diffMs % 3600000) / 60000);
                        const durationStr = `${diffHrs} hrs ${diffMins} mins`;

                        localStorage.setItem('lastWorkedDuration', durationStr);
                    }
                }

                updateUIState();
                showMessage('success', `Successfully ${type === 'checkin' ? 'Checked In' : 'Checked Out'}!`);
            })
            .catch(error => {
                console.error('Error:', error);
                showMessage('error', 'Failed to log time. Please check internet.');
            })
            .finally(() => {
                disableButtons(false);
                updateUIState();
            });
    }

    function openHistory() {
        historyModal.classList.remove('hidden');
        historyList.innerHTML = '<p class="loading-text">Loading history...</p>';

        const data = { action: 'getHistory' };

        // We use 'POST' (even for getting data) to be consistent with the Script
        // NOTE: 'no-cors' prevents reading the response! 
        // We MUST use standard CORS to read the JSON response.
        // Google Apps Script Web App returns correct CORS headers if "Who has access" is "Anyone".

        fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(data)
        })
            .then(response => response.json())
            .then(responseData => {
                renderHistory(responseData.history);
            })
            .catch(error => {
                console.error(error);
                historyList.innerHTML = '<p class="error-text">Could not load history. Ensure "Everyone" has access in Script settings.</p>';
            });
    }

    function renderHistory(logs) {
        if (!logs || logs.length === 0) {
            historyList.innerHTML = '<p class="empty-text">No history found.</p>';
            return;
        }

        historyList.innerHTML = logs.map(log => {
            const checkIn = log.checkIn ? `☀️ ${log.checkIn}` : '—';
            const checkOut = log.checkOut ? `🌙 ${log.checkOut}` : 'Wait...';
            const duration = log.duration ? `⏱️ ${log.duration}` : '';

            // Formatting duration if it comes back as a raw number (from formula)
            // Often Google Sheets sends raw number for duration (e.g. 0.354). 
            // We'll trust the string if possible, or leave it blank.

            return `
            <div class="history-item">
                <div class="history-left">
                    <span class="history-date">${log.dateStr || 'No Date'}</span>
                    <div class="history-times">
                        <span class="time-pill in">${checkIn}</span>
                        <span class="time-pill out">${checkOut}</span>
                    </div>
                </div>
                <div class="history-time">${duration}</div>
            </div>
            `;
        }).join('');
    }

    function disableButtons(disable) {
        if (!disable) {
            // Re-eval based on logic
            updateUIState();
            return;
        }
        btnCheckin.disabled = true;
        btnCheckout.disabled = true;
    }

    function showMessage(type, text) {
        messageArea.className = 'message-area';
        messageArea.classList.remove('hidden');
        messageArea.textContent = text;
        if (type === 'success') {
            messageArea.classList.add('message-success');
            setTimeout(() => messageArea.classList.add('hidden'), 5000);
        } else if (type === 'error') {
            messageArea.classList.add('message-error');
        }
    }
});
