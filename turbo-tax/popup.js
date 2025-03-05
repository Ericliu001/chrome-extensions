let stopProcessing = false; // Global flag to stop the process
let csvDataArray = []; // Store parsed CSV data

document.addEventListener("DOMContentLoaded", function () {
    const fileInput = document.getElementById("csvFileInput");
    const processButton = document.getElementById("processCsvBtn");
    const outputElement = document.getElementById("output");

    processButton.addEventListener("click", function () {
        const file = fileInput.files[0]; // Get selected file
        if (!file) {
            alert("Please select a CSV file.");
            return;
        }

        const reader = new FileReader();
        reader.onload = function (event) {
            const csvContent = event.target.result;
            outputElement.textContent = csvContent; // Display raw CSV data
            parseCSV(csvContent);
        };
        reader.readAsText(file);
    });

    function parseCSV(csv) {
        const rows = csv.split("\n").map(row => row.split(","));
        console.log("Parsed CSV:", rows);
    }
});


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

                    function processTransaction(index) {
                        clickEditButton(index);

                        setTimeout(() => {
                            parseDateAcquired();
                            parseDateSold();
                            readProceeds();
                            inputCostBasis();
                            clickBackButton(index);
                        }, 5000);
                    }

                    function clickEditButton(index) {
                        const editItemButtons = document.querySelectorAll('button[aria-label="EditItem"]');

                        if (editItemButtons.length === 0) {
                            console.warn('No edit buttons found.');
                            return;
                        }

                        console.log(`Processing edit button: ${index}/${editItemButtons.length}.`);

                        if (index >= editItemButtons.length || window[stopFlagVarName]) {
                            console.log('Process stopped or completed.');
                            return;
                        }

                        const editButton = editItemButtons[index];

                        if (clickedButtons.has(editButton)) {
                            console.log(`Button ${index + 1} already processed. Skipping.`);
                            processTransaction(index + 1);
                            return;
                        }

                        clickedButtons.add(editButton);
                        console.log(`Clicking edit button ${index + 1}...`);
                        editButton.click();
                    }

                    function readProceeds() {
                        const inputField = document.getElementById('stk-transaction-summary-entry-views-0-fields-9-input-ProceedsAmtPP');

                        if (inputField) {
                            console.log("Input Value:", inputField.value);
                        } else {
                            console.warn("Input field not found!");
                        }
                    }

                    function parseDateAcquired() {
                        // Find the input field by its ID
                        const inputField = document.getElementById("stk-transaction-summary-entry-views-0-fields-5-choice-IsDateAcquiredALiteralInd-choices-0-choiceDetail-input-DateAcquiredDtPP");

                        if (inputField) {
                            // Get the value of the input field
                            const dateString = inputField.value; // Example: "01/16/2024"

                            // Parse the date string (assuming it's in MM/DD/YYYY format)
                            const parsedDate = new Date(dateString);

                            if (!isNaN(parsedDate.getTime())) {
                                console.log("Parsed Acquire Date:", parsedDate);
                            } else {
                                console.log("Invalid Date");
                            }
                        } else {
                            console.log("Input field not found");
                        }
                    }

                    function parseDateSold() {
                        // Find the input field by its ID
                        const inputField = document.getElementById("stk-transaction-summary-entry-views-0-fields-7-input-DateSoldOrDisposedDtPP");


                        if (inputField) {
                            // Get the value of the input field
                            const dateString = inputField.value; // Example: "01/16/2024"

                            // Parse the date string (assuming it's in MM/DD/YYYY format)
                            const parsedDate = new Date(dateString);

                            if (!isNaN(parsedDate.getTime())) {
                                console.log("Parsed Sold Date:", parsedDate);
                            } else {
                                console.log("Invalid Date");
                            }
                        } else {
                            console.log("Input field not found");
                        }
                    }

                    function inputCostBasis() {
                        const inputField = document.getElementById('stk-transaction-summary-entry-views-0-fields-9-input-CostBasisAmtPP');

                        if (inputField) {
                            inputField.value = "1234.56";  // Set value
                            inputField.dispatchEvent(new Event('input', { bubbles: true })); // Trigger input event
                            console.log("Value set to 1234.56");
                        } else {
                            console.warn("Input field not found!");
                        }
                    }

                    function clickBackButton(index) {

                        if (window[stopFlagVarName]) {
                            console.log('Process stopped mid-execution.');
                            return;
                        }

                        const backButton = document.querySelector('button[aria-label="Back"]');
                        if (backButton) {
                            console.log(`Found "Back" button for edit ${index + 1}...`);
                            backButton.click();
                        } else {
                            console.warn(`"Back" button not found for edit ${index + 1}.`);
                            return;
                        }

                        // Wait for 5 seconds before calling processButtons
                        setTimeout(() => {
                            processTransaction(index + 1);
                        }, 3000);
                    }

                    function startProcess() {
                        console.log('Starting process...');
                        processTransaction(0); // Start processing
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