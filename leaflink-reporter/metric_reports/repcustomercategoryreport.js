var RepCustomerProductSummary = require('../metric_items/repcustomerplinesummary');
var XLSX = require("xlsx");

class RepCustomerCategoryReport {
    constructor() {
        this.byrep_pline_map = new Map();
        this.rep_cust_array = [];
    }

    processDataLine(obj) {

        var byrepbycustomer = undefined;
        var validrepname = obj.rep;

        var rep_map = this.byrep_pline_map.get(validrepname); // get the reps product map
        if (rep_map == undefined) {
            this.byrep_pline_map.set(validrepname, new Map());  // create map just for rep. 
            rep_map = this.byrep_pline_map.get(validrepname);
            rep_map.set(obj.customer, new RepCustomerProductSummary(validrepname, obj.customer));
            byrepbycustomer = rep_map.get(obj.customer);
        }
        else {
            byrepbycustomer = rep_map.get(obj.customer);
            if (byrepbycustomer == undefined) {
                rep_map.set(obj.customer, new RepCustomerProductSummary(validrepname, obj.customer));
                byrepbycustomer = rep_map.get(obj.customer);
            }
        }
        byrepbycustomer.appendUnitTotals(obj);
    }

    calculateTotals() {
        const sorted_repcustmap = new Map([...this.byrep_pline_map].sort());
        for (const [key, value] of sorted_repcustmap.entries()) {  // for each rep , get there prod map.. and calc totals . by productline
            // key is rep name,  value is rep pline map.
            var rep_map = sorted_repcustmap.get(key); // get the reps cust map
            // convert this repmap to  an array and append that to our master array 
            const values = Array.from(rep_map.values())
            this.rep_cust_array = this.rep_cust_array.concat(values)
        }
    }

    buildWorkSheet(workbook) {
        var worksheet_by_rep_v2 = XLSX.utils.json_to_sheet(this.rep_cust_array);
        worksheet_by_rep_v2["!cols"] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(workbook, worksheet_by_rep_v2, "Rep-Customer-CategoryBreakout", true);
    }
}
module.exports = RepCustomerCategoryReport;
