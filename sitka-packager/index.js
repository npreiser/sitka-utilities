var moment = require('moment');
const fs = require('fs');
const path = require('path');
var restutils = require('./restutils');
const prompts = require('prompts');
const REUP_BASE_TAG = "1A401030003F86A"
let metrcpkg = require('./metrcpackage');
const { Console } = require('console');
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
        try {
           
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
                while (strtag.length < 9)
                    strtag = "0" + strtag;

                let pkg = new MetrcPkg(REUP_BASE_TAG + strtag, qty, lineitem.is_sample, reup_prod_info.TAG);

                //var m1 = JSON.stringify(pkg);
                order_packages.push(pkg);
                currenttag++;  // inc tag number 

            }
            order.metrc_payload = order_packages;//store in object within map. 
        } catch (err) {
            throw new Error("Error building Metrc Package blob for order: " + order.short_id)
        }
    }

}

async function runner() {

    try {
        console.log("Fetching Product Master list from Google Sheets ")
        await restutils.getProductMasterList(function (status, productmap) {
            if (status == 'success') {
                console.log("Got Product master list from google. Stored");
                master_product_map = productmap;

            }// shold never get past here. 
            // else {
            //   Last_ERROR = "could not get product master list from google sheets";
            //}
        })

        console.log("Fetching Accepted order list.  ")
        await restutils.getLeaflinkAcceptedOrders(function (status, data) {
            // returned data is an array of orders
            if (status == 'success') {
                console.log("Got LeafLink Order List");
                accepted_orders = data;
            }
            //else {
            //   console.log("could not get accepted orders, error")
            //   return;
            //}
        })

        //for debug:  change ordre number to unknown number: 
        //accepted_orders[2].number = "alsdkfjslkfdjsl"
        // end debug. 



        console.log("Fetching Order info for each accepted order now, order count: " + accepted_orders.length)
        for (var i = 0; i < accepted_orders.length; i++) {
            console.log("getting details for order number: " + accepted_orders[i].number);
            await restutils.getLeaflinkOrderInfo(accepted_orders[i].number, function (status, data) {
                if (status == 'success')   // note, data is an array, which we want index 0 of. 
                {
                    orders_map[accepted_orders[i].number] = data[0];  // store it.. 
                    lineitemcount += data[0].line_items.length;
                }
                // else {
                //    console.log("could not get order info, error: " + accepted_orders[i].number);
                //   Last_ERROR = "Cant get order detail: " + accepted_orders[i].number
                //   return;
                //}

            })
        }

        console.log("Done fetching all order info from LeafLink");
        console.log("Total line items counted: " + lineitemcount);
        console.log("Checking all ordered products are in inventroy database")

        // for debug ,  remove all order except the ones created by chris..********************
        for (var key in orders_map) {  // for each accepted order,
            var order = orders_map[key];
            var customername = order.customer.display_name;
            if (!customername.includes("Noble Lord Bauer"))
                delete orders_map[key];
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
                    throw new Error("From order: " + order.short_id + " could not find sku: " + sku + "  name: " + product_detail.name + " in Google Master sheet")

                }
            }
        }

        const questions = [
            {
                type: 'text',
                name: 'start_tag',
                message: 'Start Tag #'
            }
        ];
        //// PROMPT IS HERE !!! **************************************************
        // const response = await prompts(questions);
        //console.log("got value: " + response.start_tag);

        // validate start tag here. 
        // Add check for tag count limit check here !!!!!!!!!!!!!!!!!!

        //TODO,  validate tag range.. 
        var starttag = 17660; //DEBUG
        //var starttag = response.start_tag;
        constructMetrcPackageBlob(starttag);  // puts blobs into orders map.. throws error 

        for (var key in orders_map) {  // for each accepted order,
            var order = orders_map[key];
            console.log("Tagging Order: " + order.short_id + " from: " + order.customer.display_name + " --  " + order.line_items.length + " line items")
            //console.log(JSON.stringify(order.metrc_payload, null, 2));
            await restutils.createMetrcPackages(order.metrc_payload, function (status) {
                console.log("Result: " + status)
            })
        }
    } catch (err) {
        console.log("ERROR: " + err.message)
    }
}

runner();
