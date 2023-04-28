var moment = require('moment');
const fs = require('fs');
const fse = require('fs-extra')
const path = require('path');
var restutils = require('./restutils');
const prompts = require('prompts');
const REUP_BASE_TAG = "1A401030003F86A"
let metrcpkg = require('./metrcpackage');
let metrctransfer = require('./metrctransfer');
const { Console } = require('console');

let MetrcPkg = metrcpkg.MetrcPackage;
let MetrcTransferTemplate = metrctransfer.MetrcTransferTemplate;
// NOTE,  remainder postfix eg. = 000017647     9 chars
// you have atleast one param: 
var accepted_orders = [];
var orders_map = new Object();
var lineitemcount = 0;
var master_product_map = undefined;
var omit_skus_map = undefined;
var transporters_map = undefined;

// ONLY PROCESS FIRST ORDER IN LIST
const DEBUG_PROCESS_ONLY_FIRST_ORDER = false; //set true to only process first ordrer in list 

// CBAUER order only. -- set true to filter order list to only his order. 
const DEBUG_FOR_CBAUER_ORDERS = false;

// DEBUG PROMPT STATRT TAG,  set to true for release,  set to false for debug under ide. 
const DEBUG_PROMPT_START_TAG = true;

var logger = require('./log.js');

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 11/22/22
var temp_tag_price_map = undefined; // tag: price map for transfer mapping 
temp_tag_price_map = new Object();
// This function creates all the blobs per order , starting at start tag.
// the blobs are placed into the order_map, on a per order  

//4/26/23
var temp_stock_qty_map = undefined; // qty map for checking inventory. 
temp_stock_qty_map = new Object();

function convertQuantity(qty, is_sample, prod_name)
{
    // only convert flower, 
    var ret_qty = qty;
    if (prod_name.toLowerCase().includes('a buds')) { 
        if (is_sample)  
        {
            // trade sample, convert * 3.5 g. 
            ret_qty = ret_qty * 3.5;
        }
        else {   // normal order, convert lb to grams  
            //  round up to nearest whole number  (allison)
            var grams = Math.round(ret_qty * 454);  //454 g per pound
            ret_qty = grams;  // set qty to grams 
        }   
    }
    return ret_qty;
}


function constructMetrcPackageBlob(starttag) {

    logger.info("Based on start tag, building payloads for each line item in each order now.")
    var currenttag = starttag;

    // label data files for PRINTER 3/25/23
    var now = moment().format("YYYYMMDD_HHmmss");
    var fname_labels = now + "_" + starttag + ".csv"
    fs.appendFileSync("./tag_printer_data/" + fname_labels, "Item,Quantity,UID" + "\r\n");  //create file with header

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



                qty = convertQuantity(qty, lineitem.is_sample, product_detail.name);
                //3/25/23 flower added: check for flower, convert pound to grams.. and units..etc 
                var isflower = false;
                if (product_detail.name.toLowerCase().includes('a buds')) {
                    isflower = true;
                    //456 grams per lb , the qty will be in lbs.
                    // Normal order come ins as qty in lbs,  but trade samples are in multiples of 3.5grams,,, (3.5 grams )  
                    //if (lineitem.is_sample)  //4/3/23 (if its trade sample, then its already in grams, do not convert. )
                   // {
                        // trade sample, convert * 3.5 g. 
                    //    qty = qty * 3.5;
                   // }
                    //else {   // normal order, convert lb to grams  
                        // 4/13/23 added round up to nearest whole number  (allison)
                     //   var grams = Math.round(qty * 454);  //4/4/23 changed from 456
                      //  qty = grams;  // set qty to grams 
                   // }
                }
                // end added flower support

                // convert tag to full tag which is +9 chars long beyond base.
                // add a 0 in front of current tag... 
                var strtag = currenttag.toString();
                while (strtag.length < 9)
                    strtag = "0" + strtag;

                //11/22/22 reocrder tag / price: 
                // create a temp tag:price map,  this is used so that we can map tags to total price when 
                // creating the transfer templates.  The price is not part of the normal metrc payload so we 
                //have to have it seperated, 
                var price = lineitem.sale_price.amount * (lineitem.quantity / lineitem.unit_multiplier); //changed from bluk units on 4/13/23 lineitem.bulk_units;
                if (lineitem.is_sample)
                    price = ".01";  // have to have value > 00. for metrc. 

                temp_tag_price_map[REUP_BASE_TAG + strtag] = price.toString();
                // end temp tag price map. 


                let pkg = new MetrcPkg(REUP_BASE_TAG + strtag, qty, isflower, lineitem.is_sample, reup_prod_info.TAG);

                //var m1 = JSON.stringify(pkg);
                order_packages.push(pkg);

                // 3/23/25 append label file with data 
                fs.appendFileSync("./tag_printer_data/" + fname_labels, product_detail.name + "," + qty + "," + REUP_BASE_TAG + strtag + "\r\n");


                currenttag++;  // inc tag number 

            }
            order.metrc_payload = order_packages;//store in object within map. 
        } catch (err) {
            throw new Error("Error building Metrc Package blob for order: " + order.short_id)
        }
    }

    logger.info("Success building payload packages. ")

}




