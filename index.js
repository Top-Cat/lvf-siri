var mysql = require('mysql2/promise');
var listener = require('./listener');

var siri = require('./siri/siri');
var SubscriptionRequest = require('./siri/SubscriptionRequest');
var SubscriptionContext = require('./siri/SubscriptionContext');
var VehicleMonitoringSubscriptionRequest = require('./siri/VehicleMonitoringSubscriptionRequest');
var StopMonitoringSubscriptionRequest = require('./siri/StopMonitoringSubscriptionRequest');

var siriFeed = listener(mysql.createPool({
	host: 'lvf-db-service',
	user: process.env.MYSQL_USER,
	password: process.env.MYSQL_PASS,
	database: 'brian_buspics'
}));

/////////////////////////////////////////////////////////////////////////////////////////

siriFeed.stop(async (stop, sqlConn) => {
/*	var [rows, fields] = await sqlConn.execute(
		'SELECT CronStart FROM lvf_config WHERE `index` = ?',
		[1]
	);*/

	console.log(JSON.stringify(stop) + "\n");
});

siriFeed.vehicle(async (veh, sqlConn) => {
	console.log(JSON.stringify(veh) + "\n");
});

/////////////////////////////////////////////////////////////////////////////////////////

var subscriptionLength = 10;

function updateSubscription() {
	console.log("Updating subscription");

	var req = SubscriptionRequest(
		process.env.CONSUMER_URI,
		'LVF',
		SubscriptionContext(),
		VehicleMonitoringSubscriptionRequest(subscriptionLength + 1)
//		StopMonitoringSubscriptionRequest(subscriptionLength + 1, ['1590060108', '1590005001', '1590026801'])
	);

	siri.makeRequest(req);
}

setInterval(updateSubscription, subscriptionLength * 60 * 1000);
updateSubscription();
