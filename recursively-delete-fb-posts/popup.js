console.log('Content script loaded.');

var observer; // Declare observer globally to reinitialize later

function getRandomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function startProcess() {
    setupObserver(firstButtonHandler);
    var delay = getRandomDelay(3000, 10000); // Get a random delay between 3000ms (3s) and 10000ms (10s)
    setTimeout(() => {
        window.location.reload(); 
    }, delay); // Refresh the page after random seconds
}

function setupObserver(callback) {
    observer = new MutationObserver(callback);
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

function clickButton(selector, textContent, onSuccess) {
    var buttons = document.querySelectorAll(selector);
    for (let button of buttons) {
        if (textContent === '' || button.textContent.trim() === textContent) {
            console.log('Button found. Clicking it:', selector, textContent);
            button.click();
            onSuccess();
            break;
        }
    }
}

function checkForFirstButton() {
    var button = document.querySelector('div[aria-label="Actions for this post"]');
    if (button) {
        clickButton('div[aria-label="Actions for this post"]', '', () => {
            observer.disconnect(); // Disconnect after first button click
            setupObserver(secondButtonHandler); // Setup observer for second button
        });
    }
}

function firstButtonHandler(mutations) {
    mutations.forEach(function (mutation) {
        if (!mutation.addedNodes) return;
        checkForFirstButton();
    });
}

function secondButtonHandler(mutations) {
    let buttonFound = false;

    mutations.forEach(function (mutation) {
        if (!mutation.addedNodes) return;
        clickButton('span[dir="auto"]', 'Move to Recycle bin', () => {
            observer.disconnect(); // Disconnect after second button click
            setupObserver(thirdButtonHandler); // Setup observer for third button
            buttonFound = true;
        });
    });

    if (!buttonFound) {
        // If 'Move to Recycle bin' button not found, try finding 'Hide from profile' button
        clickButton('span[dir="auto"]', 'Hide from profile', () => {
            observer.disconnect(); // Disconnect after clicking 'Hide from profile'
            setupObserver(thirdButtonHandler); // Setup observer for third button
        });
    }
}


function thirdButtonHandler(mutations) {
    mutations.forEach(function (mutation) {
        if (!mutation.addedNodes) return;

        observer.disconnect(); // Disconnect the observer to avoid multiple triggers

        clickButton('div[aria-label="Move"]', '', () => {
            startProcess(); // Restart the process
        });
    });
}



startProcess(); // Start the initial process
