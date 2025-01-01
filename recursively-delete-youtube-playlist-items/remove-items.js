console.log('Content script loaded.');

var observer; // Declare observer globally to reinitialize later
var clickedButtons = new Set(); // Set to keep track of clicked buttons
var timeoutID; // Global variable to store the timeout ID
var reloadPageTimeoutID;

function startProcess() {
    disconnectObserver(); // Disconnect any existing observer
    // Clear the previous timeout if it exists
    if (timeoutID) {
        clearTimeout(timeoutID);
    }
    timeoutID = setTimeout(() => {
        observer = firstButtonHandler;
        setupObserver(observer);
    }, 3000);

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
            if (onSuccess) onSuccess();
            break;
        }
    }
}

function checkForFirstButton() {
    var button = document.querySelector('yt-icon-button.dropdown-trigger[aria-label="yt-icon-button"]');
    if (button && !clickedButtons.has(button)) {
        clickedButtons.add(button); // Add button to clickedButtons set
        button.click(); // Click the dropdown button
        console.log('Dropdown button clicked.');
        setTimeout(() => {
            checkForSecondButton();
        }, 500); // Delay to allow the dropdown to render
    }
}

function checkForSecondButton() {
    var button = document.querySelector('ytd-menu-service-item-renderer[role="menuitem"] tp-yt-paper-item[role="option"]');
    if (button && !clickedButtons.has(button)) {
        clickedButtons.add(button); // Add button to clickedButtons set
        clickButton('ytd-menu-service-item-renderer[role="menuitem"] tp-yt-paper-item[role="option"]', '', () => {
            console.log('Second button clicked.');
            startProcess(); // Restart the process after clicking the second button
        });
    }
}

function firstButtonHandler(mutations) {
    mutations.forEach(function (mutation) {
        if (!mutation.addedNodes) return;
        checkForFirstButton();
    });
}

startProcess(); // Start the initial process