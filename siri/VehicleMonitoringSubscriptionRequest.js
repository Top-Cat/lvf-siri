var moment = require('moment');
var uuidv4 = require('uuid/v4');

module.exports = function(subLength = 5) {
	return {
		'VehicleMonitoringSubscriptionRequest': {
			'SubscriptionIdentifier': uuidv4(),
			'InitialTerminationTime': moment().add(subLength, 'm').format(),
			'VehicleMonitoringRequest': {
				'@version': '1.3',
				'RequestTimestamp': moment().format(),
				'VehicleMonitoringDetailLevel': 'normal'
			},
			'IncrementalUpdates': 'true',
			'UpdateInterval': 'PT10S',
		}
	};
};

