console.log('Content script loaded.');

var observer; // Declare observer globally to reinitialize later

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

function firstButtonHandler(mutations) {
    mutations.forEach(function (mutation) {
        if (!mutation.addedNodes) return;
        clickButton('div[aria-label="Actions for this post"]', '', () => {
            observer.disconnect(); // Disconnect after first button click
            setupObserver(secondButtonHandler); // Setup observer for second button
        });
    });
}

function secondButtonHandler(mutations) {
    mutations.forEach(function (mutation) {
        if (!mutation.addedNodes) return;
        clickButton('span[dir="auto"]', 'Move to Recycle bin', () => {
            observer.disconnect(); // Disconnect after second button click
            setupObserver(thirdButtonHandler); // Setup observer for third button
        });
    });
}

function thirdButtonHandler(mutations) {
    mutations.forEach(function (mutation) {
        if (!mutation.addedNodes) return;
        clickButton('div[aria-label="Move"]', '', () => {
            observer.disconnect(); // Disconnect after third button click
            // Any additional logic after third button click can go here
        });
    });
}

setupObserver(firstButtonHandler); // Initialize observer with first button handler
