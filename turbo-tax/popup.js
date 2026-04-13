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

                    // Track which page we should be on (read from current pagination state)
                    let targetPage = getCurrentPage();
                    console.log(`TurboTax Extension: Starting on page ${targetPage}`);

                    /**
                     * Reads the current page number from the pagination button's aria-label.
                     * e.g. "Go to next page, currently on page 4" → 4
                     */
                    function getCurrentPage() {
                        // Try the "next page" button first
                        const nextBtn = document.querySelector('button[aria-label^="Go to next page"]');
                        if (nextBtn) {
                            const match = nextBtn.getAttribute('aria-label').match(/currently on page (\d+)/);
                            if (match) return parseInt(match[1]);
                        }
                        // Fall back to "previous page" button (in case we're on the last page)
                        const prevBtn = document.querySelector('button[aria-label^="Go to previous page"]');
                        if (prevBtn) {
                            const match = prevBtn.getAttribute('aria-label').match(/currently on page (\d+)/);
                            if (match) return parseInt(match[1]);
                        }
                        return 1; // Default
                    }

                    /**
                     * Jumps directly to targetPage using the page number button.
                     * Calls callback() once we arrive, or calls onFail() if the button doesn't exist.
                     */
                    function navigateToPage(page, callback, onFail) {
                        const current = getCurrentPage();
                        console.log(`TurboTax Extension: Currently on page ${current}, target is page ${page}`);

                        if (current === page) {
                            callback();
                            return;
                        }

                        // Click the direct page number button: aria-label="Go to Page N"
                        const pageBtn = document.querySelector(`button[aria-label="Go to Page ${page}"]`);
                        if (pageBtn) {
                            console.log(`TurboTax Extension: Clicking page ${page} button directly...`);
                            pageBtn.click();
                            setTimeout(() => {
                                callback();
                            }, 3000);
                        } else {
                            console.log(`TurboTax Extension: Page ${page} button not found. Last page is likely ${current}.`);
                            if (onFail) onFail();
                        }
                    }

                    function processTransaction(index) {
                        const clicked = clickEditButton(index);

                        if (!clicked) {
                            if (window[stopFlagVarName]) {
                                console.log('TurboTax Extension: Process stopped by user.');
                                return;
                            }
                            // All items on this page are done — advance to next page
                            targetPage++;
                            console.log(`TurboTax Extension: Page done. Advancing to page ${targetPage}...`);
                            navigateToPage(targetPage, () => {
                                // Verify we actually reached the new page
                                if (getCurrentPage() === targetPage) {
                                    processTransaction(0);
                                } else {
                                    console.log('TurboTax Extension: All transactions processed across all pages.');
                                }
                            }, () => {
                                console.log('TurboTax Extension: All transactions processed across all pages.');
                            });
                            return;
                        }

                        setTimeout(() => {
                            try {
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
                            } catch (error) {
                                console.error(`TurboTax Extension: Error processing transaction at index ${index}:`, error);
                            }
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
                    /**
                     * Returns true if an edit button was clicked, false if page is done.
                     */
                    function clickEditButton(index) {
                        if (window[stopFlagVarName]) {
                            console.log('TurboTax Extension: Process stopped by user.');
                            return false;
                        }

                        const editItemButtons = document.querySelectorAll('button[aria-label="EditItem"]');

                        if (editItemButtons.length === 0 || index >= editItemButtons.length) {
                            console.log('TurboTax Extension: All items on this page processed.');
                            return false; // Signal that this page is done
                        }

                        console.log(`TurboTax Extension: Processing edit button: ${index + 1}/${editItemButtons.length}.`);

                        const editButton = editItemButtons[index];
                        console.log(`TurboTax Extension: Clicking edit button ${index + 1}...`);
                        editButton.click();
                        return true;
                    }

                    /**
                     * Attempts to navigate to the next page of transactions.
                     * Returns true if navigation was triggered, false if on last page.
                     */
                    function goToNextPage() {
                        // Find the next-page button by aria-label prefix
                        const nextPageBtn = document.querySelector('button[aria-label^="Go to next page"]');

                        if (!nextPageBtn) {
                            console.log('TurboTax Extension: No next page button found. All pages complete.');
                            return false;
                        }

                        // Check if the button is disabled
                        if (nextPageBtn.disabled || nextPageBtn.getAttribute('aria-disabled') === 'true') {
                            console.log('TurboTax Extension: Next page button is disabled. All pages complete.');
                            return false;
                        }

                        console.log('TurboTax Extension: Navigating to next page...');
                        nextPageBtn.click();
                        return true;
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

                        // Wait for page to reload after Back, then re-navigate to our target page
                        setTimeout(() => {
                            const currentPage = getCurrentPage();
                            if (currentPage !== targetPage) {
                                console.log(`TurboTax Extension: Back button reset to page ${currentPage}. Re-navigating to page ${targetPage}...`);
                                navigateToPage(targetPage, () => {
                                    processTransaction(index + 1);
                                }, () => {
                                    console.error(`TurboTax Extension: Failed to navigate back to page ${targetPage}.`);
                                });
                            } else {
                                processTransaction(index + 1);
                            }
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