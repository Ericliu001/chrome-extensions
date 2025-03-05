let stopProcessing = false; // Global flag to stop the process
let csvDataArray = []; // Store parsed CSV data


/**
 * CSV format:
 * Term,Description,CUSIP,Quantity,DateAcquired,DateSold,Proceeds,CostBasis,WashSaleLoss
 * Short Term,UBER TECHNOLOGIES INC,90353T100,36.000000,01/16/24,01/17/24,2262.23,2291.40,29.17
 */
document.addEventListener("DOMContentLoaded", async function () {
    const fileInput = document.getElementById("csvFileInput");
    const processButton = document.getElementById("processCsvBtn");
    const outputElement = document.getElementById("output");

    processButton.addEventListener("click", async function () {
        console.log("Script loaded and processing...");
        const file = fileInput.files[0]; // Get selected file
        if (!file) {
            alert("Please select a CSV file.");
            return;
        }

        const reader = new FileReader();
        reader.onload = async function (event) {
            const csvContent = event.target.result;
            outputElement.textContent = csvContent; // Display raw CSV data
            await parseCSV(csvContent);
            await createTransactionMap(csvDataArray);
        };
        reader.readAsText(file);
    });

    async function parseCSV(csv) {
        const rows = csv.split("\n").map(row => row.split(","));

        if (rows.length < 2) {
            console.warn("CSV is empty or improperly formatted.");
            return;
        }

        const headers = rows[0].map(header => header.trim()); // Extract headers and trim spaces
        const data = [];

        for (let i = 1; i < rows.length; i++) {
            const values = rows[i].map(value => value.trim()); // Trim spaces from each value

            let rowObject = {};
            headers.forEach((header, index) => {
                rowObject[header] = values[index];
            });

            data.push(rowObject);
        }

        csvDataArray = data; // Store parsed data globally
    }

    /**
     * 
     * @param {Array} csvDataArray 
     */
    async function createTransactionMap(csvDataArray) {
        let transactionObject = {}; // Use an object instead of a Map

        csvDataArray.forEach(row => {
            // Ensure required keys exist before constructing the map
            if (row.DateAcquired && row.DateSold && row.Proceeds && row.CostBasis) {
                let dateAcquired = new Date(row.DateAcquired); // Convert to Date object
                let dateSold = new Date(row.DateSold); // Convert to Date object
                let proceeds = parseFloat(row.Proceeds); // Convert to Number

                if (!isNaN(dateAcquired) && !isNaN(dateSold) && !isNaN(proceeds)) {
                    // let key = `${dateAcquired.toDateString()}_${dateSold.toDateString()}_${proceeds}`;
                    let key = generateTransactionKey(dateAcquired, dateSold, proceeds);
                    let value = parseFloat(row.CostBasis); // Convert to Number

                    transactionObject[key] = value;
                }
            }
        });

        // Store transaction data in chrome.storage.local
        await chrome.storage.session.set({ transactionMap: transactionObject }, () => {
            console.log("Transaction Map saved:", transactionObject);
        });
    }

    function generateTransactionKey(dateAcquired, dateSold, proceeds) {
        if (!dateAcquired || !dateSold || isNaN(proceeds)) {
            console.warn("Invalid key parameters:", { dateAcquired, dateSold, proceeds });
            return null;
        }
        return `${getFormattedDate(dateAcquired)}_${getFormattedDate(dateSold)}_${proceeds}`;
    }

    function getFormattedDate(date = new Date()) {
        return `${date.getFullYear()}_${String(date.getMonth() + 1).padStart(2, '0')}_${String(date.getDate()).padStart(2, '0')}`;
    }
});


