var mysql = require('mysql2/promise');
var listener = require('./listener');

var siri = require('./siri/siri');
var SubscriptionRequest = require('./siri/SubscriptionRequest');
var SubscriptionContext = require('./siri/SubscriptionContext');
var VehicleMonitoringSubscriptionRequest = require('./siri/VehicleMonitoringSubscriptionRequest');
var StopMonitoringSubscriptionRequest = require('./siri/StopMonitoringSubscriptionRequest');

var pool = mysql.createPool({
	host: 'lvf-db-service',
	user: process.env.MYSQL_USER,
	password: process.env.MYSQL_PASS,
	database: 'brian_buspics'
});

/////////////////////////////////////////////////////////////////////////////////////////

// Returned rows are processed here
// vehicle contains the data about a single vehicle in the feed
// When done call cb()

listener(async (vehicle, sqlConn, cb) => {
/*	var [rows, fields] = await sqlConn.execute(
		'SELECT CronStart FROM lvf_config WHERE `index` = ?',
		[1]
	);*/

	//console.log(JSON.stringify(vehicle) + "\n");

	cb();
}, async (stop, sqlConn, cb) => {
	console.log(JSON.stringify(stop) + "\n");

	cb();
});

/////////////////////////////////////////////////////////////////////////////////////////

var subscriptionLength = 10

function updateSubscription() {
	console.log("Updating subscription");

	var req = SubscriptionRequest(
		process.env.CONSUMER_URI,
		'LVF',
		SubscriptionContext(),
		StopMonitoringSubscriptionRequest('b3e0f5aa-67b3-4ac9-a4b2-3272445effbe', subscriptionLength + 1)
	);

	siri.makeRequest(req);
}

setInterval(updateSubscription, subscriptionLength * 60 * 1000);
updateSubscription();
