window.onload = function() {
    var __DEBUG__ = false;
    var receiptData, roommateList;
    var roommateSelect = document.getElementById("roommate-select");

    request = $.ajax({
        url: "https://script.google.com/macros/s/AKfycbxzfKNQ4oj6a-10UGXdEo5KTrEljqtG4mfGbIiZN6dsyK1X2Pq94agwn9b7J6lZiKx_Ng/exec",
        type: "get"
    }).then(result => {
        roommateList = result.data[0];

        for (var i = 0; i < roommateList.length; i++) {
            if (roommateList[i] != "")
                roommateSelect.options.add(new Option(roommateList[i], i));
        }
    });   

    document.getElementById("receiptfile").addEventListener('change', function() {
        if (!this.files[0])
                document.getElementById("upload").disabled = true;

        if (__DEBUG__) {
            fetch('./static/testdata.json')
            .then(response => response.json())
            .then(data => {
                receiptData = formatReceiptData(data);
                console.log(receiptData);
                document.getElementById("output").textContent = JSON.stringify(receiptData, null, 3);
                document.getElementById("upload").disabled = false;
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
                document.getElementById("output").textContent = JSON.stringify(receiptData, null, 3);
                document.getElementById("upload").disabled = false;
            })
            .catch(error => console.error(error));
        }
    });

    document.getElementById("upload").addEventListener("click", function() {
        receiptData.payee = document.getElementById("roommate-select").value;

        request = $.ajax({
            url: "https://script.google.com/macros/s/AKfycbxzfKNQ4oj6a-10UGXdEo5KTrEljqtG4mfGbIiZN6dsyK1X2Pq94agwn9b7J6lZiKx_Ng/exec",
            type: "post",
            data: receiptData
            /*data: {
                "date": "2023-08-26",
                "items": [
                    {
                        "flags": " H",
                        "amount": 25.99,
                        "description": "Member 111969712398",
                    },
                    {
                        "flags": " H",
                        "amount": 6.39,
                        "description": "161552 KS QUE PASA",
                    },
                    {
                        "amount": 10.99,
                        "description": "128888 VECTOR JUMBO",
                        "flags": "",
                    }
                ],
                "payee": document.getElementById("roommate-select").value
            }*/
        }).then(result => console.log(result));
    });
}

function formatReceiptData(data) {
    var formattedData = {};
    
    formattedData.date = data.receipts[0].date;
    formattedData.total = data.receipts[0].total;
    
    var items = data.receipts[0].items;
    for (let i = 0; i < items.length; i++) {
        delete items[i].qty;
        delete items[i].remarks;
        delete items[i].tags;
        delete items[i].unitPrice;
        delete items[i].category;
    }

    formattedData.items = items;
    
    return formattedData;
}