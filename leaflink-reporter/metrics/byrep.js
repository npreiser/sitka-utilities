const ProductLine2 = require("./byproductline");

class RepByProductLine2 extends ProductLine2 {
    constructor(repname,prodname) {
        super(prodname);
        this.rep = repname
	}
}
module.exports = RepByProductLine2;