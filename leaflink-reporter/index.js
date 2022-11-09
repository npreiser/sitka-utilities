const fs = require('fs');
var XLSX = require("xlsx");
const csvParser = require("csv-parser");
const result = [];
var workbook = XLSX.utils.book_new();
var ProductLineReport = require("./metric_reports/productlinereport");
var RepProductLineReport = require("./metric_reports/repplinereport");
var CustomerProductLineReport = require("./metric_reports/customerplinereport");
var RepCustomerCategoryReport = require("./metric_reports/repcustomercategoryreport");
var path = require('path');
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
    newrow['Qty (Units)'] = parseFloat(row['Qty (Units)'].replace(',', ''));//10/26 trim off  ","
    newrow['product'] = row['product'];
    newrow['manual'] = row['manual'];
    newrow['line_item_total'] = parseFloat(row['line_item_total'].replace('$', '').replace(',', ''));  // trim $ and "," and convert to dec 
    newrow['strain_classification'] = row['strain_classification'];
    newrow['sub_category'] = row['sub_category'];
    newrow['is_sample'] = row['is_sample'];
    return newrow;
}

// Main async loop 
var productline_report = new ProductLineReport();
var repproductline_report = new RepProductLineReport();
var customerproductline_report = new CustomerProductLineReport();
var repcustomerproductcategory_report = new RepCustomerCategoryReport();

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

    // go through each line in the raw data. 
    for (var i = 0; i < result.length; i++) {
        var obj = result[i];

        productline_report.processDataLine(obj);
        repproductline_report.processDataLine(obj);
        customerproductline_report.processDataLine(obj);
        repcustomerproductcategory_report.processDataLine(obj);

    }  // end loop 

    productline_report.calculateTotals();
    repproductline_report.calculateTotals();
    customerproductline_report.calculateTotals();
    repcustomerproductcategory_report.calculateTotals();

    // build worksheet, append workbook
    productline_report.buildWorkSheet(workbook);
    repproductline_report.buildWorkSheet(workbook);
    customerproductline_report.buildWorkSheet(workbook);
    repcustomerproductcategory_report.buildWorkSheet(workbook);

    // output file 
    XLSX.writeFile(workbook, OUTPUT_FILE_BASE + ".xlsx");
    console.log("Done with processing ")
}

console.log("Processing Data....")
runner();

