var moment = require('moment');
var SubscriptionContext = require('./SubscriptionContext.js');
var VehicleMonitoringSubscriptionRequest = require('./VehicleMonitoringSubscriptionRequest.js');

module.exports = function(
	consumerAddress = 'http://siri.lvf.io',
	requestorRef = 'LVF',
	context = SubscriptionContext(),
	vmSubReq = VehicleMonitoringSubscriptionRequest()
) {
	return {
		'SubscriptionRequest': Object.assign({
			'RequestTimestamp': moment().format(),
			'RequestorRef': requestorRef,
			'ConsumerAddress': consumerAddress,
		}, context, vmSubReq)
	};
};

