const ProductLineSummary = require("./plinesummary");

class RepProductLineSummary extends ProductLineSummary {
    constructor(repname,prodname) {
        super(prodname);
        this.rep = repname
	}
}
module.exports = RepProductLineSummary;