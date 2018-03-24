var moment = require('moment');

module.exports = function(subId = '00000001', subLength = 5) {
	return {
		'VehicleMonitoringSubscriptionRequest': {
			'SubscriptionIdentifier': subId,
			'InitialTerminationTime': moment().add(subLength, 'm').format(),
			'VehicleMonitoringRequest': {
				'@version': '1.3',
				'RequestTimestamp': moment().format(),
//				'OperatorRef': 'EnsignBus',
				'VehicleMonitoringDetailLevel': 'normal'
			},
			'IncrementalUpdates': 'true',
			'UpdateInterval': 'PT10S',
		}
	};
};

