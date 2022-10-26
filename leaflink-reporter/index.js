const fs = require('fs');
const csv = require('fast-csv');
var XLSX = require("xlsx");
const data = []
const csvParser = require("csv-parser");
const result = [];
var workbook = XLSX.utils.book_new();

var ProductLine2 = require('./metrics/byproductline');
var RepByProductLine2 = require('./metrics/byrep');
var Customer = require('./metrics/bycustomer');

//v2. 
var ByRepPline = require('./metrics/byrep_byproductline');

//var valid_reps_list = ["Jordan Hilber", "Nathan Goldberg", "Ryan Fortin", "Josh Koenigsberg",
//    "Shane Wyman", "Mylea Parker", "Courtney Rush", "Alan Pochert"];
var path = require('path');
// grab first arg. 
const myArgs = process.argv.slice(2);



if (myArgs == undefined || myArgs.length != 1) {
    console.log("error, not report given as input");
    return;
}
var OUTPUT_FILE_BASE = "SitkaLL_Report_" + path.parse(myArgs[0]).name;

const SOURCE_FILE = myArgs[0]; 

// transform the csv row 
function transformRow(row) {
    var newrow = {}
    newrow['customer'] = row['customer'];
    newrow['order_date'] = row['order_date'];
    newrow['start_ship_date'] = row['start_ship_date'];
    newrow['ship_city'] = row['ship_city'];
    newrow['rep'] = row['rep'];
    newrow['product_line'] = row['product_line'];
    newrow['Qty (Units)'] = parseFloat(row['Qty (Units)'].replace(',',''));//10/26 trim off  ","
    newrow['product'] = row['product'];
    newrow['manual'] = row['manual'];
    newrow['line_item_total'] = parseFloat(row['line_item_total'].replace('$', '').replace(',', ''));  // trim $ and "," and convert to dec 
    newrow['strain_classification'] = row['strain_classification'];
    newrow['sub_category'] = row['sub_category'];
    newrow['is_sample'] = row['is_sample'];
    return newrow;
}

