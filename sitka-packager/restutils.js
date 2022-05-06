var axios = require('axios');
const { google } = require('googleapis');
const auth2 = require('./auth/auth_other_test1.json');
const LEAFLINK_HOST = "https://www.leaflink.com/api/v2";
const LEAFLINK_API_KEY = auth2.ll_apikey;           
const METRC_HOST = "https://api-or.metrc.com";
const METRC_LICENSE_NUMBER = "060-101642295A9";
const METRC_USERNAME = auth2.metrc_username;        
const METRC_PASSWORD = auth2.metrc_password;

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

            for (var i = 1; i < readData.data.values.length; i++) {
                // first row is header, skip. 
                var prod = readData.data.values[i];
                map[prod[PROD_SKU_COL]] = { "TAG": prod[PROD_TAG_COL], "NAME": prod[PROD_NAME_COL] }
            }
            callback("success", map);
        } catch (err1) {
            throw new Error("Error Fetching Google Master Product Sheet: " + err1.message);
            // callback("error", err1);
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
                        callback("success", results);
                    }
                    else
                        throw new Error("Error Getting LeafLink Order List: " + "No data in results array");
                }
                else {
                    throw new Error("Error Getting LeafLink Order List: " + "Repsonse code: " + response.status);
                }
            })
            .catch(function (error) {
                throw new Error("Error Getting LeafLink Order List: " + error);
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
                        throw new Error("Error Getting LeafLink Order Detail: " + "No data in results array");
                }
                else {
                    throw new Error("Error Getting LeafLink Order Detail: " + "Repsonse code: " + response.status);
                }
            })
            .catch(function (error) {
                throw new Error("Error Getting LeafLink Order Detail: " + error);
            });
    },


    // just a test for now.. returns array 
    createMetrcPackages: async function (packagedata, callback) {
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
                        throw new Error("Creating Metrc Package: " + "Unkown Error");
                }
                else {
                    throw new Error("Creating Metrc Package: " + "Bad status code: " + response.status);
                }
            })
            .catch(function (error) {
                throw new Error("Creating Metrc Package: " + error);
            });
    }

}