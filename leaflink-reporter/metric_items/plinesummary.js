class ProductLineSummary {
    constructor(name) {
        this.productname = name;
        this.total_units_sold = 0;
        this.total_sample_units = 0;
        this.total_units = 0;

        this.total_gross = 0;  // from sold units

        this.avg_unit_price_sold = 0;
        this.avg_unit_price_total = 0;

        this.sativa = 0;
        this.indica = 0;
        this.hybrid = 0;
        this.unknown = 0;
    }


    appendUnitTotals(obj) {

        this.total_gross += obj.line_item_total;

        if (obj.is_sample.toUpperCase() == 'TRUE') {
            this.total_sample_units += obj['Qty (Units)'];
        }
        else {
            this.total_units_sold += obj['Qty (Units)'];
        }
        this.total_units += obj['Qty (Units)'];   // samples+sold

        switch (obj.strain_classification) {
            case "Sativa":
                this.sativa += obj['Qty (Units)'];
                break;
            case "Indica":
                this.indica += obj['Qty (Units)'];

                break;
            case "Hybrid":
                this.hybrid += obj['Qty (Units)'];
                break;
            default:
                this.unknown += obj['Qty (Units)'];
                break;

        }
    }

    calcFinalTotals() {
        // convert everything to a float, 
        this.total_units = parseFloat(this.total_units);
        this.total_units_sold = parseFloat(this.total_units_sold);

        this.total_gross = parseFloat(this.total_gross.toFixed(2));
        
        var zero = 0;
        if (this.total_units > 0) {
            this.avg_unit_price_total = parseFloat((this.total_gross / this.total_units).toFixed(2));  //avg price including samples. 
        }
        else {
            this.avg_unit_price_total = parseFloat(zero.toFixed(2));
        }

        if (this.total_units_sold > 0) {
            this.avg_unit_price_sold = parseFloat((this.total_gross / this.total_units_sold).toFixed(2));   // avg price , sold units 
        }
        else {
            this.avg_unit_price_sold = parseFloat(zero.toFixed(2));
        }
    }

}
module.exports = ProductLineSummary;
