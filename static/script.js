window.onload = function() {
    // Enable debug mode for local development
    var hostname = window.location.hostname;
    var __DEBUG__ = (hostname === "localhost" || hostname === "127.0.0.1");
    var receiptData;

    document.getElementById("receiptfile").addEventListener('change', function() {
        // 1. Hide the upload button container
        document.getElementById("receiptfile-container").classList.add("hidden");

        // 2. RESET LOADER STATE (Crucial for retries)
        // We must clear any previous "Success" or "Error" states before spinning again
        var loader = $(".circle-loader");
        loader.removeClass("hidden");          // Show spinner
        loader.removeClass("load-complete");   // Remove Green ring
        loader.removeClass("load-error");      // Remove Red ring
        $(".checkmark").hide();                // Hide Green Check
        $(".cross").hide();                    // Hide Red X
        document.getElementById("error-message").classList.add("hidden"); // Hide old error text

        if (__DEBUG__) {
            fetch('./static/testdata-loblaws.json')
            .then(response => response.json())
            .then(data => {
                console.log(data);
                receiptData = formatReceiptData(data);
                console.log(receiptData);
                generateTable(receiptData);
                document.getElementById("data-table").classList.toggle("hidden");
                $(".circle-loader").toggleClass("hidden");
            })
            .catch(error => console.error(error));
        } else {          
            var imageFile = document.getElementById("receiptfile").files[0];
            var receiptOcrEndpoint = 'https://ocr.asprise.com/api/v1/receipt';

            var formData = new FormData();
            formData.append('api_key', 'TEST');
            formData.append('recognizer', 'auto');
            formData.append('ref_no', 'ocr_nodejs_123');
            formData.append('file', imageFile);

            fetch(receiptOcrEndpoint, {
                method: 'POST',
                body: formData
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error("Server responded with " + response.status); 
                }
                return response.json();
            })
            .then(data => {
                // Check if the API itself returned an error message in the JSON
                if (!data || !data.receipts || data.receipts.length === 0) {
                     throw new Error("No receipt text found in image.");
                }

                receiptData = formatReceiptData(data);
                generateTable(receiptData);
                
                // Success! Hide loader and show table
                document.getElementById("data-table").classList.remove("hidden");
                $(".circle-loader").addClass("hidden");
            })
            .catch(error => {
                console.error(error);
                // Trigger the Red X animation
                showError("OCR Failed: " + error.message);
                
                // Optional: Show the upload button again so they can retry
                setTimeout(function() {
                    document.getElementById("receiptfile-container").classList.remove("hidden");
                }, 2000); 
            });
        }
    });

    document.getElementById("manual-entry").addEventListener("click", function() {
        receiptData = formatReceiptData(null);
        generateTable(receiptData);
        addRow(receiptData);
        document.getElementById("receiptfile-container").classList.toggle("hidden");
        document.getElementById("data-table").classList.toggle("hidden");
    });

    document.getElementById("upload").addEventListener("click", async function() {
        let dateCheckConfirm = checkDate(receiptData.date);
        let totalsCheckConfirm = checkTotals(receiptData);
        let emptyFieldCheckConfirm = checkForEmptyFields();

        if (!dateCheckConfirm) {
                dateCheckConfirm = await openConfirm(
                'Whoa There!', 
                `The selected date is far from today! Are you sure you want to add a receipt from this date ${receiptData.date }?`, 
                'Yes, submit anyway', 
                false // Not dangerous, just info
            );
        }
        if (!totalsCheckConfirm) {
            totalsCheckConfirm = await openConfirm(
                'Whoa There!', 
                'the calculated total doesn\'t match the total on the receipt! Are you sure you want to add this data?', 
                'Yes, submit anyway', 
                true // Danger! Red button
            );
            if (!confirmed) return;
        }
        if (!emptyFieldCheckConfirm) {
            emptyFieldCheckConfirm = await openConfirm(
                'Whoa There!', 
                'There are empty fields in your receipt data! Do NOT submit this data unless you are 100% sure what you are doing!', 
                'Submit Anyway', 
                true // Danger! Red button
            );
        }

        if  (dateCheckConfirm && totalsCheckConfirm && emptyFieldCheckConfirm) {
            if (__DEBUG__) {
                console.log(receiptData);
                document.getElementById("data-table").classList.toggle("hidden");
                $(".circle-loader").toggleClass("hidden");
            } else {
                sendToSheet(receiptData);
            }
        } else {
            console.log("Upload aborted due to failed user confirmation");
        }
    });

    document.getElementById("add-row").addEventListener("click", function() {
        addRow(receiptData);
    });
}