async function validateLeafLinkOrders() {
    // Validate all line items are in the inventory list 
    logger.info("Validating all order line items against the Master SKU LIST, and Transporter(SalesRep Names) are valid");
    var lineitem_omitted_count = 0;


    for (var key in orders_map) {  // for each accepted order,
        var order = orders_map[key]

        // sales rep. 11/30/22
        var sales_repname = order.sales_reps[0].user;
        if (transporters_map[sales_repname] == undefined) {
            //error out,  invalide sales rep.
            throw new Error("From order: " + order.short_id + " could not find transporter/sales rep: " + sales_repname + " in Google Master sheet (Transporters sheet)")
        }

        //debug print unedited list: 
        var skulist1 = order.line_items.map(extractItemSkus)
        logger.info("SKULIST(precheck): " + JSON.stringify(skulist1))
        for (var li = 0; li < order.line_items.length; li++)  // for each line item in the order. 
        {
            var lineitem = order.line_items[li];
            var product_detail = lineitem.frozen_data.product;
            var sku = product_detail.sku;

            const li_qty = lineitem.quantity;
            //7/16/22 if line item is in the omit list, remove the item from order
            if (omit_skus_map[sku] != undefined) // sku for this line item is in the omit map... 
            {
                logger.info("Removing(omiting) line item sku: " + sku + " from order: " + order.short_id)
                order.line_items.splice(li, 1);
                li = -1;// start over on this order just in case. (want to make sure we get all omissions) note post inc
                lineitem_omitted_count++;
                continue;
            }

            // check sku is in master prod map
            if (master_product_map[sku] == undefined) {
                throw new Error("From order: " + order.short_id + " could not find sku: " + sku + "  name: " + product_detail.name + " in Google Master sheet")
            }


            // 4/25/23,  call metrc to get parent tag  to test if we have enought qty in stock
            logger.info("Checking line item qty against current stock in Metrc");
            var prod_parent_tag = master_product_map[sku].TAG;
            // fetch the skus data from metrc, 
            // NOTEwe need to keep track of stock qty locally , order may contain same item multiple times 
            if(temp_stock_qty_map[prod_parent_tag] == undefined)  // if we dont' have qty for this tag,  fetch it from metrc
            {
                await restutils.getMetrcPackageByTag(prod_parent_tag, function (status, data) {
                    // Now test the value against what is in stock
                    var qty_metrc = data.Quantity;
                    temp_stock_qty_map[prod_parent_tag] = qty_metrc;  // store the value we just got back from metric for this tag. 
                }); //end callback on get parent qty 
            }
           
            // this is the current amount taking into account order/line items on this run of the tool 
            var qty_current_stock = temp_stock_qty_map[prod_parent_tag];  // pull existing 
            var qty_order = parseFloat(lineitem.quantity);
            qty_order = convertQuantity(qty_order, lineitem.is_sample, product_detail.name);  //convert if flower/sample
            
           // qty_order = 5  for debug
            if( qty_order > qty_current_stock)
            {
                // fail. not enough stock , 
                throw new Error("Order: " + order.short_id + " sku: " + sku + "  name: " + product_detail.name + "tag: " + prod_parent_tag +  "  not enough in stock, please check Metrc Stock -- qty_metrc: " + qty_metrc + " qty_order: " + qty_order + "\n")
            }
            else
            {
                // deduct the amount of the line item order from the stock.. 
                temp_stock_qty_map[prod_parent_tag] -= qty_order; //
            }
         
        } //end line item iter

        // debug print revised sku list: 
        var skulist2 = order.line_items.map(extractItemSkus)
        logger.info("Revised SKULIST: " + JSON.stringify(skulist2))

    }
    logger.info("Success validating line items against SKUs")

    // adjust total line item count:
    lineitemcount -= lineitem_omitted_count;

    logger.info("You have " + Object.keys(orders_map).length + " orders to process that contains " + lineitemcount + " total line items")

}


