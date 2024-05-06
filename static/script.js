window.onload = function() {
    // Enable debug mode for local development
    var hostname = window.location.hostname;
    var __DEBUG__ = (hostname === "localhost" || hostname === "127.0.0.1");
    var receiptData;

    document.getElementById("receiptfile").addEventListener('change', function() {
        document.getElementById("receiptfile-container").classList.toggle("hidden");
        $(".circle-loader").toggleClass("hidden");

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
            .then(response => response.json())
            .then(data => {
                receiptData = formatReceiptData(data);
                generateTable(receiptData);
                document.getElementById("data-table").classList.toggle("hidden");
                $(".circle-loader").toggleClass("hidden");
            })
            .catch(error => console.error(error));
        }
    });

    document.getElementById("manual-entry").addEventListener("click", function() {
        receiptData = formatReceiptData(null);
        generateTable(receiptData);
        addRow(receiptData);
        document.getElementById("receiptfile-container").classList.toggle("hidden");
        document.getElementById("data-table").classList.toggle("hidden");
    });

    document.getElementById("upload").addEventListener("click", function() {
        // Maybe turn this into an array to loop through if there ends up being more confirmations to check
        let dateCheckConfirm = checkDate(receiptData.date);
        let totalsCheckConfirm = checkTotals(receiptData);
        let emptyFieldCheckConfirm = checkForEmptyFields();

        if (!dateCheckConfirm) {
            dateCheckConfirm = confirm("The selected date is far from today! Are you sure you want to add a receipt from this date (" + receiptData.date + ")?");
        }
        if (!totalsCheckConfirm) {
            totalsCheckConfirm = confirm("The calculated total doesn't match the total from the receipt! Are you sure you want to add this data?");
        }
        if (!emptyFieldCheckConfirm) {
            emptyFieldCheckConfirm = confirm("There are empty fields in your receipt data! Are you sure you want to add an empty field?");
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
        if (data.receipts[0].merchant_name.includes("LOBLAWS")) {   // Loblaws does dates backwards smh, hardcoding a solution
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

function generateTable(data) {
    var dateInput = document.getElementById("date-input");
    dateInput.value = data.date;
    dateInput.addEventListener("change", function() {
        var newValue = this.value;
        data.date = newValue;
    });
    var CCInput = document.getElementById("credit-card-input");
    CCInput.value = data.credit_card_number;
    CCInput.addEventListener("change", function() {
        var newValue = this.value;
        data.credit_card_number = newValue;
    });

    // Create table with receipt data
    var table = document.getElementById("table");
    for (var i = 0; i < data.items.length; i++) {
        var item = data.items[i];
        if (item) {
            // Create a new row
            var row = document.createElement("tr");

            // Create a cell for the description
            var descCell = document.createElement("td");
            // Create a text input for the description
            var descInput = document.createElement("input");
            descInput.type = "text";
            descInput.value = item.description;
            // Add an event listener to update the JSON data when the input changes
            descInput.addEventListener("change", function() {
                // Get the index of the row
                var index = this.parentNode.parentNode.rowIndex - 1;
                // Get the new value
                var newValue = this.value;
                // Update the JSON data
                data.items[index].description = newValue;
            });
            // Append the input to the cell
            descCell.appendChild(descInput);
            // Append the cell to the row
            row.appendChild(descCell);
            
            // Create a cell for the amount
            var amountCell = document.createElement("td");
            // Create a number input for the amount
            var amountInput = document.createElement("input");
            amountInput.type = "number";
            amountInput.value = item.amount.toFixed(2); // Round to 2 decimal places
            // Add an event listener to update the JSON data when the input changes
            amountInput.addEventListener("change", function() {
                // Get the index of the row
                var index = this.parentNode.parentNode.rowIndex - 1;
                // Get the new value
                var newValue = parseFloat(this.value);
                // Update the JSON data
                data.items[index].amount = newValue;

                updateCalculatedSum(data.items);
            });
            // Append the input to the cell
            amountCell.appendChild(amountInput);
            // Append the cell to the row
            row.appendChild(amountCell);
            
            // Create a cell for the flags
            var flagsCell = document.createElement("td");
            // Create a select input for the flags
            var flagsSelect = document.createElement("select");
            // Create two options for the flags
            var option1 = document.createElement("option");
            option1.value = "";
            option1.text = "No";
            var option2 = document.createElement("option");
            option2.value = "Yes";
            option2.text = "Yes";
            // Append the options to the select input
            flagsSelect.appendChild(option1);
            flagsSelect.appendChild(option2);
            // Set the selected option based on the JSON data
            flagsSelect.value = item.flags ? "Yes" : "";
            // Add an event listener to update the JSON data when the input changes
            flagsSelect.addEventListener("change", function() {
                // Get the index of the row
                var index = this.parentNode.parentNode.rowIndex - 1;
                // Get the new value
                var newValue = this.value;
                // Update the JSON data
                data.items[index].flags = newValue;
                updateCalculatedSum(data.items);
            });
            // Append the select input to the cell
            flagsCell.appendChild(flagsSelect);
            // Append the cell to the row
            row.appendChild(flagsCell);

            // Create a cell for the delete row button
            var deleteCell = document.createElement("td");
            deleteCell.classList.add("delete-cell");
            // Create icon for the delete row button
            var deleteSpan = document.createElement("span");
            deleteSpan.classList.add("glyphicon");
            deleteSpan.classList.add("glyphicon-trash");
            // Add an event listener to delete the row when clicked
            deleteSpan.addEventListener("click", function() {              
                let node = this.parentNode.parentNode;
                node.style.color = "red";

                setTimeout(function(node) {
                    if (confirm("Are you sure you want to delete the selected row?")) {
                        // Get the index of the row
                        var index = node.rowIndex - 1;
                        
                        // Delete row
                        data.items.splice(index, 1);
                        node.remove();

                        updateCalculatedSum(data.items);
                    } else {
                        node.style.color = "";
                    }
                }, 0, node);
            });
            // Append the select input to the cell
            deleteCell.appendChild(deleteSpan);
            // Append the cell to the row
            row.appendChild(deleteCell);
            
            // Append the row to the table
            table.appendChild(row);
        }
    }

    var totalInput = document.getElementById("total-input");
    totalInput.value = data.total;
    totalInput.addEventListener("change", function() {
        var newValue = this.value;
        data.total = newValue;
    });

    updateCalculatedSum(data.items);
}

function addRow(data) {
    var table = document.getElementById("table");
    var row = document.createElement("tr");
    var descCell = document.createElement("td");
    var descInput = document.createElement("input");
    descInput.type = "text";
    descInput.value = "";

    // Add an event listener to update the JSON data when the input changes
    descInput.addEventListener("change", function() {
        var index = this.parentNode.parentNode.rowIndex - 1;
        var newValue = this.value;
        data.items[index].description = newValue;
    });

    // Append the input to the cell
    descCell.appendChild(descInput);
    // Append the cell to the row
    row.appendChild(descCell);
    // Create a cell for the amount
    var amountCell = document.createElement("td");
    // Create a number input for the amount
    var amountInput = document.createElement("input");
    amountInput.type = "number";
    amountInput.value = "";
    // Add an event listener to update the JSON data when the input changes
    amountInput.addEventListener("change", function() {
        // Get the index of the row
        var index = this.parentNode.parentNode.rowIndex - 1;
        // Get the new value
        var newValue = parseFloat(this.value);
        // Update the JSON data
        data.items[index].amount = newValue;
        updateCalculatedSum(data.items);
    });
    // Append the input to the cell
    amountCell.appendChild(amountInput);
    // Append the cell to the row
    row.appendChild(amountCell);

    // Create a cell for the flags
    var flagsCell = document.createElement("td");
    // Create a select input for the flags
    var flagsSelect = document.createElement("select");
    // Create two options for the flags
    var option1 = document.createElement("option");
    option1.value = "";
    option1.text = "No";
    var option2 = document.createElement("option");
    option2.value = "Yes";
    option2.text = "Yes";
    // Append the options to the select input
    flagsSelect.appendChild(option1);
    flagsSelect.appendChild(option2);
    // Set the selected option based on the JSON data
    flagsSelect.value = "";
    // Add an event listener to update the JSON data when the input changes
    flagsSelect.addEventListener("change", function() {
        // Get the index of the row
        var index = this.parentNode.parentNode.rowIndex - 1;
        // Get the new value
        var newValue = this.value;
        // Update the JSON data
        data.items[index].flags = newValue;
        updateCalculatedSum(data.items);
    });
    // Append the select input to the cell
    flagsCell.appendChild(flagsSelect);
    // Append the cell to the row
    row.appendChild(flagsCell);

    // Create a cell for the delete row button
    var deleteCell = document.createElement("td");
    deleteCell.classList.add("delete-cell");
    // Create icon for the delete row button
    var deleteSpan = document.createElement("span");
    deleteSpan.classList.add("glyphicon");
    deleteSpan.classList.add("glyphicon-trash");
    // Add an event listener to delete the row when clicked
    deleteSpan.addEventListener("click", function() {
        let node = this.parentNode.parentNode;
        node.style.color = "red";

        setTimeout(function(node) {
            if (confirm("Are you sure you want to delete the selected row?")) {
                // Get the index of the row
                var index = node.rowIndex - 1;
                
                // Delete row
                data.items.splice(index, 1);
                node.remove();

                updateCalculatedSum(data.items);
            } else {
                node.style.color = "";
            }
        }, 0, node);
    });
    // Append the select input to the cell
    deleteCell.appendChild(deleteSpan);
    // Append the cell to the row
    row.appendChild(deleteCell);

    // Append the row to the table
    table.appendChild(row);
    // Create a new empty item in the JSON data
    var newItem = {
        "amount": "",
        "description": "",
        "flags": ""
    };

    data.items.push(newItem);
    console.log(data);
}

function sendToSheet(data) {
    // Send receipt data to the google sheets web app
    request = $.ajax({
        url: "https://script.google.com/macros/s/AKfycbyHfpCOa3usT6Uqhqas99jTTNutsGFCy7F_eoSeMHHO_r13e4r6HXwG_3e8-fykFZS4DQ/exec",
        type: "post",
        data: data,
        beforeSend: function() {
            document.getElementById("data-table").classList.toggle("hidden");
            $(".circle-loader").toggleClass("hidden");
        },
        success: function() {
            $('.circle-loader').toggleClass('load-complete');
            $('.checkmark').toggle();
        }
    });
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

    for (i in items) {
        subtotal += items[i].amount;

        if (items[i].flags)
            tax += 0.13 * items[i].amount;
    }

    let sum = subtotal + tax;

    document.getElementById("calculated-sum").innerHTML = sum.toFixed(2);
    document.getElementById("calculated-subtotal").innerHTML = subtotal.toFixed(2);
    document.getElementById("calculated-tax").innerHTML = tax.toFixed(2);
}