function formatReceiptData(data) {
    var formattedData = {};
    
    if (data == null) {
        formattedData.date = ""
        formattedData.total = 0;
        formattedData.credit_card_number = "XXXX"
        formattedData.items = [];
    } else {
        if (data.receipts[0].merchant_name.toUpperCase().includes("LOBLAWS")) {   // Loblaws does dates backwards smh, hardcoding a solution
            var DMY = data.receipts[0].date.split("-");
            formattedData.date = "20" + DMY[2]                     // Will need to change this in the year 2100 ;-;
                + "-" + DMY[1]
                + "-" + DMY[0].slice(-2);
        } else {
            formattedData.date = data.receipts[0].date;
        }
        formattedData.total = data.receipts[0].total;
        formattedData.credit_card_number = data.receipts[0].credit_card_number;
        
        var items = data.receipts[0].items;
        for (let i = 0; i < items.length; i++) {
            if (items[i] == null) {
                continue;
            }

            // Account for line items corresponding to a sale/discount
            if (items[i].amount < 0 || items[i].description.includes("TPD/")) {
                // Discount the previous item and remove the sale from the items list
                items[i-1].amount -= Math.abs(items[i].amount);
                delete items[i];
            } else {
                // Remove digist from the item name to get rid of long item codes (messes with a few items like 2% milk, but I think its fine)
                items[i].description = items[i].description.replace(/[0-9\(\)]/g, '');
                // Now remove any preceding spaces in the item name
                items[i].description = items[i].description.trimStart();

                // Some custom logic to handle Loblaws receipts, they don't make it through the OCR perfectly so this should help
                if (items[i].description.includes("HMRJ")) {
                    items[i].description = items[i].description.replace("HMRJ", "");
                    items[i].flags = "H";
                }
                items[i].description = items[i].description.replace("MRJ", "");
                items[i].description = items[i].description.replace("MR.J", "");
                
                // Remove unnecessary data from the item list
                delete items[i].qty;
                delete items[i].remarks;
                delete items[i].tags;
                delete items[i].unitPrice;
                delete items[i].category;
            }
        }

        formattedData.items = items.filter(n => n); // Remove null values (sale items) from receipt data
    }
    
    return formattedData;
}

function createRow(item, tableBody, dataItems, updateCallback) {
    var row = document.createElement("tr");

    // --- Description Cell ---
    var descCell = document.createElement("td");
    var descInput = document.createElement("input");
    descInput.type = "text";
    descInput.value = item.description;
    
    // ROBUSTNESS FIX: Direct Object Reference
    // We update the 'item' object directly. No need to calculate 'rowIndex'.
    descInput.addEventListener("change", function() {
        item.description = this.value;
    });
    descCell.appendChild(descInput);
    row.appendChild(descCell);

    // --- Amount Cell ---
    var amountCell = document.createElement("td");
    var amountInput = document.createElement("input");
    amountInput.type = "number";
    // Handle empty new rows vs existing data
    amountInput.value = (item.amount === "" || item.amount === null) ? "" : parseFloat(item.amount).toFixed(2); 
    
    amountInput.addEventListener("change", function() {
        var newValue = parseFloat(this.value);
        item.amount = isNaN(newValue) ? 0 : newValue;
        updateCallback(); // Recalculate totals immediately
    });
    amountCell.appendChild(amountInput);
    row.appendChild(amountCell);

    // --- Flags Cell ---
    var flagsCell = document.createElement("td");
    var flagsSelect = document.createElement("select");
    var optionNo = new Option("No", "");
    var optionYes = new Option("Yes", "Yes");
    
    flagsSelect.add(optionNo);
    flagsSelect.add(optionYes);
    flagsSelect.value = item.flags ? "Yes" : "";

    flagsSelect.addEventListener("change", function() {
        item.flags = this.value;
        updateCallback();
    });
    flagsCell.appendChild(flagsSelect);
    row.appendChild(flagsCell);

    // --- Delete Cell ---
    var deleteCell = document.createElement("td");
    deleteCell.style.textAlign = "center";
    var deleteSpan = document.createElement("span");
    deleteSpan.className = "glyphicon glyphicon-trash";
    deleteSpan.style.cursor = "pointer"; // UX Enhancement

    deleteSpan.addEventListener("click", function() {
        // Visual feedback
        row.style.backgroundColor = "#ffcccc"; 
        
        // slight timeout to allow UI render
        setTimeout(async function() {
            let confirmed = await openConfirm(
                'Delete Row?', 
                'This action cannot be undone!', 
                'Yes, delete it', 
                false
            );
            if (confirmed) {
                // Remove from the data array
                // We use indexOf here because we have the direct object reference
                var index = dataItems.indexOf(item);
                if (index > -1) {
                    dataItems.splice(index, 1);
                }
                // Remove from DOM
                row.remove();
                updateCallback();
            } else {
                row.style.backgroundColor = "";
            }
        }, 10);
    });
    deleteCell.appendChild(deleteSpan);
    row.appendChild(deleteCell);

    tableBody.appendChild(row);
}

