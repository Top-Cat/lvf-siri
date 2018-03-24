var async = require('async')
var express = require('express')
var xmlparser = require('express-xml-bodyparser')

const app = express()

app.use(xmlparser());

module.exports = function(sqlPool, cb, cb2) {
	var workQueue = async.queue(async function(task, callback) {
		var connection = await pool.getConnection();

		var func = (task.type == "vehicle") ? cb : (
			(task.type == "stop") ? cb2 : (
			function(a, b, c) { c(); }));

		func(task.obj, connection, function() {
			connection.release();
			callback();
		});
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
}
