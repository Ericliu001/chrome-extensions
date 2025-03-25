let stopProcessing = false; // Global flag to stop the process


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
        console.log("TurboTax Extension: Script loaded and processing...");
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
        // Store csv data in chrome.storage.local
        await chrome.storage.session.set({ transactions: data }, () => {
            console.log("TurboTax Extension: Transaction data saved:", data);
        });
    }
});


document.getElementById('startProcessBtn').addEventListener('click', () => {
    stopProcessing = false; // Reset stop flag
    console.log('TurboTax Extension: Extension button clicked.');

    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        if (tabs[0]) {

            // ✅ Load saved transaction data first
            let { transactions } = await chrome.storage.session.get(['transactions']);
            if (!transactions) {
                console.warn("No transaction data found in storage.");
                transactions = {}; // Initialize an empty object to prevent errors
            }
            console.log("TurboTax Extension: Transaction Map loaded:", transactions);


            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                func: (stopFlagVarName, transactions) => {
                    console.log("TurboTax Extension: Transaction data inside executeScript:", transactions); // ✅ Debugging log

                    window[stopFlagVarName] = false; // Store stop flag in the window object

                    // Create a transactionMap from the transactions array
                    let transactionMap = createTransactionMap(transactions);

                    function processTransaction(index) {
                        clickEditButton(index);

                        setTimeout(() => {
                            selectTypeOfInvestmentRSU();
                            let dateAcquired = parseDateAcquired();
                            let dateSold = parseDateSold();
                            let proceeds = readProceeds();
                            let key = generateTransactionKey(dateAcquired, dateSold, proceeds);
                            const row = transactionMap[key]; // Get value from the map

                            if (row !== undefined) {
                                inputCostBasis(row);
                                checkWashSales(row);
                            } else {
                                console.warn(`Key "${key}" not found in transactionMap.`);
                            }

                            setTimeout(() => {
                                clickBackButton(index);
                            }, 1500); //adjust delay
                        }, 5000);
                    }

                    /**
                     * 
                     * @param {Array} csvDataArray 
                     */
                    function createTransactionMap(csvDataArray) {
                        let map = new Map(); // Use an object instead of a Map

                        csvDataArray.forEach(row => {
                            // Ensure required keys exist before constructing the map
                            if (row.DateAcquired && row.DateSold && row.Proceeds && row.CostBasis) {
                                let dateAcquired = new Date(row.DateAcquired); // Convert to Date object
                                let dateSold = new Date(row.DateSold); // Convert to Date object
                                let proceeds = parseFloat(row.Proceeds); // Convert to Number

                                if (!isNaN(dateAcquired) && !isNaN(dateSold) && !isNaN(proceeds)) {
                                    // let key = `${dateAcquired.toDateString()}_${dateSold.toDateString()}_${proceeds}`;
                                    let key = generateTransactionKey(dateAcquired, dateSold, proceeds);
                                    map[key] = row;
                                }
                            }
                        });

                        console.log("TurboTax Extension: Transaction Map created:", map);
                        return map;
                    }

                    function checkWashSales(row) {
                        if (row.WashSaleLoss != null && row.WashSaleLoss.trim() !== "") {
                            waitForElementById("stk-transaction-summary-entry-views-0-fields-11-multiSelect-choices-0", 5000)
                                .then(checkboxInput => {
                                    if (!checkboxInput.checked) {
                                        checkboxInput.click(); 
                                        checkboxInput.dispatchEvent(new Event('change', { bubbles: true }));
                                        console.log("Checkbox checked!");
                                    } else {
                                        console.warn("Checkbox already checked!");
                                    }
                    
                                    // Wait for the input to appear with a flexible selector
                                    return waitForInputField('input[placeholder="$"][data-binding*="WashSaleLossDisallowedAmtPP"]', 10000);
                                })
                                .then(inputField => {
                                    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                                    nativeSetter.call(inputField, parseFloat(row.WashSaleLoss));
                                    inputField.dispatchEvent(new Event('input', { bubbles: true }));
                                    inputField.dispatchEvent(new Event('change', { bubbles: true }));
                    
                                    console.log("Input filled!");
                                })
                                .catch(error => {
                                    console.warn("TurboTax Extension: Failed to find or fill input:", error);
                                });
                        }
                    }

                                        
                    function waitForElementById(id, timeout = 5000) {
                        return new Promise((resolve, reject) => {
                            const start = Date.now();
                            (function check() {
                                const el = document.getElementById(id);
                                if (el) return resolve(el);
                                if (Date.now() - start > timeout) return reject(`Element with id "${id}" not found after ${timeout}ms`);
                                requestAnimationFrame(check);
                            })();
                        });
                    }
                    
                    function waitForInputField(selector, timeout = 5000) {
                        return new Promise((resolve, reject) => {
                            const start = Date.now();
                            (function check() {
                                const el = document.querySelector(selector);
                                if (el) return resolve(el);
                                if (Date.now() - start > timeout) return reject(`Element with selector "${selector}" not found after ${timeout}ms`);
                                requestAnimationFrame(check);
                            })();
                        });
                    }


                    function selectTypeOfInvestmentRSU() {
                        // Locate the select element by its unique data attribute or another selector
                        const selectElem = document.querySelector('[data-automation-id="stk-transaction-summary-entry-views-0-fields-0-staticSwitch-1-choice-InvestmentType"]');

                        // Set the value to the RSU option's value
                        selectElem.value = "stk-transaction-summary-entry-views-0-fields-0-staticSwitch-1-choice-InvestmentType-choices-3";

                        // Dispatch a change event to notify any listeners of the update
                        selectElem.dispatchEvent(new Event('change', { bubbles: true }));
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
                            console.log('TurboTax Extension: Process completed.');
                            return;
                        }

                        if (editItemButtons.length === 0) {
                            console.warn('No edit buttons found.');
                            return;
                        }

                        console.log(`TurboTax Extension: Processing edit button: ${index + 1}/${editItemButtons.length}.`);


                        const editButton = editItemButtons[index];

                        console.log(`TurboTax Extension: Clicking edit button ${index + 1}...`);
                        editButton.click();
                    }

                    function readProceeds() {
                        const inputField = document.getElementById('stk-transaction-summary-entry-views-0-fields-9-input-ProceedsAmtPP');

                        if (inputField) {
                            console.log("TurboTax Extension: Proceeds set to:", inputField.value);
                            let proceeds = parseFloat(inputField.value.replace(/[^0-9.-]+/g, "")); // Convert to Number
                            return proceeds
                        } else {
                            console.warn("TurboTax Extension: Proceeds Input field not found!");
                            return null;
                        }
                    }

                    function parseDateAcquired() {
                        const inputField = document.getElementById("stk-transaction-summary-entry-views-0-fields-5-choice-IsDateAcquiredALiteralInd-choices-0-choiceDetail-input-DateAcquiredDtPP");

                        if (inputField && inputField.value) {
                            const dateString = inputField.value.trim();
                            const parsedDate = new Date(dateString);

                            if (!isNaN(parsedDate.getTime())) {
                                console.log("TurboTax Extension: Parsed Acquire Date:", parsedDate);
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
                                console.log("TurboTax Extension: Parsed Sold Date:", parsedDate);
                                return parsedDate;  // ✅ Return valid date
                            }
                        }

                        console.warn("Invalid or missing DateSold.");
                        return null;  // ✅ Return null instead of undefined
                    }

                    function inputCostBasis(row) {
                        const inputField = document.getElementById('stk-transaction-summary-entry-views-0-fields-9-input-CostBasisAmtPP');

                        if (!inputField) {
                            console.warn("TurboTax Extension: CostBasis input field not found!");
                            return;
                        }

                        inputField.value = parseFloat(row.CostBasis);  // ✅ Set value from transactionMap
                        inputField.dispatchEvent(new Event('input', { bubbles: true })); // ✅ Trigger input event

                        console.log(`TurboTax Extension: Value set to: ${row.CostBasis}`); // ✅ Log actual value
                    }

                    function clickBackButton(index) {

                        if (window[stopFlagVarName]) {
                            console.log('TurboTax Extension: Process stopped mid-execution.');
                            return;
                        }

                        const backButton = document.querySelector('button[aria-label="Back"]');
                        if (backButton) {
                            console.log(`TurboTax Extension: Found "Back" button for edit ${index + 1}...`);
                            backButton.click();
                        } else {
                            console.warn(`TurboTax Extension: "Back" button not found for edit ${index + 1}.`);
                            return;
                        }

                        // Wait for 5 seconds before calling processButtons
                        setTimeout(() => {
                            processTransaction(index + 1);
                        }, 5000);
                    }

                    function startProcess() {
                        console.log('TurboTax Extension: Starting process...');
                        processTransaction(0); // Start processing
                    }

                    startProcess();
                },
                args: ['stopProcessing', transactions]
            });
        }
    });
});

// Stop button logic
document.getElementById('stopProcessBtn').addEventListener('click', () => {
    stopProcessing = true;
    console.log('TurboTax Extension: Stopping process...');

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