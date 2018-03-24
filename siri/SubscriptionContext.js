var moment = require('moment');

module.exports = function(interval = 'PT15S') {
	return {
		'SubscriptionContext': {
			'HeartbeatInterval': interval
		}
	};
};
