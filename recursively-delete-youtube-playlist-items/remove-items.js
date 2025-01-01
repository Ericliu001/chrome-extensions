console.log('Content script loaded.');

var clickedButtons = new Set(); // Set to keep track of clicked buttons

function startProcess() {
    console.log('Starting process...');
    const buttons = document.querySelectorAll(
        'div#menu ytd-menu-renderer yt-icon-button.dropdown-trigger[aria-label="yt-icon-button"]'
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

    // Wait for the dropdown menu to appear
    setTimeout(() => {
        // Locate the "Remove from Watch later" button in the dropdown
        const removeButton = Array.from(
            document.querySelectorAll('ytd-menu-service-item-renderer yt-formatted-string')
        ).find((el) => el.textContent.trim() === 'Remove from Watch later');

        if (removeButton) {
            console.log(`Clicking "Remove from Watch later" button for dropdown ${index + 1}...`);
            removeButton.click(); // Click the "Remove from Watch later" button

            // Wait for any animations or updates to complete before moving to the next button
            setTimeout(() => {
                processButtons(buttons, index + 1); // Process the next button
            }, 750);
        } else {
            console.warn(`"Remove from Watch later" button not found for dropdown ${index + 1}. Retrying...`);
            setTimeout(() => {
                processButtons(buttons, index + 1); // Retry the next button
            }, 1500);
        }
    }, 1000); // Increased delay for the dropdown to render
}

// Start the process when the script is loaded
reloadPageTimeoutID = setTimeout(() => {
    startProcess();
}, 10000);
