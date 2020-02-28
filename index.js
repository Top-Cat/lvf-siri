var statsd = require('hot-shots');
var mysql = require('mysql2/promise');
var moment = require('moment');
var listener = require('./listener');

var siri = require('./siri/siri');
var SubscriptionRequest = require('./siri/SubscriptionRequest');
var SubscriptionContext = require('./siri/SubscriptionContext');
var VehicleMonitoringSubscriptionRequest = require('./siri/VehicleMonitoringSubscriptionRequest');
var StopMonitoringSubscriptionRequest = require('./siri/StopMonitoringSubscriptionRequest');

var statsClient = new statsd({
	host: "telegraf.monitoring",
	port: 8125,
	globalTags: {
		app: "lvf-siri"
	},
	prefix: "lvf.siri.",
	maxBufferSize: 5000,
	cacheDns: true
});

var siriFeed = listener(
	mysql.createPool({
		host: 'lvf-db-service',
		user: process.env.MYSQL_USER,
		password: process.env.MYSQL_PASS,
		database: 'brian_buspics'
	}),
	statsClient
);

var stopListing = new Set();

/////////////////////////////////////////////////////////////////////////////////////////

siriFeed.stop(async (stop, sqlConn) => {
	const stopUpdate = stop.monitoredvehiclejourney[0];
	const monitor = stopUpdate.monitoredcall[0];

	const [id, year, month, day, routeVisit, journey] = stop.itemidentifier[0].match(/([0-9]{4})([0-9]{2})([0-9]{2})([0-9]+)([0-9]{4})/);
	const route = parseInt(routeVisit.slice(0, -(parseInt(monitor.visitnumber[0])+"").length));

	const info = {
		vid: (stopUpdate.vehicleref || [0])[0],
		stop: stop.monitoringref[0],
		line: stopUpdate.lineref[0],
		direction: stopUpdate.directionref[0].toLowerCase() == "outbound" ? 1 : 2,
		destination: stopUpdate.destinationname[0],
		operator: stopUpdate.operatorref[0],
		visit: parseInt(monitor.visitnumber[0]),
		id: id,
		prediction: moment((monitor.expectedarrivaltime || monitor.actualarrivaltime || monitor.aimedarrivaltime || monitor.expecteddeparturetime || monitor.aimeddeparturetime)[0])
				.format("YYYY-MM-DD HH:mm:ss")
	};

	if (info.operator.length == 0) {
		console.log(JSON.stringify(stop));
	} else {
		await sqlConn.execute('INSERT IGNORE INTO lvf_siri_routes (id, route, dirid, operator) VALUES (?, ?, ?, ?);', [route, info.line, info.direction, info.operator]);
	}

	//console.log(JSON.stringify(info));
	await updatePrediction(sqlConn, info);
});

async function updatePrediction(sqlConn, info) {
	await sqlConn.execute(
		'INSERT INTO lvf_siri_predictions (id, vehicle_id, stop_id, route, dirid, destination, operator, visit, `stop_arrival`) ' +
		'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE ' +
		'route = VALUES(route), vehicle_id = COALESCE(NULLIF(VALUES(vehicle_id), "0"), vehicle_id), stop_id = VALUES(stop_id), dirid = VALUES(dirid), destination = VALUES(destination), ' +
		'operator = COALESCE(NULLIF(operator, ""), VALUES(operator)), visit = VALUES(visit), `stop_arrival` = VALUES(`stop_arrival`);',
		[info.id, info.vid, info.stop, info.line, info.direction, info.destination, info.operator, info.visit, info.prediction]
	);
}

siriFeed.vehicle(async (veh, sqlConn) => {
	if (veh.monitoredvehiclejourney[0].monitoredcall) {
		const journey = veh.monitoredvehiclejourney[0];
		const call = journey.monitoredcall[0];
		stopListing.add(call.stoppointref[0]);

		if (call.visitnumber && journey.vehicleref && call.visitnumber[0] == 1) {
			const direction = journey.directionref[0].toLowerCase() == "outbound" ? 1 : 2;
			const journeyCode = veh.extensions[0].vehiclejourney[0].operational[0].ticketmachine[0].journeycode[0];

			await sqlConn.execute(
				'UPDATE lvf_siri_predictions SET vehicle_id = ? ' +
				'WHERE id LIKE ? AND route = ? AND dirid = ? AND operator = ? AND vehicle_id = ?',
				[journey.vehicleref[0], '%' + journeyCode, journey.lineref[0], direction, journey.operatorref[0], "0"]
			);
		}
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
	statsClient.increment('update_sub');

	siriFeed.getConn(async sqlConn => {
		await sqlConn.execute("DELETE FROM lvf_siri_predictions WHERE stop_arrival < NOW() - INTERVAL 1 DAY;");
	});

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

function doStats() {
	siriFeed.getConn(async sqlConn => {
		const [results] = await sqlConn.query("SELECT COUNT(*) activePredictions FROM lvf_siri_predictions WHERE stop_arrival > NOW();");
		statsClient.gauge('active_predicitions', results[0].activePredictions);
	});
}

siriFeed.getStops().then(stops => {
	stops.forEach(stop => stopListing.add(stop));
	setInterval(updateSubscription, subscriptionLength * 60 * 1000);
	updateSubscription();
});

setInterval(doStats, 10 * 1000);
