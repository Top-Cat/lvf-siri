var builder = require('xmlbuilder');
var request = require('request');

function makeRequest(req) {
	var mReq = Object.assign(req, {
		'@xmlns': 'http://www.siri.org.uk/siri',
		'@xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
		'@xsi:schemaLocation': 'http://www.kizoom.com/standards/siri/schema/1.3/siri.xsd',
		'@version': '1.3',
	});

	var feed = builder.create({
		'Siri': mReq
	});

//	console.log(feed.end({pretty: true}));
	request.post({
		'uri': process.env.SIRI_URI,
		'body': feed.end(),
		'auth': {
			'user': process.env.SIRI_USER,
			'pass': process.env.SIRI_PASS
		}
	}, function(err,httpResponse,body) { /*console.log(body);*/ });
}


module.exports = {
	makeRequest: makeRequest
};
