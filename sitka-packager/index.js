var moment = require('moment');
const fs = require('fs');
const path = require('path');
var restutils = require('./restutils');
const prompts = require('prompts');
const REUP_BASE_TAG = "1A401030003F86A"
let metrcpkg = require('./metrcpackage');
let MetrcPkg = metrcpkg.MetrcPackage;
// NOTE,  remainder postfix eg. = 000017647     9 chars
// you have atleast one param: 
var accepted_orders = [];
var orders_map = new Object();
var lineitemcount = 0;
var master_product_map = undefined;


// This function creates all the blobs per order , starting at start tag.
// the blobs are placed into the order_map, on a per order  
function constructMetrcPackageBlob(starttag) {

    var currenttag = starttag;
    for (var key in orders_map) {  // for each accepted order,

        //if(tagcnt > cnt)
          //  break;  // make sure to break out of orders too.. 
        var order_packages = [];
        var order = orders_map[key]
        for (var li = 0; li < order.line_items.length; li++)  // for each line item in the order. 
        {
        
            var lineitem = order.line_items[li];
            var product_detail = lineitem.frozen_data.product;
            var sku = product_detail.sku;
            // check sku is in master prod map
           //fetch parent tag 
           var reup_prod_info = master_product_map[sku];

           var qty = parseFloat(lineitem.quantity);
            // convert tag to full tag which is +9 chars long beyond base.
            // add a 0 in front of current tag... 
            var strtag = currenttag.toString();
            while(strtag.length < 9)
                strtag = "0"+strtag;
            
           let pkg = new MetrcPkg(REUP_BASE_TAG+strtag, qty, lineitem.is_sample,reup_prod_info.TAG);

            //var m1 = JSON.stringify(pkg);
            order_packages.push(pkg);
            currenttag++;  // inc tag number 
           
        }
        order.metrc_payload = order_packages;//store in object within map. 
    }
}



async function runner() {
    console.log("Fetching Product Master list from Google Sheet ")
    await restutils.getProductMasterList(function (status, productmap) {
        if (status == 'success') {
            console.log("Got Product master list from google. Stored");
            master_product_map = productmap;
        }
        else {
            console.log("could not get product master list, error")
            return;
        }
    })


    console.log("Fetching Accepted order list.  ")
    await restutils.getLeaflinkAcceptedOrders(function (status, data) {
        // returned data is an array of orders
        if (status == 'success')
            accepted_orders = data;
        else {
            console.log("could not get accepted orders, error")
            return;
        }
    })

    console.log("Fetching Order info for each accepted order now, order count: " + accepted_orders.length)
    for (var i = 0; i < accepted_orders.length; i++) {
        console.log("getting order number: " + accepted_orders[i].number);
        await restutils.getLeaflinkOrderInfo(accepted_orders[i].number, function (status, data) {
            if (status == 'success')   // note, data is an array, which we want index 0 of. 
            {
                orders_map[accepted_orders[i].number] = data[0];  // store it.. 
                lineitemcount += data[0].line_items.length;
            }
            else {
                console.log("could not get order info, error")
                return;
            }

        })
    }

    console.log("Done fetching all order info... ");
    console.log("Total line items counted: " + lineitemcount);
    console.log("Checking all ordered products are in inventroy database")

    // for debug ,  remove all order except the ones created by chris..********************
    var cnt = 0;
    for (var key in orders_map) {  // for each accepted order,
        var order = orders_map[key];
        var customername = order.customer.display_name;
        if(!customername.includes("Noble Lord Bauer"))
            delete orders_map[key];
        cnt++;
    }
    //end debug. ******************************************************************************


    // Validate all line items are in the inventory list 
    for (var key in orders_map) {  // for each accepted order,
        var order = orders_map[key]
        //console.log(JSON.stringify(order, null, 2))
        for (var li = 0; li < order.line_items.length; li++)  // for each line item in the order. 
        {
            var lineitem = order.line_items[li];
            var product_detail = lineitem.frozen_data.product;
            var sku = product_detail.sku;
            // check sku is in master prod map
            if (master_product_map[sku] == undefined) {
                console.log("Error,  could not find product: " + sku + "  name: " + product_detail.name);
                break;
            }
        }
        // for debug, 
        //break; // break out after 1 
    }

    const questions = [
        {
            type: 'text',
            name: 'start_tag',
            message: 'Start Tag #'
        }
    ];
//// PROMPT IS HERE !!! **************************************************
    //const response = await prompts(questions);
    //console.log(response.start_tag);
    // validate start tag here. 
    // Add check for tag count limit check here !!!!!!!!!!!!!!!!!!
    console.log("Tagging Orders ");
    var starttag = "17650";  // for debug. 
    constructMetrcPackageBlob(starttag);  // puts blobs into orders map.. 
   
    for (var key in orders_map) {  // for each accepted order,
        var order = orders_map[key];
        console.log("Tagging Order: "+ order.short_id)
        //console.log(JSON.stringify(order.metrc_payload, null, 2));

        await restutils.createMetrcPackages(order.metrc_payload, function (status) {
            var check = status;
            console.log("Result: " + status)
        })
    }
}

runner();
