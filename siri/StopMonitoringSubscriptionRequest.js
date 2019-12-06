var moment = require('moment');
var uuidv4 = require('uuid/v4');

module.exports = function(subLength = 5, stopId = '1590005001') {
	if (!Array.isArray(stopId)) {
		stopId = [stopId];
	}

	return {'StopMonitoringSubscriptionRequest': stopId.map((sid) => {
		return generateSubReq(subLength, sid);
	})};
};

function generateSubReq(subLength, stopId) {
	return {
		'SubscriberRef': 'LVF',
		'SubscriptionIdentifier': uuidv4(),
		'InitialTerminationTime': moment().add(subLength, 'm').format(),
		'StopMonitoringRequest': {
			'@version': '1.3',
			'RequestTimestamp': moment().format(),
			'PreviewInterval': 'PT30M',
			'MonitoringRef': stopId,
			'StopVisitTypes': 'all',
			'Language': 'en',
			'MaximumStopVisits': 12,
			'StopMonitoringDetailLevel': 'normal',
		},
		'IncrementalUpdates': 'true',
		'ChangeBeforeUpdates': 'PT10S'
	};
}