function generateTable(data) {
    // --- 1. Restore Date Input Logic WITH VALIDATION ---
    var dateInput = document.getElementById("date-input");
    dateInput.value = data.date;
    
    var newDateInput = dateInput.cloneNode(true);
    dateInput.parentNode.replaceChild(newDateInput, dateInput);
    
    // Validate immediately on load
    validateDateInput(newDateInput);

    newDateInput.addEventListener("change", function() {
        data.date = this.value;
        validateDateInput(this); // Validate on change
    });

    // --- 2. Restore Credit Card Logic WITH VALIDATION ---
    var CCInput = document.getElementById("credit-card-input");
    CCInput.value = data.credit_card_number;
    
    var newCCInput = CCInput.cloneNode(true);
    CCInput.parentNode.replaceChild(newCCInput, CCInput);

    // Validate immediately on load
    validateCCInput(newCCInput);

    newCCInput.addEventListener("change", function() {
        data.credit_card_number = this.value;
        validateCCInput(this); // Validate on change
    });

    var table = document.getElementById("table");
    // Clean up existing rows if any (except header)
    // Note: It is better to have a <tbody> in your HTML, but this works for your current structure
    while (table.rows.length > 1) {
        table.deleteRow(1);
    }

    // Use specific <tbody> if you add one later, currently appending to table
    // ROBUSTNESS FIX: Loop safety
    data.items.forEach(function(item) {
        if (item) {
            createRow(item, table, data.items, function() {
                updateCalculatedSum(data.items);
            });
        }
    });

    var totalInput = document.getElementById("total-input");
    totalInput.value = data.total;
    totalInput.addEventListener("change", function() {
        var newValue = this.value;
        data.total = newValue;
        updateCalculatedSum(data.items);
    });

    updateCalculatedSum(data.items);
}

function addRow(data) {
    var table = document.getElementById("table");
    
    var newItem = {
        "amount": "", // Initialize as empty string for UI
        "description": "",
        "flags": ""
    };
    data.items.push(newItem);

    createRow(newItem, table, data.items, function() {
        updateCalculatedSum(data.items);
    });
}

function sendToSheet(data) {
    $.ajax({
        url: "https://script.google.com/macros/s/AKfycbyHfpCOa3usT6Uqhqas99jTTNutsGFCy7F_eoSeMHHO_r13e4r6HXwG_3e8-fykFZS4DQ/exec",
        type: "post",
        data: data,
        beforeSend: function() {
            // RESET STATE: Hide error text, reset loader colors
            document.getElementById("error-message").classList.add("hidden");
            document.getElementById("data-table").classList.add("hidden");
            
            var loader = $(".circle-loader");
            loader.removeClass("hidden");
            loader.removeClass("load-complete");
            loader.removeClass("load-error"); // Remove red border
            $(".checkmark").hide();
            $(".cross").hide(); // Hide X
        },
        success: function() {
            $('.circle-loader').addClass('load-complete');
            $('.checkmark').show(); // Show Green Check
            
            // Optional: Success message
            document.getElementById("error-message").textContent = "Receipt Saved!";
            document.getElementById("error-message").style.color = "#27ae60"; // Green text
            document.getElementById("error-message").classList.remove("hidden");
        },
        error: function(jqXHR, textStatus, errorThrown) {
            console.error(textStatus, errorThrown);
            showError("Failed to save to Google Sheets. Please try again.");
        }
    });
}

function showError(message) {
    var loader = $(".circle-loader");
    
    // 1. Ensure loader is visible but stop spinning
    loader.removeClass("hidden");
    loader.addClass("load-error"); // Turns circle Red
    
    // 2. Hide Checkmark, Show X
    $(".checkmark").hide();
    $(".cross").show(); 

    // 3. Display the text
    var msgBox = document.getElementById("error-message");
    msgBox.textContent = message;
    msgBox.classList.remove("hidden");
    
    // 4. Ensure the table is hidden so the error is the focus
    document.getElementById("data-table").classList.add("hidden");
}