// Main async loop 
async function runner() {

    await new Promise((resolve, reject) => {
        fs.createReadStream(SOURCE_FILE) //"./data_1.csv")
            .pipe(csvParser())
            .on("data", (data) => {
                var bla = transformRow(data);
                result.push(bla);
            })
            .on("end", () => {
                //console.log(result);
                const worksheet = XLSX.utils.json_to_sheet(result);
                XLSX.utils.book_append_sheet(workbook, worksheet, "Raw_Data", true);

                resolve();
            });
    })

    // METRIC CONTAINER MAPS, 
    var pline_map = new Map();  //by product line: totals .
    var reps_map = new Map();// by repname, product
    var customers_map = new Map(); //by customer, product. 

    var byrep_pline_map = new Map();
    // go through each line in the raw data. 
    for (var i = 0; i < result.length; i++) {
        var obj = result[i];
        // metric targets
        var byproduct = undefined;
        var byrepbyprod = undefined;
        var bycustbyprod = undefined;

        // By Product line  Metric ================
        var byproduct = pline_map.get(obj.product_line);  // get productline obj
        if (byproduct == undefined) {
            pline_map.set(obj.product_line, new ProductLine2(obj.product_line));
            byproduct = pline_map.get(obj.product_line);
        }

        // By rep by Product .========================================
        var validrepname = obj.rep;
        var rep_map = reps_map.get(validrepname); // get the reps product map
        if (rep_map == undefined) {
            reps_map.set(validrepname, new Map());  // create map just for rep. 
            rep_map = reps_map.get(validrepname);
            rep_map.set(obj.product_line, new RepByProductLine2(validrepname, obj.product_line));
            byrepbyprod = rep_map.get(obj.product_line);
        }
        else {
            byrepbyprod = rep_map.get(obj.product_line);
            if (byrepbyprod == undefined) {
                rep_map.set(obj.product_line, new RepByProductLine2(validrepname, obj.product_line));
                byrepbyprod = rep_map.get(obj.product_line);
            }
        }
        //   end by Rep by Prod ================================================

        // By customer by Product .========================================
        var cust_map = customers_map.get(obj.customer); // get the cust product map
        if (cust_map == undefined) {
            customers_map.set(obj.customer, new Map());  // create map just for customer. 
            cust_map = customers_map.get(obj.customer);
            cust_map.set(obj.product_line, new Customer(obj.customer, validrepname, obj.product_line));
            bycustbyprod = cust_map.get(obj.product_line);
        }
        else {
            bycustbyprod = cust_map.get(obj.product_line);
            if (bycustbyprod == undefined) {
                cust_map.set(obj.product_line, new Customer(obj.customer, validrepname, obj.product_line));
                bycustbyprod = cust_map.get(obj.product_line);
            }
        }
        //   end by Customer by Prod ================================================
        byproduct.appendUnitTotals(obj);
        byrepbyprod.appendUnitTotals(obj);
        bycustbyprod.appendUnitTotals(obj);


        //v2 metrics:====================
        // By rep by.. Product line  Metric ================
        var byrep2 = byrep_pline_map.get(validrepname);  // get productline obj
        if (byrep2 == undefined) {
            byrep_pline_map.set(validrepname, new ByRepPline(validrepname, obj.customer));
            byrep2 = byrep_pline_map.get(validrepname);
        }
        byrep2.appendUnitTotals(obj);




    }  // end loop 

    // =========================================== calc by product line totals ===========================
    for (const [key, value] of pline_map.entries()) {
        var prod = pline_map.get(key);
        prod.calcFinalTotals();
    }

    // =====================by reps by prod line ...======================================================
    var rep_array = [];
    const sorted_repmap = new Map([...reps_map].sort());

    for (const [key, value] of sorted_repmap.entries()) {  // for each rep , get there prod map.. and calc totals . by productline
        // key is rep name,  value is rep pline map.
        var rep_map = sorted_repmap.get(key); // get the reps prod map
        for (const [key, value] of rep_map.entries()) {
            var prod = rep_map.get(key);  //for each prod, calc totals 
            prod.calcFinalTotals();
        }

        // convert this repmap to  an array and append that to our master array 
        const values = Array.from(rep_map.values())
        rep_array = rep_array.concat(values)
    }

    //=================== by customer by prod line ...====================================================== 
    var customer_array = [];
    const sorted_custmap = new Map([...customers_map].sort());
    for (const [key, value] of sorted_custmap.entries()) {  // for each customer , get there prod map.. and calc totals . by productline
        // key is rep name,  value is rep pline map.
        var cust_map = sorted_custmap.get(key);
        for (const [key, value] of cust_map.entries()) {
            var prod = cust_map.get(key);
            prod.calcFinalTotals();
        }
        const values = Array.from(cust_map.values())
        customer_array = customer_array.concat(values)
    }

    // ====================== By Prod line output
    const values_bcat = Array.from(pline_map.values())
    var worksheet_by_cat = XLSX.utils.json_to_sheet(values_bcat);
    worksheet_by_cat["!cols"] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(workbook, worksheet_by_cat, "productlines", true);

    // By Rep by Prod
    var worksheet_rep = XLSX.utils.json_to_sheet(rep_array, { "header": ["rep"] }); // NOTE,  we need to move repname field to first column...hence <--- 
    worksheet_rep["!cols"] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(workbook, worksheet_rep, "By Reps By ProductLine", true);

    // ===================== By Customer by Prod Line output =========================
    var worksheet_cust = XLSX.utils.json_to_sheet(customer_array, { "header": ["customer", "rep"] }); // NOTE,  we need to move repname field to first column...hence <--- 
    worksheet_cust["!cols"] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(workbook, worksheet_cust, "By Customer By ProductLine", true);


    // V2 metrics: 
     // ====================== By rep/pline units  output
     const values_brep_pline = Array.from(byrep_pline_map.values())
     var worksheet_by_rep_v2 = XLSX.utils.json_to_sheet(values_brep_pline);
     worksheet_by_rep_v2["!cols"] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
     XLSX.utils.book_append_sheet(workbook, worksheet_by_rep_v2, "byrep_pline_units", true);


    // output file 
    XLSX.writeFile(workbook, OUTPUT_FILE_BASE + ".xlsx");
    console.log("Done with processing ")
}

console.log("Processing Data....")
runner();

