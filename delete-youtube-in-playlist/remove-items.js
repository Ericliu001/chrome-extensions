console.log('Content script loaded.');

var clickedButtons = new Set(); // Set to keep track of clicked buttons

function startProcess() {
    console.log('Starting process...');
    const buttons = document.querySelectorAll(
        'ytd-playlist-video-renderer ytd-menu-renderer yt-icon-button'
    );

    if (buttons.length === 0) {
        console.warn('No dropdown buttons found.');
        return;
    }

    console.log(`Found ${buttons.length} dropdown buttons.`);
    processButtons(buttons, 0); // Start processing buttons from the first one
}

function processButtons(buttons, index) {
    if (index >= buttons.length) {
        console.log('Finished processing all buttons. Reloading the page in 5 seconds...');

        reloadPageTimeoutID = setTimeout(() => {
            window.location.reload();
        }, 5000);
        return;
    }

    const button = buttons[index];

    // Check if the button has already been clicked
    if (clickedButtons.has(button)) {
        console.log(`Button ${index + 1} already processed. Skipping.`);
        processButtons(buttons, index + 1);
        return;
    }

    clickedButtons.add(button);
    console.log(`Clicking dropdown button ${index + 1}...`);
    button.click(); // Click the dropdown button

    // Wait for the dropdown menu to appear using MutationObserver
    const observer = new MutationObserver((mutations, obs) => {
        const removeButton = Array.from(
            document.querySelectorAll('ytd-menu-service-item-renderer yt-formatted-string')
        ).find((el) => el.textContent.trim() === 'Remove from Watch later');

        if (removeButton) {
            console.log(`Clicking "Remove from Watch later" button for dropdown ${index + 1}...`);
            removeButton.click();
            obs.disconnect();

            setTimeout(() => {
                processButtons(buttons, index + 1);
            }, 750);
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Set a fallback timeout in case the observer doesn't trigger
    setTimeout(() => {
        observer.disconnect();
        console.warn(`"Remove from Watch later" button not found for dropdown ${index + 1} in time. Retrying...`);
        processButtons(buttons, index + 1);
    }, 5000);
}

// Start the process when the script is loaded
reloadPageTimeoutID = setTimeout(() => {
    startProcess();
}, 1000);
