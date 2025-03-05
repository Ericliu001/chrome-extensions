let stopProcessing = false; // Global flag to stop the process

document.getElementById('startProcessBtn').addEventListener('click', () => {
    stopProcessing = false; // Reset stop flag
    console.log('Extension button clicked.');

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                func: (stopFlagVarName) => {
                    window[stopFlagVarName] = false; // Store stop flag in the window object

                    const clickedButtons = new Set();

                    function processButtons(buttons, index) {
                        if (index >= buttons.length || window[stopFlagVarName]) {
                            console.log('Process stopped or completed.');
                            return;
                        }

                        const button = buttons[index];

                        if (clickedButtons.has(button)) {
                            console.log(`Button ${index + 1} already processed. Skipping.`);
                            processButtons(buttons, index + 1);
                            return;
                        }

                        clickedButtons.add(button);
                        console.log(`Clicking edit button ${index + 1}...`);
                        button.click();

                        setTimeout(() => {
                            if (window[stopFlagVarName]) {
                                console.log('Process stopped mid-execution.');
                                return;
                            }

                            const backButton = document.querySelector('button[aria-label="Back"]');
                            if (backButton) {
                                console.log(`Found "Back" button for edit ${index + 1}...`);
                                backButton.click();
                            }

                            processButtons(buttons, index + 1);
                        }, 1500);
                    }

                    function startProcess() {
                        console.log('Starting process...');
                        const editItemButtons = document.querySelectorAll('button[aria-label="EditItem"]');

                        if (editItemButtons.length === 0) {
                            console.warn('No edit buttons found.');
                            return;
                        }

                        console.log(`Found edit buttons: ${editItemButtons.length}.`);
                        processButtons([...editItemButtons], 0); // Start processing
                    }

                    startProcess();
                },
                args: ['stopProcessing']
            });
        }
    });
});

// Stop button logic
document.getElementById('stopProcessBtn').addEventListener('click', () => {
    stopProcessing = true;
    console.log('Stopping process...');

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                func: (stopFlagVarName) => {
                    window[stopFlagVarName] = true;
                },
                args: ['stopProcessing']
            });
        }
    });
});