var moment = require('moment');

function MetrcPackage(tag, qty, isflower, isdonation, parenttag) {
    var datestr = new moment().format("YYYY-MM-DD");

    this.Tag = tag;
    this.Location = "SNW Outgoing";
    this.Item = "";
    this.Quantity = qty;
    this.UnitOfMeasure = "Each"; 
    if (isflower) //3/25/23
        this.UnitOfMeasure = "Grams";  //support for flower 

    this.PatientLicenseNumber = ""; //blank
    this.Note = ""; //blank;
    this.IsProductionBatch = false;
    this.ProductionBatchNumber = null;  //ignroe, false abovel;
    this.IsTradeSample = isdonation;  //6/30/22 tests
    // "confirmatin required filed??? "
    // this.IsDonation = isdonation;  // same as trade sample;
    this.ProductRequiresRemediation = false;
    this.UseSameItem = true;  //fixed. 
    this.ActualDate = datestr;  // YYYY-MM-DD
    this.Ingredients = [{ "Package": parenttag, "Quantity": qty, "UnitOFMeasure": "Each" }]
    if (isflower) //3/25/23
        this.Ingredients = [{ "Package": parenttag, "Quantity": qty, "UnitOFMeasure": "Grams" }]
}

module.exports = {
    MetrcPackage: MetrcPackage
}

/*
var testpkg = [
    {
        "Tag": "1A401030003F86A000017647",  // new dest tag
        "Location": "SNW Outgoing", // 
        "Item": "",  //sku will provide name,, 
        "Quantity": 10.0,
        "UnitOfMeasure": "Each",
        "PatientLicenseNumber": "",  //ignore
        "Note": "",  // leave blank. 
        "IsProductionBatch": false,  //always false. 
        "ProductionBatchNumber": null,    //null, ignore because false above. 
        "IsDonation": false,  //comes from order same as trade sample !!!! ***** 
        "ProductRequiresRemediation": false,
        "UseSameItem": true,  //setting this to true ***************************
        "ActualDate": "2022-04-29",   //is today... variable.  
        "Ingredients": [   // this part comes from parent prodcut (inventory )
            {
                "Package": "1A401030003F86A000016399",  //parent tag this will come from look of sku from 
                "Quantity": 10.0,
                "UnitOfMeasure": "Each"
            }
        ]
    }
]
*/
