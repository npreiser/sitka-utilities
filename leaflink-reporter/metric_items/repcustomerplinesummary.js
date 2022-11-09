class RepCustomerProductSummary {
    constructor(repname, customername) {

        this.rep = repname;
        this.customer = customername;

        this.shatter_1g = 0;
        this.shatter_2g = 0;
        this.blend_cartridge_1g = 0;
        this.pure_live_resin_cartridge = 0;
        this.live_resin_1g = 0;
        this.live_resin_2g = 0;
        this.crumble_inf_prerolls = 0;
        this.cured_resin_1g = 0;
        this.cured_resin_sleeves_2g = 0;
        this.brick_hash = 0;
        this.live_rosin = 0;
        this.wholesale_flower = 0;
        this.apparel = 0;
        this.accessories = 0;
        this.clearance = 0;

        this.unknown = 0;
  
    }

    appendUnitTotals(obj) {

        
       // this.total_gross += obj.line_item_total;
        switch (obj.product_line) {

            case "Disco Dabs - Shatter | 1 gram":
                this.shatter_1g += obj['Qty (Units)'];
                break;
            case "Disco Dabs - Shatter | 2 grams":
                this.shatter_2g += obj['Qty (Units)'];
                break;

            case "Disco Dabs - Live Resin Blend Cartridges (1g)":
                this.blend_cartridge_1g += obj['Qty (Units)'];
                break;
            case "Disco Dabs - Pure Live Resin Cartridges":
                this.pure_live_resin_cartridge += obj['Qty (Units)'];
                break;


            case "Disco Dabs - Live Resin | 1 gram":
                this.live_resin_1g += obj['Qty (Units)'];
                break;

            case "Disco Dabs - Live Resin | 2 grams":
                this.live_resin_2g += obj['Qty (Units)'];
                break;

            case "Disco Dabs - Crumble Infused Prerolls":
                this.crumble_inf_prerolls += obj['Qty (Units)'];
                break;

            case "Disco Dabs - Cured Resin | 1 gram":
                this.cured_resin_1g += obj['Qty (Units)'];
                break;

            case "Disco Dabs - Cured Resin Sleeves | 2 grams":
                this.cured_resin_sleeves_2g += obj['Qty (Units)'];
                break;
            case "Disco Deluxe - Brick Hash":
                this.brick_hash += obj['Qty (Units)'];
                break;
            case "Disco Deluxe Solventless - Live Rosin":
                this.live_rosin += obj['Qty (Units)'];
                break;

            case "Disco Dabs - Accessories":
                this.accessories += obj['Qty (Units)'];
                break;
            case "Disco Dabs - Apparel":
                this.apparel += obj['Qty (Units)'];
                break;
            case "Disco Dabs - Clearance":
                this.clearance += obj['Qty (Units)'];
                break;
            default:
                this.unknown += obj['Qty (Units)'];
                break;
        }

        
    }


}
module.exports = RepCustomerProductSummary;
