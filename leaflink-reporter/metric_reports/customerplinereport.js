var CustomerProductLineSummary = require('../metric_items/customerplinesummary');
var XLSX = require("xlsx");

class CustomerProductLineReport {
    constructor() {
        this.customers_map = new Map();
        this.customer_array = [];
    }

    processDataLine(obj) {
        // By customer :  by Rep + by Product Line ========================================
        // NOTE: 11/8/22 each customer, can be serviced by > 1 rep, and the reps can sell same products.. so need to have unqiqe keys for this. 
        // need a entry key for each combintation.. of customer:rep+productline: ... 
      
        // By Customer : by Product Line  ========================================
        var bycustbyprod = undefined;
        var validrepname = obj.rep;
        var cust_map = this.customers_map.get(obj.customer); // get the cust product map
        if (cust_map == undefined) {
            this.customers_map.set(obj.customer, new Map());  // create map just for customer. 
            cust_map = this.customers_map.get(obj.customer);
            cust_map.set(obj.product_line + "_" + validrepname, new CustomerProductLineSummary(obj.customer, validrepname, obj.product_line));
            bycustbyprod = cust_map.get(obj.product_line + "_" + validrepname);
        }
        else {
            bycustbyprod = cust_map.get(obj.product_line + "_" + validrepname);
            if (bycustbyprod == undefined) {
                cust_map.set(obj.product_line + "_" + validrepname, new CustomerProductLineSummary(obj.customer, validrepname, obj.product_line));
                bycustbyprod = cust_map.get(obj.product_line + "_" + validrepname);
            }
        }
        bycustbyprod.appendUnitTotals(obj);
    }

    calculateTotals() {
        const sorted_custmap = new Map([...this.customers_map].sort());
        for (const [key, value] of sorted_custmap.entries()) {  // for each customer , get there prod map.. and calc totals . by productline
            // key is rep name,  value is rep pline map.
            var cust_map = sorted_custmap.get(key);
            for (const [key, value] of cust_map.entries()) {
                var prod = cust_map.get(key);
                prod.calcFinalTotals();
            }
            const values = Array.from(cust_map.values())
            this.customer_array = this.customer_array.concat(values)
        }
    }

    buildWorkSheet(workbook) {
        var worksheet_cust = XLSX.utils.json_to_sheet(this.customer_array, { "header": ["customer", "rep"] }); // NOTE,  we need to move repname field to first column...hence <--- 
        worksheet_cust["!cols"] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(workbook, worksheet_cust, "Customer-ProductLines", true);
    }
}
module.exports = CustomerProductLineReport;
