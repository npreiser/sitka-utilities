var ProductLineSummary = require('../metric_items/plinesummary');
var XLSX = require("xlsx");

class ProductLineReport {
    constructor(name) {
        this.pline_map = new Map(); 
        this.name = name;  //tab name, 
    }

    processDataLine(obj)
    {
        // By Product line totals ================
        var byproduct = this.pline_map.get(obj.product_line);  // get productline obj
        if (byproduct == undefined) {
            this.pline_map.set(obj.product_line, new ProductLineSummary(obj.product_line));
            byproduct = this.pline_map.get(obj.product_line);
        }

        byproduct.appendUnitTotals(obj);
    }

    calculateTotals()
    {
        for (const [key, value] of this.pline_map.entries()) {
            var prod = this.pline_map.get(key);
            prod.calcFinalTotals();
        }
    }
   
    buildWorkSheet(workbook)
    {
        const values_bcat = Array.from(this.pline_map.values())
        var worksheet_by_cat = XLSX.utils.json_to_sheet(values_bcat);
        worksheet_by_cat["!cols"] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
        //return worksheet_by_cat; 
        XLSX.utils.book_append_sheet(workbook, worksheet_by_cat, "ProductLineSummary", true);
    }
}
module.exports = ProductLineReport;
