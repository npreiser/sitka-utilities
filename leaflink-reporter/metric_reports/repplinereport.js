var RepProductLineSummary = require('../metric_items/repplinesummary');
var XLSX = require("xlsx");

class RepProductLineReport {
    constructor() {
        this.reps_map = new Map(); 
        this.rep_array = [];
    }

    processDataLine(obj)
    {
         // By Rep : by Product Line  ========================================
        var byrepbyprod = undefined;
         var validrepname = obj.rep;
         var rep_map = this.reps_map.get(validrepname); // get the reps product map
         if (rep_map == undefined) {
             this.reps_map.set(validrepname, new Map());  // create map just for rep. 
             rep_map = this.reps_map.get(validrepname);
             rep_map.set(obj.product_line, new RepProductLineSummary(validrepname, obj.product_line));
             byrepbyprod = rep_map.get(obj.product_line);
         }
         else {
             byrepbyprod = rep_map.get(obj.product_line);
             if (byrepbyprod == undefined) {
                 rep_map.set(obj.product_line, new RepProductLineSummary(validrepname, obj.product_line));
                 byrepbyprod = rep_map.get(obj.product_line);
             }
         }
         byrepbyprod.appendUnitTotals(obj);
    }

    calculateTotals()
    {
       
        const sorted_repmap = new Map([...this.reps_map].sort());
    
        for (const [key, value] of sorted_repmap.entries()) {  // for each rep , get there prod map.. and calc totals . by productline
            // key is rep name,  value is rep pline map.
            var rep_map = sorted_repmap.get(key); // get the reps prod map
            for (const [key, value] of rep_map.entries()) {
                var prod = rep_map.get(key);  //for each prod, calc totals 
                prod.calcFinalTotals();
            }
    
            // convert this repmap to  an array and append that to our master array 
            const values = Array.from(rep_map.values())
            this.rep_array = this.rep_array.concat(values)
        }
    
    }
   
    buildWorkSheet(workbook)
    {
         // By Rep by Prod
    var worksheet_rep = XLSX.utils.json_to_sheet(this.rep_array, { "header": ["rep"] }); // NOTE,  we need to move repname field to first column...hence <--- 
    worksheet_rep["!cols"] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(workbook, worksheet_rep, "Reps-ProductLines", true);

    }
}
module.exports = RepProductLineReport;
