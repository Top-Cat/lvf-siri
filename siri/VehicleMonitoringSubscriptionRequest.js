var moment = require('moment');
var uuidv1 = require('uuid/v1');

module.exports = function(subLength = 5) {
	return {
		'VehicleMonitoringSubscriptionRequest': {
			'SubscriptionIdentifier': uuidv1(),
			'InitialTerminationTime': moment().add(subLength, 'm').format(),
			'VehicleMonitoringRequest': {
				'@version': '1.3',
				'RequestTimestamp': moment().format(),
				'OperatorRef': 'MET',
				'VehicleMonitoringDetailLevel': 'normal'
			},
			'IncrementalUpdates': 'true',
			'UpdateInterval': 'PT10S',
		}
	};
};