function checkDate(receiptDate) {
    let date = new Date(receiptDate);
    let today = new Date();

    // get the difference between the two dates in milliseconds
    let diff = Math.abs(date - today);

    // convert the difference to days
    let days = diff / (1000 * 60 * 60 * 24);

    // check if the difference is within 150 days
    return days <= 150;
}
function checkTotals(receiptData) {
    return document.getElementById("calculated-sum").innerHTML == receiptData.total;
}
function checkForEmptyFields() {
    for (i of document.getElementsByTagName("input")) {
        if (i.type == "file") 
            continue;

        if (i.value == "" || i.value == null) {
            return false;
        }
    }

    return true;
}

function updateCalculatedSum(items) {
    let subtotal = 0;
    let tax = 0;

    for (let item of items) {
        let amt = parseFloat(item.amount) || 0;
        subtotal += amt;

        // Check for "Yes" or "H" (handling your specific logic)
        if (item.flags === "Yes" || item.flags === "H") { 
            tax += amt * 0.13;
        }
    }

    // ... (keep the calculation logic at the top) ...

    let sum = subtotal + tax;

    // Update the text values
    var calcSumSpan = document.getElementById("calculated-sum");
    calcSumSpan.innerHTML = sum.toFixed(2);
    document.getElementById("calculated-subtotal").innerHTML = subtotal.toFixed(2);
    document.getElementById("calculated-tax").innerHTML = tax.toFixed(2);

    // --- UPDATED: Color Logic for the Reverted Layout ---
    var ocrInput = document.getElementById("total-input");
    var ocrTotal = parseFloat(ocrInput.value) || 0;
    
    // Compare with a small margin for floating point errors
    var difference = Math.abs(sum - ocrTotal);
    var isMatch = difference < 0.02;

    // Reset classes
    ocrInput.classList.remove("match", "mismatch");
    calcSumSpan.classList.remove("match", "mismatch");

    // Only apply colors if the user has actually entered a total > 0
    if (ocrTotal > 0) {
        if (isMatch) {
            ocrInput.classList.add("match");
            calcSumSpan.classList.add("match");
        } else {
            ocrInput.classList.add("mismatch");
            calcSumSpan.classList.add("mismatch");
        }
    }
}

function validateDateInput(inputElement) {
    var val = inputElement.value;
    
    // 1. Check if Empty
    if (!val) {
        inputElement.classList.add("invalid-field");
        return false;
    }

    // 2. Check if > 100 days from today
    var selectedDate = new Date(val);
    var today = new Date();
    // Reset time portion to ensure we measure pure days
    today.setHours(0,0,0,0);
    selectedDate.setHours(0,0,0,0);

    var diffTime = Math.abs(today - selectedDate);
    var diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 100) {
        inputElement.classList.add("invalid-field");
        return false;
    } else {
        inputElement.classList.remove("invalid-field");
        return true;
    }
}

function validateCCInput(inputElement) {
    var val = inputElement.value;
    // Check if empty OR if it still has the default "XXXX" placeholder
    if (!val || val === "" || val.toUpperCase() === "XXXX") {
        inputElement.classList.add("invalid-field");
        return false;
    } else {
        inputElement.classList.remove("invalid-field");
        return true;
    }
}

// Helper to replace default confirm() dialog
function openConfirm(title, text, confirmBtnText, isDanger) {
    const dialog = document.getElementById("custom-dialog");
    const titleEl = document.getElementById("dialog-title");
    const textEl = document.getElementById("dialog-text");
    const confirmBtn = document.getElementById("dialog-confirm");
    const cancelBtn = document.getElementById("dialog-cancel");

    // 1. Setup Content
    titleEl.textContent = title;
    textEl.textContent = text;
    confirmBtn.textContent = confirmBtnText || "Yes";

    // 2. Setup Style (Red button for danger, Blue for normal)
    if (isDanger) {
        confirmBtn.classList.add("btn-danger-mode");
        confirmBtn.classList.remove("btn-primary");
    } else {
        confirmBtn.classList.remove("btn-danger-mode");
        confirmBtn.classList.add("btn-primary");
    }

    // 3. Show the modal
    dialog.showModal();

    // 4. Return a Promise that resolves when a button is clicked
    return new Promise((resolve) => {
        // "close" event fires when ANY button in the form is clicked
        dialog.addEventListener("close", () => {
            // dialog.returnValue comes from the button's 'value' attribute
            const result = dialog.returnValue === "true"; 
            resolve(result);
        }, { once: true }); // Important: ensures listener runs only once per open
    });
}