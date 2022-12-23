var moment = require('moment');
const { getLeaflinkAcceptedOrders } = require('./restutils');

function MetrcTransferTemplate(order, price_map, transporter) {

  var departure = new moment(order.ship_date).utc();
  departure.set('hour', 8).toISOString();

  var arrival = new moment(order.ship_date).utc();
  arrival.set('hour', 16).toISOString();

  var packages = [];
  for (var i = 0; i < order.metrc_payload.length; i++) {

    var tag = order.metrc_payload[i].Tag;
    var price = price_map[tag];
    var pkgobj = {};
    pkgobj.PackageLabel = tag;
    pkgobj.WholesalePrice = price;   // price is in order, not in metrc_payload.. 
    packages.push(pkgobj);
  }

  this.Name = order.customer.name + " (" + order.short_id + ")"; // buyer+ order number"";

  // below  all comes from google sheet ()
    this.TransporterFacilityLicenseNumber = transporter.TFL,  // 
    this.DriverOccupationalLicenseNumber = transporter.EmployeeID; //"941I8F",
    this.DriverName = transporter.Name; //"Christopher Bauer",
    this.DriverLicenseNumber = transporter.DriversLicenseNumber; //"BauerCS178RC",
    this.PhoneNumberForQuestions = transporter.PhoneNumber,
    this.VehicleMake = transporter.Vehicle_Make; //"Honda",
    this.VehicleModel = transporter.Vehicle_Model; //"Civic",
    this.VehicleLicensePlateNumber = transporter.License_Plate; //"5154",
    //end google sheet
    this.Destinations = [
      {
        "RecipientLicenseNumber": order.customer.license_number, // "060-1016689907F",  // buyres lic number (from order. )
        "TransferTypeName": "Wholesale Transfer",
        "PlannedRoute": "Best GPS Route",
        "EstimatedDepartureDateTime": departure, //"2018-03-06T08:00:00.000",   // ship date of order  8 am ,,,
        "EstimatedArrivalDateTime": arrival, //"2018-03-06T16:00:00.000",   // ship date +   4pm same date.. 
        "Transporters": [    // leave blank, we only have 1 (above)
        ],
        "Packages": packages
        //[
        //  {
        //  "PackageLabel": "1A401030003F86A000048429",
        //  "WholesalePrice": "100.00"
        //},
        //{
        //  "PackageLabel": "1A401030003F86A000048430",
        // "WholesalePrice": "140.00"
        // }
        //]
      }]
}

module.exports = {
  MetrcTransferTemplate: MetrcTransferTemplate
}

