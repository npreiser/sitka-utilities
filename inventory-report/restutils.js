var axios = require('axios');
//const { google } = require('googleapis');
const auth2 = require('./auth/auth_other.json');
const LEAFLINK_HOST = "https://www.leaflink.com/api/v2";
const LEAFLINK_API_KEY = auth2.ll_apikey;

//var token = "Basic " + btoa(METRC_USERNAME + ":" + METRC_PASSWORD);

const DEBUG_GOOGLE_SHEET = false;  //use my debug sheet for sku check,. 
const logger = require('./log');

var utils = module.exports = {

   
    getLeaflinkProductsList: async function (url, callback) {
        var config = {
            method: 'get',
            url: url,// '/products/?fields_include=id,name,display_listing_state',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': LEAFLINK_API_KEY
            },
        };

        await axios(config)
            .then(function (response) {
                if (response.status == 200) {
                    if (response.data.results != null && response.data.count > 0) {
                        var results = response.data;
                        callback("success", results);
                    }
                    else
                        throw new Error("Error Getting LeafLink Product List: " + "No data in results array");
                }
                else {
                    throw new Error("Error Getting LeafLink Product List: " + "Repsonse code: " + response.status);
                }
            })
            .catch(function (error) {
                if (error.response != undefined && error.response.data != undefined)
                    throw new Error("Error Getting LeafLink Product List: " + JSON.stringify(error.response.data, null, 2));
                else
                    throw new Error("Error Getting LeafLink Product List: " + error);
            });
    }

}