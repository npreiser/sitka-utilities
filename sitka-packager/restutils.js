var axios = require('axios');
const { google } = require('googleapis');
const auth2 = require('./auth/auth_other.json');
const LEAFLINK_HOST = "https://www.leaflink.com/api/v2";
const LEAFLINK_API_KEY = auth2.ll_apikey;           //"App 5c9302f2873a6a25be7ccf5235333b38e7ff92317aed55c496793941689b6847";
const METRC_HOST = "https://api-or.metrc.com";
const METRC_LICENSE_NUMBER = "060-101642295A9";
const METRC_USERNAME = auth2.metrc_username;         //"EP4PTAmLqmU-H-MVQUVpqGIP9f6jUAENl9FgPAQ0KqFZ7Jcz";
const METRC_PASSWORD = auth2.metrc_password;        // "Q9Q8K7ifDgji2JwxJc2je2XImFtx-RxT4MEodH0rBXQWnRVn";

var token = "Basic " + btoa(METRC_USERNAME + ":" + METRC_PASSWORD);

var utils = module.exports = {

    getProductMasterList: async function (callback) {

        try {
            const auth = new google.auth.GoogleAuth({
                keyFile: "./auth/auth_google.json", // "keys.json", //the key file
                //url to spreadsheets API
                scopes: "https://www.googleapis.com/auth/spreadsheets",
            });

            //Auth client Object
            const authClientObject = await auth.getClient();

            //Google sheets instance
            const googleSheetsInstance = google.sheets({ version: "v4", auth: authClientObject });

            // spreadsheet id
            const spreadsheetId = "17tokFn7aMg1DBr93lrseNAnMrtSSh2rh3RWOgG62414";  // test sheet sitka_testdata1

            //const spreadsheetId = "1KvEGCZ22owF9goef25iQuRJvc2FZzaKY_EGAKUoe-2o";

            // Get metadata about spreadsheet
            const sheetInfo = await googleSheetsInstance.spreadsheets.get({
                auth,
                spreadsheetId,
            });

            //Read from the spreadsheet    //returns array of arrays,  in  test case 3 columns,
            const readData = await googleSheetsInstance.spreadsheets.values.get({
                auth, //auth object
                spreadsheetId, // spreadsheet id
                range: "Products!A1:C5", //range of cells to read from.
                //range: "Badder / Sauce / Wax / Crumble / Live Resin!A1:B5"
            })
            // NOTES:  plan to return a bunch of different stuff in the callback from the various sheet.s 
            //prodcut data,  return a map
            var map = new Object();  // so we can look up by sku
            const PROD_NAME_COL = 0;
            const PROD_TAG_COL = 1;
            const PROD_SKU_COL = 2;

            for(var i = 1; i < readData.data.values.length; i++)
            {
                // first row is header, skip. 
                var prod = readData.data.values[i];
                map[prod[PROD_SKU_COL]] = { "TAG": prod[PROD_TAG_COL], "NAME": prod[PROD_NAME_COL]  }
            }
            callback("success", map);  
        } catch (err1) {
            callback("error", err1);
        }
    },

    getLeaflinkAcceptedOrders: async function (callback) {
        var config = {
            method: 'get',
            url: LEAFLINK_HOST + '/orders-received/?status=Accepted',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': LEAFLINK_API_KEY
            },
        };

        await axios(config)
            .then(function (response) {
                if (response.status == 200) {
                    if (response.data.results != null && response.data.count > 0) {
                        var results = response.data.results;
                        // callback("got back: " + count + " Orders to process");
                        //for (var i = 0; i < count; i++) {
                        //    var customername = results[i].customer.display_name;
                        //    console.log("customername: " + customername);
                        //}

                        callback("success", results);

                    }
                    else
                        callback("failed");
                }
                else {
                    callback("failed");
                }
            })
            .catch(function (error) {
                callback("exception");
            });
    },
    getLeaflinkOrderInfo: async function (ordernumber, callback) {
        var config = {
            method: 'get',
            url: LEAFLINK_HOST + '/orders-received/?number=' + ordernumber + '&include_children=line_items',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': LEAFLINK_API_KEY
            },
        };

        await axios(config)
            .then(function (response) {
                if (response.status == 200) {
                    if (response.data.results != null && response.data.count > 0) {
                        var results = response.data.results;
                        callback("success", results);
                    }
                    else
                        callback("failed");
                }
                else {
                    callback("failed");
                }
            })
            .catch(function (error) {
                callback("exception");
            });
    },
    

// just a test for now.. returns array 
 createMetrcPackages: async function(packagedata, callback) {
    var config = {
        method: 'post',
        url: METRC_HOST + '/packages/v1/create?licenseNumber=' + METRC_LICENSE_NUMBER,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token
        },
        data: packagedata
    };

    await axios(config)
        .then(function (response) {
            if (response.status == 200) {
                if (response != null && response.statusText == "OK") {
                    callback("success");
                }
                else
                    callback("request failed, something in response is bad ");
            }
            else {
                callback("request failed, bad status code");
            }
        })
        .catch(function (error) {
            callback("exception:" + error);
        });
}
    
}