console.log('Content script loaded.');

var observer; // Declare observer globally to reinitialize later
var clickedButtons = new Set(); // Set to keep track of clicked buttons
var timeoutID; // Global variable to store the timeout ID
var reloadPageTimeoutID;


function getRandomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function startProcess() {
    disconnectObserver(); // Disconnect any existing observer
    // Clear the previous timeout if it exists
    if (timeoutID) {
        clearTimeout(timeoutID);
    }
    timeoutID = setTimeout(() => {
        observer = firstButtonHandler
        setupObserver(observer);
    }, 3500);

    if (reloadPageTimeoutID) {
        clearTimeout(reloadPageTimeoutID);
    }
    reloadPageTimeoutID = setTimeout(() => {
        window.location.reload();
    }, 30000);
}

function disconnectObserver() {
    if (observer) {
        observer.disconnect();
        observer = null; // Dereference the observer
    }
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
    if (button && !clickedButtons.has(button)) {
        clickedButtons.add(button); // Add button to clickedButtons set
        clickButton('div[aria-label="Actions for this post"]', '', () => {
            disconnectObserver(); // Disconnect after first button click
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
            disconnectObserver(); // Disconnect any existing observer
            setupObserver(thirdButtonHandler); // Setup observer for third button
            buttonFound = true;
        });
    });

    if (!buttonFound) {
        // If 'Move to Recycle bin' button not found, try finding 'Hide from profile' button
        clickButton('span[dir="auto"]', 'Hide from profile', () => {
            disconnectObserver(); // Disconnect any existing observer
            setupObserver(thirdButtonHandler); // Setup observer for third button
        });
    }
}


function thirdButtonHandler(mutations) {
    mutations.forEach(function (mutation) {
        if (!mutation.addedNodes) return;

        disconnectObserver(); // Disconnect any existing observer

        clickButton('div[aria-label="Move"]', '', () => {
            startProcess(); // Restart the process
        });
    });
}



startProcess(); // Start the initial process
