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
      var sheet = doc.getSheetByName("Main");
      var roommateList = sheet.getRange("D1:K1").getValues();
  
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
  
      if (sheet == null) {
        // Copy boilerplate sheet to make a new monthly sheet
        let boilerplate = doc.getSheetByName("Boilerplate");
        sheet = boilerplate.copyTo(doc);
        sheet.setName(sheetName);
  
        // Add new sheet to totals calculation
        let totalsSheet = doc.getSheetByName("Monthly Receipt Totals");
        let columns = [ 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S' ];
        let totalsColumns = [];
  
        totalsColumns.push(sheetName);
  
        for (let i = 0; i < columns.length; i++) {
          totalsColumns.push("='" + sheetName + "'!" + columns[i] + "1");
        }
  
        totalsColumns.push("='" + sheetName + "'!C1");
  
        totalsColumns = [
          totalsColumns
        ]
  
        totalsSheet.getRange(totalsSheet.getLastRow() + 1, 1, 1, 10).setValues(totalsColumns);
      }
  
      for (var i = 0; i < Object.keys(data.items).length; i++) {      
        let nextRow = sheet.getLastRow() + 1
        let formattedData = formatLineData(data.items[i], data.date);
        let values = [];
        values[0] = [
          Object.values(formattedData)[2],
          Object.values(formattedData)[1],
          Object.values(formattedData)[0],
        ]
  
        sheet.getRange(nextRow, 1, 1, 3).setValues(values);
        insertProportionOwed(sheet, nextRow);
      }
  
      let payeeRow = [
        [ data.date, "Payed by", (-1 * parseFloat(data.total)) ]
      ];
      for (let i = 0; i < parseInt(data.payee); i++) {
        payeeRow[0].push("");
      }
      payeeRow[0].push(1);
  
      let nextRow = sheet.getLastRow() + 1;
      sheet.getRange(nextRow, 1, 1, payeeRow[0].length).setValues(payeeRow);
      insertProportionOwed(sheet, nextRow);
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
    let multiplier = 1;
  
    if (values.flags) {
      multiplier = 1.13;
    }
  
    values.date = date;
    values.amount = "" + (parseInt(values.amount) * multiplier).toFixed(2);
    values.description = values.description.replaceAll("+", " ");
    delete values.flags
    return values;
  }
  
  function insertProportionOwed(sheet, row) {
    let flag = '%'
    let template = '=if(sum(D' + row + ':K' + row + ') > 0, $C' + row + '*' + flag + row + '/(SUMIF($D' + row + ':$K' + row + ',">0")), 0)';
    
    let columns = [ 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K' ];
    let values = [];
  
    for (let i = 0; i < columns.length; i++) {
      values.push(template.replace(flag, columns[i]));
    }
  
    values = [
      values  
    ];
    sheet.getRange(row, 12, 1, 8).setValues(values);
  }