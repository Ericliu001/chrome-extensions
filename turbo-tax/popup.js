document.getElementById('startProcessBtn').addEventListener('click', () => {
    console.log('Extension button clicked.');
    
    // Send a message to content.js
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                function: startProcess
            });
        }
    });
});

// Function to run in content script
function startProcess() {
    console.log('Starting process...');
    const editItemButtons = document.querySelectorAll(
        'button[aria-label="EditItem"]'
    );

    if (editItemButtons.length === 0) {
        console.warn('No dropdown buttons found.');
        return;
    }

    console.log(`Found edit buttons: ${editItemButtons.length}.`);
    // processButtons(editItemButtons, 0); // Start processing buttons from the first one
}

