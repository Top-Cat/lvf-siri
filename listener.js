var async = require('async');
var express = require('express');
var xmlparser = require('express-xml-bodyparser');

const app = express();

app.use(xmlparser());

var stopFunc = async function() {};
var vehicleFunc = async function() {};

module.exports = function(sqlPool) {
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
			console.log("-- Heartbeat --");
		} else if (reqBody.servicedelivery) {
			var serviceDelivery = reqBody
				.servicedelivery[0];
			if (serviceDelivery.vehiclemonitoringdelivery) {
				console.log("-- Vehicle update --");
				var activity = serviceDelivery
					.vehiclemonitoringdelivery[0]
					.vehicleactivity;

				activity.forEach(function(v) {
					workQueue.push({type: "vehicle", obj: v});
				});
			} else if (serviceDelivery.stopmonitoringdelivery) {
				console.log("-- Stop update --");

				var delivery = serviceDelivery.stopmonitoringdelivery;
				delivery.forEach(function(d) {
					var activity = d.monitoredstopvisit || [];
					var cancellation = d.monitoredstopvisitcancellation || [];

					if (activity.length == 0) {
						if (cancellation.length > 0) {
							console.log("CANCEL " + cancellation.length);
						} else {
							console.log(JSON.stringify(reqBody));
						}
					}

					activity.forEach(function(v) {
						workQueue.push({type: "stop", obj: v});
					});
				});
			} else {
				console.log("-- Unknown service delivery --");
			}
		} else {
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
			const [results] = await sqlPool.query('SELECT stop_id FROM lvf_siri_predictions GROUP BY stop_id;');
			return results.map(x => x.stop_id);
		}
	};

	return listenerConfigurator;
}
