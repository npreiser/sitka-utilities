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
var omit_skus_map = undefined;

// ONLY PROCESS FIRST ORDER IN LIST
const DEBUG_PROCESS_ONLY_FIRST_ORDER = true; //set true to only process first ordrer in list 

// CBAUER order only. -- set true to filter order list to only his order. 
const DEBUG_FOR_CBAUER_ORDERS = false;

// DEBUG PROMPT STATRT TAG,  set to true for release,  set to false for debug under ide. 
const DEBUG_PROMPT_START_TAG = false;

// This function creates all the blobs per order , starting at start tag.
// the blobs are placed into the order_map, on a per order  
function constructMetrcPackageBlob(starttag) {

    console.log("Based on start tag, building payloads for each line item in each order now.")
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

    console.log("Success building payload packages. ")

}

async function runner() {

    try {
        console.log("Fetching Product Master list from Google Sheets ")
        await restutils.getProductMasterList(function (status, productmap, omitmap) {
            if (status == 'success') {
                console.log("Got Product master list and omit item list from google. Stored");
                master_product_map = productmap;
                omit_skus_map = omitmap;
            }// shold never get past here. 
        })

        console.log("Fetching Accepted order list.  ")
        await restutils.getLeaflinkAcceptedOrders(function (status, data) {
            // returned data is an array of orders
            if (status == 'success') {
                console.log("Got LeafLink Order List");
                accepted_orders = data;
            }
        })


        console.log("Fetching Order info for each accepted order now, order count: " + accepted_orders.length)
        for (var i = 0; i < accepted_orders.length; i++) {
            console.log("getting details for order number: " + accepted_orders[i].number);
            await restutils.getLeaflinkOrderInfo(accepted_orders[i].number, function (status, data) {
                if (status == 'success')   // note, data is an array, which we want index 0 of. 
                {
                    orders_map[accepted_orders[i].number] = data[0];  // store it.. 
                    lineitemcount += data[0].line_items.length;
                }
            })
        }

        console.log("Done fetching all order info from LeafLink");


        // **********  for debug ,  remove all order except the ones created by chris..********************
        // ************************************************************************************************
        if (DEBUG_FOR_CBAUER_ORDERS) {
            console.log(" **** DEBUG **** : Filtering order list to ONLY CHRIS BAUERS ORDERS.")
            lineitemcount = 0;
            for (var key in orders_map) {  // for each accepted order,
                var order = orders_map[key];
                var customername = order.customer.display_name;
                if (!customername.includes("Noble Lord Bauer")) {
                    delete orders_map[key];
                }
                else
                    lineitemcount += order.line_items.length;
            }

            // ngp, cant remember why I did this ??? 6/25/22
            // reduce to one key for now: 
            delete orders_map["3cadfb42-047a-4603-80ec-fcc856985a25"];
            lineitemcount = 4; // final test. 
        }


        if (DEBUG_PROCESS_ONLY_FIRST_ORDER)  // remove all but first item in order list. 
        {
            console.log("*** DEBUG ***: filtering order list to only the first ORDER ")
            lineitemcount = 0;  //reset line item count
            var count = 0;
            for (var key in orders_map) {  // for each accepted order,
                if (count == 0) {
                    var order = orders_map[key];
                    lineitemcount += order.line_items.length;
                    count = 1;
                }
                else
                    delete orders_map[key]; //delete all other orders. 

            }
        }

        //end debug. ******************************************************************************
        // **********************************************************************************************

        console.log("Total Orders: " + Object.keys(orders_map).length)
        console.log("Pre-Validation Total line items: " + lineitemcount);

        // Validate all line items are in the inventory list 
        console.log("Validating all order line items against the Master SKU LIST");
        var lineitem_omitted_count = 0;
        for (var key in orders_map) {  // for each accepted order,
            var order = orders_map[key]
            //console.log(JSON.stringify(order, null, 2))
            for (var li = 0; li < order.line_items.length; li++)  // for each line item in the order. 
            {
                var lineitem = order.line_items[li];
                var product_detail = lineitem.frozen_data.product;
                var sku = product_detail.sku;

                //7/16/22 if line item is in the omit list, remove the item from order
                if (omit_skus_map[sku] != undefined) // sku for this line item is in the omit map... 
                {
                    console.log("Removing(omiting) line item sku: " + sku + " from order: " + order.short_id)
                    order.line_items.splice(li, 1);
                    li = 0;// start over on this order just in case. (want to make sure we get all omissions) 
                    lineitem_omitted_count++;
                    continue;
                }


                // check sku is in master prod map
                if (master_product_map[sku] == undefined) {
                    throw new Error("From order: " + order.short_id + " could not find sku: " + sku + "  name: " + product_detail.name + " in Google Master sheet")
                }
            }
        }
        console.log("Success validating line items against SKUs")

        // adjust total line item count:
        lineitemcount -= lineitem_omitted_count;

        console.log("You have " + Object.keys(orders_map).length + " orders to process that contains " + lineitemcount + " total line items")
        const questions = [
            {
                type: 'text',
                name: 'start_tag',
                message: 'Enter Start Tag #'
            }
        ];

        const q2 = [
            {
                type: 'text',
                name: 'confirm',
                message: 'Are you sure you want to continue, type y to continue,  or n to cancel'
            }
        ];

        //// PROMPT IS HERE !!! **************************************************
        var starttag = 30100; //DEBUG FORCE  
        if (DEBUG_PROMPT_START_TAG == true) {
            const response = await prompts(questions);  // PROMPT #1 (start tag)
            starttag = response.start_tag;
        }

        console.log("Confirm you have enough tags to fullfill this build now!!! ")
        console.log("With start tag number: " + starttag + " your end tag will be " + (parseInt(starttag) + lineitemcount - 1));

        var confirm_continue = 'y';
        if (DEBUG_PROMPT_START_TAG == true) {
            const resp2 = await prompts(q2)  // PROMPT #2 (confirmation)
            confirm_continue = resp2.confirm;
        }

        if (confirm_continue == 'y') {

            constructMetrcPackageBlob(starttag);  // puts blobs into orders map.. throws error 

            console.log("Starting to dispatch packages to Metrc");
            for (var key in orders_map) {  // for each accepted order,
                var order = orders_map[key];
                console.log("Tagging Order: " + order.short_id + " from: " + order.customer.display_name + " --  " + order.line_items.length + " line items");
                console.log("Order Tag range: " + order.metrc_payload[0].Tag + " ---> " + order.metrc_payload[order.metrc_payload.length - 1].Tag)
                //console.log(JSON.stringify(order.metrc_payload, null, 2));
                await restutils.createMetrcPackages(order.metrc_payload, function (status) {
                    console.log("Result: " + status)
                })
            }
        }
        else {
            console.log("Cancelling packaging run");
            throw new Error("User Cancelled Build");
        }




    } catch (err) {
        console.log("ERROR: " + err.message + "  ===> Terminating Sequence now. ")
    }
}

runner();
