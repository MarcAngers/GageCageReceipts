// This is the script running on the google app for this project
// It is copied here for git history only, it does not serve any funtion here.

const numberToMonth = [
  "",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
]

function doPost(e) {
  if (e == null) {
    // replace data with some testing data
    e = {
      "parameters": {
          "items[1][description]": [
            "161552 KS QUE PASA"
          ],
          "items[0][description]": [
            "Member 111969712398"
          ],
          "items[2][amount]": [
            "10.99"
          ],
          "items[1][amount]": [
            "6.39"
          ],
          "date": [
            "2023-08-26"
          ],
          "items[2][description]": [
            "128888 VECTOR JUMBO"
          ],
          "items[0][flags]": [
            " H"
          ],
          "items[0][amount]": [
            "25.99"
          ],
          "items[2][flags]": [
            ""
          ],
          "items[1][flags]": [
            " H"
          ],
          "credit_card_number": [
            "9778"
          ]
      },
      "parameter": {
        "items[2][description]": "128888 VECTOR JUMBO",
        "items[0][flags]": " H",
        "items[2][amount]": "10.99",
        "items[0][amount]": "25.99",
        "items[0][description]": "Member 111969712398",
        "items[1][description]": "161552 KS QUE PASA",
        "payee": "2",
        "date": "2023-08-26",
        "total": "43.37",
        "items[1][amount]": "6.39",
        "items[2][flags]": "",
        "items[1][flags]": " H"
      },
      "queryString": "",
      "contextPath": "",
      "contentLength": 359,
      "postData": {
        "contents": "date=2023-08-26&items%5B0%5D%5Bflags%5D=+H&items%5B0%5D%5Bamount%5D=25.99&items%5B0%5D%5Bdescription%5D=Member+111969712398&items%5B1%5D%5Bflags%5D=+H&items%5B1%5D%5Bamount%5D=6.39&items%5B1%5D%5Bdescription%5D=161552+KS+QUE+PASA&items%5B2%5D%5Bamount%5D=10.99&items%5B2%5D%5Bdescription%5D=128888+VECTOR+JUMBO&items%5B2%5D%5Bflags%5D=&payee=2&total=43.37",
        "length": 359,
        "name": "postData",
        "type": "application/x-www-form-urlencoded"
      }
    }
  }
  
  try {
    record_data(form2Json(e.postData.contents));

    return ContentService.createTextOutput(
        JSON.stringify(
          {
            "result":"success",
            "data": form2Json(e.postData.contents) 
          }
        )
      )
      .setMimeType(ContentService.MimeType.JSON);
  } catch(error) { 
    console.log(error);

    return ContentService
      .createTextOutput(JSON.stringify({"result":"error", "error": error}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = doc.getSheetByName("Running Totals");
    var roommateList = sheet.getRange("D3:L3").getValues();

    return ContentService.createTextOutput(
        JSON.stringify(
          {
            "result":"success",
            "data": roommateList
          }
        )
      )
      .setMimeType(ContentService.MimeType.JSON);
  } catch(error) { 
    console.log(error);

    return ContentService
      .createTextOutput(JSON.stringify({"result":"error", "error": error}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function record_data(data) {
  var lock = LockService.getDocumentLock();
  lock.waitLock(30000); // hold off up to 30 sec to avoid concurrent writing
  
  try {
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    var sheetName = dateToSheetName(data.date);
    var sheet = doc.getSheetByName(sheetName);

    // Create new sheet and add it to the Running Totals
    if (sheet == null) {
      // Copy boilerplate sheet to make a new monthly sheet
      let boilerplate = doc.getSheetByName("Boilerplate");
      sheet = boilerplate.copyTo(doc);
      sheet.setName(sheetName);

      // Add new sheet to running totals
      let totalsSheet = doc.getSheetByName("Running Totals");
      let columns = [ 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L' ];
      let shiftedColumns = [ 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
      let totalsColumns = [];

      totalsColumns.push(sheetName);

      for (let i = 0; i < columns.length; i++) {
        totalsColumns.push("='" + sheetName + "'!" + shiftedColumns[i] + "18");
      }
  
      totalsColumns = [
        totalsColumns
      ]

      totalsSheet.getRange(populatedRowsForColumn(totalsSheet, "C") + 3, 3, 1, 10).setValues(totalsColumns);
    }

    // Add receipt data to the relevant sheet
    // Add receipt totals
    let nextRow = populatedRowsForColumn(sheet, "A") + 6;
    let values = [];
    values[0] = [
      data.date,
      data.total,
      data.credit_card_number,
      '=if(C' + nextRow + '>0, vlookup(text(C' + nextRow + ',"#")&"*",\'Credit Cards\'!$A:$B,2,false), "")'
    ]
    let range = sheet.getRange(nextRow, 1, 1, 4);
    range.setValues(values);
    range.setBackground("#f4cccc");


    // Add receipt data
    for (var i = 0; i < Object.keys(data.items).length; i++) {  
      if (data.items[i] == null)
        continue;
            
      let nextRow = populatedRowsForColumn(sheet, "K") + 3;
      let formattedData = formatLineData(data.items[i], data.date);
      let values = [];
      let itemName = Object.values(formattedData)[1];
      values[0] = [
        '=IFERROR(VLOOKUP("' + itemName + '", Dictionary!A2:B, 2, FALSE), "' + itemName + '")', // Item name
        Object.values(formattedData)[0], // Price
      ];

      let range = sheet.getRange(nextRow, 11, 1, 2);
      range.setValues(values);
      range.setBackground("#fff2cc");

      insertProportionOwed(sheet, nextRow);
    }
  }
  catch(error) {
    console.log(error);
  }
  finally {
    lock.releaseLock();
    return;
  }
}

function form2Json(str)
{
    "use strict";
    var obj,i,pt,keys,j,ev;
    if (typeof form2Json.br !== 'function')
    {
        form2Json.br = function(repl)
        {
            if (repl.indexOf(']') !== -1)
            {
                return repl.replace(/\](.+?)(,|$)/g,function($1,$2,$3)
                {
                    return form2Json.br($2+'}'+$3);
                });
            }
            return repl;
        };
    }
    str = '{"'+(str.indexOf('%') !== -1 ? decodeURI(str) : str)+'"}';
    obj = str.replace(/\=/g,'":"').replace(/&/g,'","').replace(/\[/g,'":{"');
    obj = JSON.parse(obj.replace(/\](.+?)(,|$)/g,function($1,$2,$3){ return form2Json.br($2+'}'+$3);}));
    pt = ('&'+str).replace(/(\[|\]|\=)/g,'"$1"').replace(/\]"+/g,']').replace(/&([^\[\=]+?)(\[|\=)/g,'"&["$1]$2');
    pt = (pt + '"').replace(/^"&/,'').split('&');
    for (i=0;i<pt.length;i++)
    {
        ev = obj;
        keys = pt[i].match(/(?!:(\["))([^"]+?)(?=("\]))/g);
        for (j=0;j<keys.length;j++)
        {
            if (!ev.hasOwnProperty(keys[j]))
            {
                if (keys.length > (j + 1))
                {
                    ev[keys[j]] = {};
                }
                else
                {
                    ev[keys[j]] = pt[i].split('=')[1].replace(/"/g,'');
                    break;
                }
            }
            ev = ev[keys[j]];
        }
    }
    return obj;
}

function dateToSheetName(date) {
  let ymd = date.split("-");
  let monthNumber = parseInt(ymd[1]);

  return numberToMonth[monthNumber] + " " + ymd[0];
}

function formatLineData(values, date) {
  let multiplier = 1.0;

  if (values.flags) {
    multiplier = 1.13;
  }

  values.date = date;
  values.amount = "" + (parseFloat(values.amount) * multiplier).toFixed(2);
  values.description = values.description.replaceAll("+", " ");
  delete values.flags
  return values;
}

// Helper function to get last row, but only paying attention to a single column in the sheet
function populatedRowsForColumn(sheet, col) {
  // Get the values of column
  var vals = sheet.getRange(col + "1:" + col).getValues();
  // Filter out the null elements
  return vals.filter(String).length;
}

function insertProportionOwed(sheet, row) {
  let flag = '%'
  let template = '=if($L' + row + '="", "", if(SUM($N' + row + ':$V' + row + ') > 0, $L' + row + '*' + flag + row + '/(SUMIF($N' + row + ':$V' + row + ',">0")), 0))'
  
  let columns = [ 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V' ];
  let values = [];

  // Push check field
  values.push('=if($L' + row + '="", "", eq(SUM(X' + row + ':AF' + row + '), L' + row + '))');

  // Push total proportion fields
  for (let i = 0; i < columns.length; i++) {
    values.push(template.replace(flag, columns[i]));
  }

  values = [
    values  
  ];

  let range = sheet.getRange(row, 14, 1, 9);
  range.setBackground("#d0e0e3");

  range = sheet.getRange(row, 23, 1, 10);
  range.setValues(values);

  range = sheet.getRange(row, 24, 1, 9);
  range.setBackground("#c9daf8");
}