document.getElementById('startProcessBtn').addEventListener('click', () => {
    stopProcessing = false; // Reset stop flag
    console.log('Extension button clicked.');

    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        if (tabs[0]) {

            // ✅ Load saved transaction data first
            let { transactionMap } = await chrome.storage.session.get(['transactionMap']);
            if (!transactionMap) {
                console.warn("No transaction data found in storage.");
                transactionMap = {}; // Initialize an empty object to prevent errors
            }
            console.log("Transaction Map loaded:", transactionMap);


            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                func: (stopFlagVarName, transactionMap) => {
                    console.log("Transaction Map inside executeScript:", transactionMap); // ✅ Debugging log
           
                    window[stopFlagVarName] = false; // Store stop flag in the window object

                    function processTransaction(index) {
                        clickEditButton(index);

                        setTimeout(() => {
                            let dateAcquired = parseDateAcquired();
                            let dateSold = parseDateSold();
                            let proceeds = readProceeds();
                            // let key = `${dateAcquired.toDateString()}_${dateSold.toDateString()}_${proceeds}`;
                            let key = generateTransactionKey(dateAcquired, dateSold, proceeds);
                            inputCostBasis(key);
                            clickBackButton(index);
                        }, 5000);
                    }

                    function generateTransactionKey(dateAcquired, dateSold, proceeds) {
                        if (!dateAcquired || !dateSold || isNaN(proceeds)) {
                            console.warn("Invalid key parameters:", { dateAcquired, dateSold, proceeds });
                            return null;
                        }
                        return `${getFormattedDate(dateAcquired)}_${getFormattedDate(dateSold)}_${proceeds}`;
                    }

                    function getFormattedDate(date = new Date()) {
                        return `${date.getFullYear()}_${String(date.getMonth() + 1).padStart(2, '0')}_${String(date.getDate()).padStart(2, '0')}`;
                    }
                    function clickEditButton(index) {
                        const editItemButtons = document.querySelectorAll('button[aria-label="EditItem"]');
                      
                        if (index >= editItemButtons.length || window[stopFlagVarName]) {
                            console.log('Process completed.');
                            return;
                        }

                        if (editItemButtons.length === 0) {
                            console.warn('No edit buttons found.');
                            return;
                        }

                        console.log(`Processing edit button: ${index + 1}/${editItemButtons.length}.`);


                        const editButton = editItemButtons[index];
                        
                        console.log(`Clicking edit button ${index + 1}...`);
                        editButton.click();
                    }

                    function readProceeds() {
                        const inputField = document.getElementById('stk-transaction-summary-entry-views-0-fields-9-input-ProceedsAmtPP');

                        if (inputField) {
                            console.log("Input Value:", inputField.value);
                            let proceeds = parseFloat(inputField.value.replace(/[^0-9.-]+/g, "")); // Convert to Number
                            return proceeds
                        } else {
                            console.warn("Input field not found!");
                            return null;
                        }
                    }

                    function parseDateAcquired() {
                        const inputField = document.getElementById("stk-transaction-summary-entry-views-0-fields-5-choice-IsDateAcquiredALiteralInd-choices-0-choiceDetail-input-DateAcquiredDtPP");

                        if (inputField && inputField.value) {
                            const dateString = inputField.value.trim();
                            const parsedDate = new Date(dateString);

                            if (!isNaN(parsedDate.getTime())) {
                                console.log("Parsed Acquire Date:", parsedDate);
                                return parsedDate;  // ✅ Return valid date
                            }
                        }

                        console.warn("Invalid or missing DateAcquired.");
                        return null;  // ✅ Return null instead of undefined
                    }

                    function parseDateSold() {
                        const inputField = document.getElementById("stk-transaction-summary-entry-views-0-fields-7-input-DateSoldOrDisposedDtPP");

                        if (inputField && inputField.value) {
                            const dateString = inputField.value.trim();
                            const parsedDate = new Date(dateString);

                            if (!isNaN(parsedDate.getTime())) {
                                console.log("Parsed Sold Date:", parsedDate);
                                return parsedDate;  // ✅ Return valid date
                            }
                        }

                        console.warn("Invalid or missing DateSold.");
                        return null;  // ✅ Return null instead of undefined
                    }

                    function inputCostBasis(key) {
                        const inputField = document.getElementById('stk-transaction-summary-entry-views-0-fields-9-input-CostBasisAmtPP');

                        if (!inputField) {
                            console.warn("Input field not found!");
                            return;
                        }

                        console.log(`Setting value for key: ${key}`);
                        console.log(`Transaction Map:`, transactionMap);
                        const costBasis = transactionMap[key]; // Get value from the map

                        if (costBasis !== undefined) {
                            inputField.value = costBasis;  // ✅ Set value from transactionMap
                            inputField.dispatchEvent(new Event('input', { bubbles: true })); // ✅ Trigger input event

                            console.log(`Value set to: ${costBasis}`); // ✅ Log actual value
                        } else {
                            console.warn(`Key "${key}" not found in transactionMap.`);
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
                        }, 5000);
                    }

                    function startProcess() {
                        console.log('Starting process...');
                        processTransaction(0); // Start processing
                    }

                    startProcess();
                },
                args: ['stopProcessing', transactionMap]
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