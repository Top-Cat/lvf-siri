var _ = require('lodash');
var async = require('async');
var express = require('express');
var xmlparser = require('express-xml-bodyparser');

const app = express();

app.use(xmlparser());

var stopFunc = async function() {};
var vehicleFunc = async function() {};

module.exports = function(sqlPool, statsClient) {
	var workQueue = async.queue(async function(task) {
		var func = (task.type == "vehicle") ? vehicleFunc : (
			(task.type == "stop") ? stopFunc : (
			async function() { }));

		var connection = await sqlPool.getConnection();

		try {
			await func(task.obj, connection);
		} catch (e) {
			console.log(JSON.stringify(task.obj));
			console.log(e);
		} finally {
			connection.release();
		}
	});

	app.post('/', function(req, res) {
		res.sendStatus(200);

		var reqBody = req.body.siri;
		if (reqBody.heartbeatnotification) {
			//console.log("-- Heartbeat --");
			statsClient.increment('message', 1, {type: 'heartbeat'});
		} else if (reqBody.servicedelivery) {
			var serviceDelivery = reqBody
				.servicedelivery[0];
			if (serviceDelivery.vehiclemonitoringdelivery) {
				//console.log("-- Vehicle update --");
				var activity = serviceDelivery
					.vehiclemonitoringdelivery[0]
					.vehicleactivity;

				statsClient.increment('message', 1, {type: 'vehicle'});
				statsClient.increment('update', activity.length, {type: 'vehicle'});
				activity.forEach(function(v) {
					workQueue.push({type: "vehicle", obj: v});
				});
			} else if (serviceDelivery.stopmonitoringdelivery) {
				//console.log("-- Stop update --");
				statsClient.increment('message', 1, {type: 'stop'});

				var delivery = serviceDelivery.stopmonitoringdelivery;
				delivery.forEach(function(d) {
					var activity = d.monitoredstopvisit || [];
					var cancellation = d.monitoredstopvisitcancellation || [];

					if (activity.length == 0) {
						if (cancellation.length > 0) {
							statsClient.increment('update', cancellation.length, {type: 'cancel'});
							//console.log("CANCEL " + cancellation.length);
						} else {
							console.log(JSON.stringify(reqBody));
						}
					}

					_(activity).groupBy(it => it.monitoredvehiclejourney[0].operatorref[0]).each((opActivity, op) => {
						statsClient.increment('update', opActivity.length, {operator: op, type: 'predicition'});
						opActivity.forEach(function(v) {
							workQueue.push({type: "stop", obj: v});
						});
					});
				});
			} else {
				statsClient.increment('message', 1, {type: 'unknown', level: 'service'});
				console.log("-- Unknown service delivery --");
			}
		} else {
			statsClient.increment('message', 1, {type: 'unknown', level: 'message'});
			console.log("-- Unknown message --");
		}
	})
	app.listen(3000, () => console.log('Ensign adapter listening on port 3000'));

	var listenerConfigurator;

	listenerConfigurator = {
		stop: function(f) {
			stopFunc = f;
			return listenerConfigurator;
		},
		vehicle: function(f) {
			vehicleFunc = f;
			return listenerConfigurator;
		},
		getStops: async function() {
			const [results] = await sqlPool.query('SELECT StopId FROM lvf_stops WHERE mode IN (\'MET\', \'ENS\');');
			return results.map(x => x.StopId);
		},
		getConn: async function(cb) {
			var connection = await sqlPool.getConnection();

			try {
				await cb(connection);
			} catch (e) {
				console.log(e);
			} finally {
				connection.release();
			}
		}
	};

	return listenerConfigurator;
}