function extractItemSkus(item) {
    return item.frozen_data.product.sku;
}
async function runner() {



    try {
        // create/empty the manifests folder
        if (!fs.existsSync("./manifests"))
            fs.mkdirSync("./manifests");

        if (!fs.existsSync("./tag_printer_data"))
            fs.mkdirSync("./tag_printer_data");

        logger.info("clearing out the manifests dir now")
        fse.emptyDirSync("./manifests");  //empty the dir. 


        logger.info("Fetching Product Master list from Google Sheets");
        await restutils.getProductMasterList(function (status, productmap, omitmap, transportersmap) {
            if (status == 'success') {
                logger.info("Got Product master list and omit item list from google. Stored");
                master_product_map = productmap;
                omit_skus_map = omitmap;
                transporters_map = transportersmap;
            }// shold never get past here. 
        })

        logger.info("Fetching Accepted order list.  ")
        await restutils.getLeaflinkAcceptedOrders(function (status, data) {
            // returned data is an array of orders
            if (status == 'success') {
                logger.info("Got LeafLink Order List");
                accepted_orders = data;
            }
        })


        logger.info("Fetching Order info for each accepted order now, order count: " + accepted_orders.length)
        for (var i = 0; i < accepted_orders.length; i++) {
            logger.info("getting details for order number: " + accepted_orders[i].number);
            await restutils.getLeaflinkOrderInfo(accepted_orders[i].number, function (status, data) {
                if (status == 'success')   // note, data is an array, which we want index 0 of. 
                {
                    orders_map[accepted_orders[i].number] = data[0];  // store it.. 
                    lineitemcount += data[0].line_items.length;
                }
            })
        }

        logger.info("Done fetching all order info from LeafLink");
        // throw new Error("Debug TEST NICK");

        // **********  for debug ,  remove all order except the ones created by chris..********************
        // ************************************************************************************************
        if (DEBUG_FOR_CBAUER_ORDERS) {
            logger.info(" **** DEBUG **** : Filtering order list to ONLY CHRIS BAUERS ORDERS.")
            lineitemcount = 0;
            for (var key in orders_map) {  // for each accepted order,
                var order = orders_map[key];
                var customername = order.customer.name;
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
            logger.info("*** DEBUG ***: filtering order list to only the first ORDER ")
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

        logger.info("Total Orders: " + Object.keys(orders_map).length)
        logger.info("Pre-Validation Total line items: " + lineitemcount);

        //   await fetchRequiredParentTags();


        await validateLeafLinkOrders();   // changed to async on 4/25/23

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

        logger.info("Confirm you have enough tags to fullfill this build now!!! ")
        logger.info("With start tag number: " + starttag + " your end tag will be " + (parseInt(starttag) + lineitemcount - 1));

        var confirm_continue = 'y';
        if (DEBUG_PROMPT_START_TAG == true) {
            const resp2 = await prompts(q2)  // PROMPT #2 (confirmation)
            confirm_continue = resp2.confirm;
        }

        if (confirm_continue == 'y') {

            constructMetrcPackageBlob(starttag);  // puts blobs into orders map.. throws error 

            logger.info("Starting to dispatch packages to Metrc");
            for (var key in orders_map) {  // for each accepted order,
                var order = orders_map[key];
                logger.info("Tagging Order: " + order.short_id + " from: " + order.customer.name + " --  " + order.line_items.length + " line items");
                logger.info("Order Tag range: " + order.metrc_payload[0].Tag + " ---> " + order.metrc_payload[order.metrc_payload.length - 1].Tag)
                //console.log(JSON.stringify(order.metrc_payload, null, 2));

                // 7/18/22 chunk the package into calls of 20 at a time. 
                const chunkSize = 10;  // chunk size is how many metrc pkgs tosend up each call for the order. 
                var bundlenumber = 1;
                for (let pkgidx = 0; pkgidx < order.metrc_payload.length; pkgidx += chunkSize) {
                    const chunk = order.metrc_payload.slice(pkgidx, pkgidx + chunkSize);
                    // make call. 
                    logger.info("Sending Bundle: " + bundlenumber);
                    await restutils.createMetrcPackages(chunk, function (status) {
                        logger.info("Result: " + status);
                    })
                    await sleep(700);  // X ms sec delay between chunk calls 
                    bundlenumber++;
                }

                //when many orders with many packages,,, this files does not get written in time,,, 
                //  issue is file name,,, contains slashes.. etc.. (TOFIX THIS) 
                //  
                logger.info("Generating manifest file(csv) for this order")

                //11/23/22 fixup the display name
                var fixed_dispname = order.customer.name.replaceAll("/", "_").replaceAll(" ", "").replaceAll("-", "_").trim();
                var fname = order.short_id + "_" + fixed_dispname + ".csv";
                for (var pkgnum = 0; pkgnum < order.metrc_payload.length; pkgnum++) {
                    var tag = order.metrc_payload[pkgnum].Tag;
                    fs.appendFileSync("./manifests/" + fname, tag + "\r\n");
                }

                // UNder test (transporter template. )===================================================
                logger.info("Generating transfer template for order")
                var transporter = transporters_map[order.sales_reps[0].user];
                let tt = new MetrcTransferTemplate(order, temp_tag_price_map, transporter);
                logger.info("Sending transfer template for order")
                await restutils.createMetrcTransfer(tt, function (status) {
                    logger.info("Result: " + status);
                })

                // end transporter 
            }
        }
        else {
            logger.info("Cancelling packaging run");
            throw new Error("User Cancelled Build");
        }




    } catch (err) {
        logger.error("ERROR: " + err.message + "  ===> Terminating Sequence now. ")
    }
}


async function test_harness1() {

    //var test1 = "  myfile / sldkjfs / sdflskfj - ";
    //var fix1 = test1.replaceAll("/", "_").replaceAll(" ", "").replaceAll("-", "_").trim();


    await restutils.getProductMasterList(function (status, productmap, omitmap, transportersmap) {
        if (status == 'success') {
            logger.info("Got Product master list and omit item list from google. Stored");
            master_product_map = productmap;
            omit_skus_map = omitmap;
            transporters_map = transportersmap;
        }// shold never get past here. 
    })

    await restutils.getLeaflinkAcceptedOrders(function (status, data) {
        // returned data is an array of orders
        if (status == 'success') {
            logger.info("Got LeafLink Order List");
            accepted_orders = data;
        }
    })



    logger.info("Fetching Order info for each accepted order now, order count: " + accepted_orders.length)
    for (var i = 0; i < accepted_orders.length; i++) {
        logger.info("getting details for order number: " + accepted_orders[i].number);
        await restutils.getLeaflinkOrderInfo(accepted_orders[i].number, function (status, data) {
            if (status == 'success')   // note, data is an array, which we want index 0 of. 
            {
                orders_map[accepted_orders[i].number] = data[0];  // store it.. 
                lineitemcount += data[0].line_items.length;
            }
        })
    }

    validateLeafLinkOrders();
    constructMetrcPackageBlob("48429");
    //customer:license_number
    for (var key in orders_map) {  // for each accepted order,
        var order = orders_map[key];
        var transporter = transporters_map[order.sales_reps[0].user];
        let tt = new MetrcTransferTemplate(order, temp_tag_price_map, transporter);

        await restutils.createMetrcTransfer(tt, function (status) {
            logger.info("Result: " + status);
        })
    }



}

//test_harness1();

runner();
