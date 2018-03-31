var async = require('async')
var express = require('express')
var xmlparser = require('express-xml-bodyparser')

const app = express()

app.use(xmlparser());

var stopFunc = async function() {};
var vehicleFunc = async function() {};

module.exports = function(sqlPool) {
	var workQueue = async.queue(async function(task) {
		var func = (task.type == "vehicle") ? vehicleFunc : (
			(task.type == "stop") ? stopFunc : (
			async function() { }));

		var connection = await pool.getConnection();

		await func(task.obj, connection);
		connection.release();
	});

	app.post('/', function(req, res) {
		res.sendStatus(200)

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
					.vehicleactivity

				activity.forEach(function(v) {
					workQueue.push({type: "vehicle", obj: v});
				});
			} else if (serviceDelivery.stopmonitoringdelivery) {
				console.log("-- Stop update --");
				var activity = serviceDelivery
					.stopmonitoringdelivery[0]
					.monitoredstopvisit


				activity.forEach(function(v) {
					workQueue.push({type: "stop", obj: v});
				});
			} else {
				console.log("-- Unknown service delivery --");
			}
		} else {
			console.log("-- Unknown message --");
		}
	})
	app.listen(3000, () => console.log('Ensign adapter listening on port 3000'))

	var listenerConfigurator;

	listenerConfigurator = {
		stop: function(f) {
			stopFunc = f;
			return listenerConfigurator;
		},
		vehicle: function(f) {
			vehicleFunc = f;
			return listenerConfigurator;
		}
	};

	return listenerConfigurator;
}
