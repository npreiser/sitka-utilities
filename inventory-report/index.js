var moment = require('moment');
const fs = require('fs');
//const fse = require('fs-extra')
//const path = require('path');
var restutils = require('./restutils');
//const prompts = require('prompts');
//const { Console } = require('console');
var XLSX = require("xlsx");
var logger = require('./log.js');
const { parse, Parser } = require('json2csv');
var master_prod_list = [];
async function runner() {

    try {
       
        logger.info("Fetching Product list.  ")
        var breakout = false;
        var next_url = 'https://www.leaflink.com/api/v2/products/?fields_include=id,name,display_listing_state';
        console.log("Fetching data from Leaflink")
        while(true)
        {
            await restutils.getLeaflinkProductsList(next_url, function (status, data) {
                // returned data is an array of orders
                if (status == 'success') {
                    logger.info("Got LeafLink Product List");

                    master_prod_list = master_prod_list.concat(data.results);
                    if(data.next != undefined && data.next.length > 0)
                    {
                        next_url = data.next;
                    }
                    else
                    {
                        breakout = true;
                    }
                }
                console.log(".")
            });

            if(breakout)
               break;
       }

      // const csv = Parser.parse(master_prod_list);
       const fields = ['id', 'name','display_name', 'quantity', 'reserved_qty', 'display_listing_state'];
       const csv = parse(master_prod_list, { fields });

      // console.log(csv);  
       fs.appendFileSync("./test1.csv", csv);
       var i = 0; 

    } catch (err) {
        logger.error("ERROR: " + err.message + "  ===> Terminating Sequence now. ")
    }
}

runner();