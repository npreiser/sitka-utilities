const RepByProductLine2 = require("./byrep");

class Customer extends RepByProductLine2 {
    constructor(customername, repname,prodname) {
        super(repname, prodname);
        this.customer = customername;	
	}
}
module.exports = Customer;