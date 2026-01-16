document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration ---
    // REPLACE THIS WITH YOUR GOOGLE APPS SCRIPT WEB APP URL
    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzQPnEjbJYvHqYQxqd8kiUA1fg7MHED_O9HCJAElHRFzyIrw-d3o3eaUMxLPVQ4YbwD/exec';

    // --- Elements ---
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

    // --- State Management ---
    // We use localStorage to remember the state for this device/browser
    let lastAction = localStorage.getItem('lastAction') || null; // 'checkin' or 'checkout'
    let lastActionTime = localStorage.getItem('lastActionTime') || null;

    // --- Initialization ---
    updateDateTime();
    setInterval(updateDateTime, 1000);
    updateUIState();

    // --- Event Listeners ---
    btnCheckin.addEventListener('click', () => handleAction('checkin'));
    btnCheckout.addEventListener('click', () => handleAction('checkout'));

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
        // Reset styles
        statusDot.classList.remove('status-active');
        btnCheckin.disabled = false;
        btnCheckout.disabled = false;

        if (lastAction === 'checkin') {
            statusText.textContent = `Checked In at ${formatTime(lastActionTime)}`;
            statusDot.classList.add('status-active');
            // Visual emphasis: Already checked in, so Check Out is the likely next step
            btnCheckin.style.opacity = '0.5';
        } else if (lastAction === 'checkout') {
            statusText.textContent = `Checked Out at ${formatTime(lastActionTime)}`;
            // Visual emphasis: Already checked out, so Check In is likely
            btnCheckout.style.opacity = '0.5';
        } else {
            statusText.textContent = 'Ready to Log';
        }
    }

    function formatTime(isoString) {
        if (!isoString) return '';
        const date = new Date(isoString);
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }

    function handleAction(type) {
        if (SCRIPT_URL === 'REPLACE_ME_WITH_YOUR_SCRIPT_URL') {
            showMessage('setup-error', '⚠️ Admin Setup Required: Google Script URL is missing check instructions.');
            return;
        }

        const now = new Date();
        const data = {
            action: type,
            timestamp: now.toISOString(),
            date: now.toLocaleDateString('en-US'),
            time: now.toLocaleTimeString('en-US'),
            deviceInfo: navigator.userAgent
        };

        // UI Optimistic Update
        disableButtons(true);
        showMessage('loading', 'Logging your time...');

        // Send to Google Sheets via Apps Script
        // We use no-cors to avoid CORS errors with simple Google Scripts, 
        // meaning we won't get a readable response content, but the status will be opaque.
        // For a more robust setup, the script needs correct CORS headers.
        fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
            .then(() => {
                // Success (Optimistic)
                lastAction = type;
                lastActionTime = now.toISOString();
                localStorage.setItem('lastAction', lastAction);
                localStorage.setItem('lastActionTime', lastActionTime);

                updateUIState();
                showMessage('success', `Successfully ${type === 'checkin' ? 'Checked In' : 'Checked Out'}!`);
            })
            .catch(error => {
                console.error('Error:', error);
                showMessage('error', 'Failed to log time. Please check your internet connection.');
            })
            .finally(() => {
                disableButtons(false);
                // Re-apply visual dimming based on state
                updateUIState();
            });
    }

    function disableButtons(disable) {
        btnCheckin.disabled = disable;
        btnCheckout.disabled = disable;
    }

    function showMessage(type, text) {
        messageArea.className = 'message-area'; // reset
        messageArea.classList.remove('hidden');
        messageArea.textContent = text;

        if (type === 'success') {
            messageArea.classList.add('message-success');
            // Hide after 3 seconds
            setTimeout(() => {
                messageArea.classList.add('hidden');
            }, 5000);
        } else if (type === 'error' || type === 'setup-error') {
            messageArea.classList.add('message-error');
        }
    }
});
