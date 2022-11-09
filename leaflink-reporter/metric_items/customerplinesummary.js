const RepProductLineSummary = require("./repplinesummary");

class CustomerProductLineSummary extends RepProductLineSummary {
    constructor(customername, repname,prodname) {
        super(repname, prodname);
        this.customer = customername;	
	}
}
module.exports = CustomerProductLineSummary;