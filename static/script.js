window.onload = function() {
    var __DEBUG__ = false;
    var receiptData;

    document.getElementById("receiptfile").addEventListener('change', function() {
        document.getElementById("receiptfile-container").classList.toggle("hidden");
        $(".circle-loader").toggleClass("hidden");

        if (__DEBUG__) {
            fetch('./static/testdata.json')
            .then(response => response.json())
            .then(data => {
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
                console.log(receiptData);
                generateTable(receiptData);
                document.getElementById("data-table").classList.toggle("hidden");
                $(".circle-loader").toggleClass("hidden");
            })
            .catch(error => console.error(error));
        }
    });

    document.getElementById("upload").addEventListener("click", function() {
        // Send receipt data to the google sheets web app
        request = $.ajax({
            url: "https://script.google.com/macros/s/AKfycbyHfpCOa3usT6Uqhqas99jTTNutsGFCy7F_eoSeMHHO_r13e4r6HXwG_3e8-fykFZS4DQ/exec",
            type: "post",
            data: receiptData,
            beforeSend: function() {
                document.getElementById("data-table").classList.toggle("hidden");
                $(".circle-loader").toggleClass("hidden");
            },
            success: function() {
                $('.circle-loader').toggleClass('load-complete');
                $('.checkmark').toggle();
            }
        });
    });

    document.getElementById("add-row").addEventListener("click", function() {
        addRow(receiptData);
    });
}

function formatReceiptData(data) {
    var formattedData = {};
    
    formattedData.date = data.receipts[0].date;
    formattedData.total = data.receipts[0].total;
    formattedData.credit_card_number = data.receipts[0].credit_card_number;
    
    var items = data.receipts[0].items;
    for (let i = 0; i < items.length; i++) {
        // Account for line items corresponding to a sale/discount
        if (items[i].amount < 0 || items[i].description.includes("TPD/")) {
            // Discount the previous item and remove the sale from the items list
            items[i-1].amount -= Math.abs(items[i].amount);
            delete items[i];
        } else {
            items[i].description = items[i].description.replace(/[0-9]/g, '');
            
            // Remove unnecessary data from the item list
            delete items[i].qty;
            delete items[i].remarks;
            delete items[i].tags;
            delete items[i].unitPrice;
            delete items[i].category;
        }
    }

    formattedData.items = items;
    
    return formattedData;
}

function generateTable(data) {
    var table = document.getElementById("table");
    // Loop through the items array
    for (var i = 0; i < data.items.length; i++) {
        // Get the current item
        var item = data.items[i];
        // Check if the item is not null
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
            });
            // Append the select input to the cell
            flagsCell.appendChild(flagsSelect);
            // Append the cell to the row
            row.appendChild(flagsCell);
            
            // Append the row to the table
            table.appendChild(row);
        }
    }
}

function addRow(data) {
    var table = document.getElementById("table");
    // Get the last row and column of the table
    var lastRow = table.rows.length - 1;
    var lastColumn = table.rows[0].cells.length;
    // Get the values of the last row
    var lastRowValues = [];
    for (var i = 0; i < lastColumn; i++) {
        lastRowValues.push(table.rows[lastRow].cells[i].children[0].value);
    }

    // Check if the last row has some data in it
    var hasData = false;
    for (var i = 0; i < lastRowValues.length; i++) {
        if (lastRowValues[i]) {
            hasData = true;
            break;
        }
    }

    // If the last row has some data, add a new empty row below it
    if (hasData) {
        var row = document.createElement("tr");
        var descCell = document.createElement("td");
        var descInput = document.createElement("input");
        descInput.type = "text";
        descInput.value = "";

        // Add an event listener to update the JSON data when the input changes
        descInput.addEventListener("change", function() {
            var index = this.parentNode.parentNode.rowIndex + 1;
            var newValue = this.value;
            data.items[index].description = newValue;
            console.log(data);
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
            var index = this.parentNode.parentNode.rowIndex + 1;
            // Get the new value
            var newValue = parseFloat(this.value);
            // Update the JSON data
            data.items[index].amount = newValue;
            // Log the updated JSON data
            console.log(data);
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
            var index = this.parentNode.parentNode.rowIndex + 1;
            // Get the new value
            var newValue = this.value;
            // Update the JSON data
            data.items[index].flags = newValue;
            // Log the updated JSON data
            console.log(data);
        });
        // Append the select input to the cell
        flagsCell.appendChild(flagsSelect);
        // Append the cell to the row
        row.appendChild(flagsCell);
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
}