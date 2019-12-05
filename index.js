var mysql = require('mysql2/promise');
var moment = require('moment');
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

var stopListing = new Set();

/////////////////////////////////////////////////////////////////////////////////////////

siriFeed.stop(async (stop, sqlConn) => {
	const stopUpdate = stop.monitoredvehiclejourney[0];
	const monitor = stopUpdate.monitoredcall[0];

	if (!stopUpdate.vehicleref) {
		console.log("NOREF");// + JSON.stringify(stop));
		return;
	}

	const info = {
		vid: stopUpdate.vehicleref[0],
		stop: stop.monitoringref[0],
		line: stopUpdate.lineref[0],
		direction: stopUpdate.directionref[0] == "Outbound" ? 1 : 2,
		destination: stopUpdate.destinationname[0],
		operator: stopUpdate.operatorref[0],
		visit: parseInt(monitor.visitnumber[0]),
		prediction: moment((monitor.expectedarrivaltime || monitor.actualarrivaltime || monitor.expecteddeparturetime)[0])
				.format("YYYY-MM-DD HH:mm:ss")
	};

	if (info.operator.length == 0) {
		console.log(JSON.stringify(stop));
	}

	//console.log(JSON.stringify(info));

	await sqlConn.execute(
		'INSERT INTO lvf_siri_predictions (vehicle_id, stop_id, route, dirid, destination, operator, visit, `stop_arrival`) ' +
		'VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE ' +
		'route = VALUES(route), dirid = VALUES(dirid), destination = VALUES(destination), ' +
		'operator = COALESCE(NULLIF(operator, ""), VALUES(operator)), visit = VALUES(visit), `stop_arrival` = VALUES(`stop_arrival`);',
		[info.vid, info.stop, info.line, info.direction, info.destination, info.operator, info.visit, info.prediction]
	);
});

siriFeed.vehicle(async (veh, sqlConn) => {
	if (veh.monitoredvehiclejourney[0].monitoredcall) {
		stopListing.add(veh.monitoredvehiclejourney[0].monitoredcall[0].stoppointref[0]);
	}
});

/////////////////////////////////////////////////////////////////////////////////////////

var subscriptionLength = 10;

function chunk(arr, size) {
	var myArray = [];
	for (var i = 0; i < arr.length; i += size) {
		myArray.push(arr.slice(i, i+size));
	}
	return myArray;
}

function updateSubscription() {
	console.log("Updating subscription");

	var req = SubscriptionRequest(
		process.env.CONSUMER_URI,
		'LVF',
		SubscriptionContext(),
		VehicleMonitoringSubscriptionRequest(subscriptionLength + 1)
	);

	siri.makeRequest(req);

	if (stopListing.size > 0) {
		const chunks = chunk(Array.from(stopListing), 500);
		chunks.forEach(chunk => {
			var stopReq = SubscriptionRequest(
				process.env.CONSUMER_URI,
				'LVF',
				SubscriptionContext(),
				StopMonitoringSubscriptionRequest(subscriptionLength + 1, chunk)
			);

			siri.makeRequest(stopReq);
		});
	}
}

siriFeed.getStops().then(stops => {
	stops.forEach(stop => stopListing.add(stop));
	setInterval(updateSubscription, subscriptionLength * 60 * 1000);
	updateSubscription();
});
