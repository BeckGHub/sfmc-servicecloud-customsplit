'use strict';

const Path = require('path');
const Pkg = require(Path.join(__dirname, '..', 'package.json'));
const express = require('express');

// Helper utility for verifying and decoding the jwt sent from Salesforce Marketing Cloud.
const verifyJwt = require(Path.join(__dirname, 'lib', 'jwt.js'));
// Helper class that handles all the interactions with Salesforce Service Cloud
// and makes sure open connections are reused for subsequent requests.
const ServiceCloud = require(Path.join(__dirname, 'lib', 'sfdc.js'));
const sfdc = new ServiceCloud(Pkg.options.salesforce.serviceCloud);

const app = express();

// Register middleware that parses the request payload.
app.use(require('body-parser').raw({
	type: 'application/jwt'
}));

// Route that is called for every contact who reaches the custom split activity
app.post('/activity/execute', (req, res) => {
console.log('/activity/execute req.body:' + JSON.stringify(req.body));
	verifyJwt(req.body, Pkg.options.salesforce.marketingCloud.jwtSecret, (err, decoded) => {
		// verification error -> unauthorized request
console.log('decoded111:' + JSON.stringify(decoded));
		if (err) {
			console.error(err);
			return res.status(401).end();
		}

		if (decoded && decoded.inArguments && decoded.inArguments.length > 0) {
			let serviceCloudId;

serviceCloudId = decoded.inArguments[0].serviceCloudId;
let email = decoded.inArguments[0].email;
let sfdcUsername = decoded.inArguments[0].sfdcUsername;
if(serviceCloudId && email && sfdcUsername) {
	res.redirect('/jwt?isSandbox=false&jwtUserName=' + sfdcUsername);
	return;
}

			// TODO: Read the Service Cloud object's Id from inArguments here and
			// write it to the serviceCloudId variable

if(!serviceCloudId) {
	return res.status(200).json({branchResult: 'Test Path 1'});
}

			// Call the function that retrieves desired data from Service Cloud
			sfdc.retrieveFieldOfObject(serviceCloudId, (err, fieldValue) => {

if (fieldValue != null) {
	return res.status(200).json({branchResult: 'Test Path 2'});
}
				if (err) {
					console.error(err);
					return res.status(500).end();
				}

				// Check the returned value to make the decision which path should be
				// followed and return the branchResult accordingly.
				if (fieldValue === '<FIELD VALUE THAT LEADS RESULT TO PATH 1>') {
					return res.status(200).json({branchResult: '<KEY FOR PATH 1>'});
				} else {
					return res.status(200).json({branchResult: '<KEY FOR PATH 2>'});
				}
			});
		} else {
			console.error('inArguments invalid.');
			return res.status(400).end();
		}
	});
});

// Routes for saving, publishing and validating the custom activity. In this case
// nothing is done except decoding the jwt and replying with a success message.
app.post(/\/activity\/(save|publish|validate)/, (req, res) => {
console.log('/activity/(save|publish|validate) req.body:' + JSON.stringify(req.body));
	verifyJwt(req.body, Pkg.options.salesforce.marketingCloud.jwtSecret, (err, decoded) => {
		// verification error -> unauthorized request
console.log('decoded222:' + JSON.stringify(decoded));

res.redirect('/jwt?isSandbox=false&jwtUserName=beck.wu@dev11.charket.com');

		if (err)	return res.status(401).end();

		return res.status(200).json({success: true});
	});
});

///////////////////////////////////////
const fs = require('fs');
const nJwt = require('njwt');
const base64url = require('base64-url');
const request = require('request');

const jwt_consumer_key = '3MVG9_zfgLUsHJ5o0lJkL.OTEqd6mjg8Zp6rcNfQEUFQSF4y0Mt.HyGG7xXeO_DPQ22O1etc4wro.2nR_ydd2';
const jwt_aud = 'https://login.salesforce.com';
const apiVersion = 'v38.0';

app.get('/jwt', function (req,res){  
	var isSandbox = req.query.isSandbox;
	var sfdcURL = 'https://login.salesforce.com/services/oauth2/token' ;
	if(isSandbox == 'true'){
		sfdcURL = 'https://test.salesforce.com/services/oauth2/token' ;
	}
	var sfdcUserName = req.query.jwtUserName;
	var token = getJWTSignedToken_nJWTLib(sfdcUserName); 
	  
	var paramBody = 'grant_type='+base64url.escape('urn:ietf:params:oauth:grant-type:jwt-bearer')+'&assertion='+token ;	
	var req_sfdcOpts = { 	url : sfdcURL,  
							method:'POST', 
							headers: { 'Content-Type' : 'application/x-www-form-urlencoded'} ,
							body:paramBody 
						};
				
	request(req_sfdcOpts, 
		function(err, remoteResponse, remoteBody) {
			// var authorInfo = extractAccessToken(err, remoteResponse, remoteBody, res); 
			console.log(remoteBody) ;
			var sfdcResponse = JSON.parse(remoteBody); 
			if(sfdcResponse.access_token){	
				sendNotification(sfdcResponse, request);			 
			}else{
				console.log('Some error occurred. Make sure connected app is approved previously if its JWT flow, Username and Password is correct if its Password flow. ');
				console.log(' Salesforce Response : ');
				console.log( remoteBody ); 
			} 
		} 
	); 

	res.end();
} );

function sendNotification(sfdcResponse, request) {
	var options = { method: 'GET',
		  url: sfdcResponse.instance_url + '/services/apexrest/JourneyBuilder/v1/execute',
		  headers: { 'cache-control': 'no-cache',
		     'content-type': 'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW',
		     authorization: 'Bearer ' + sfdcResponse.access_token },
		  formData: {} };

	request(options, function (error, response, body) {
	  if (error) throw new Error(error);

	  console.log(body);
	});
}

function getJWTSignedToken_nJWTLib(sfdcUserName){ 
	var claims = {
	  iss: jwt_consumer_key,   
	  sub: sfdcUserName,     
	  aud: jwt_aud,
	  exp : (Math.floor(Date.now() / 1000) + (60*3))
	}

	return encryptUsingPrivateKey_nJWTLib(claims);
}

function encryptUsingPrivateKey_nJWTLib (claims) {
	var absolutePath = Path.resolve("backend/key.pem"); 	
    var cert = fs.readFileSync(absolutePath );	
	var jwt_token = nJwt.create(claims,cert,'RS256');	
	console.log(jwt_token);	
	var jwt_token_b64 = jwt_token.compact();
	console.log(jwt_token_b64);
 
	return jwt_token_b64;     
};

function extractAccessToken(err, remoteResponse, remoteBody,res){
	if (err) { 
		return res.status(500).end('Error'); 
	}
	console.log(remoteBody) ;
	var sfdcResponse = JSON.parse(remoteBody); 
	
	/*
	//success
	if(sfdcResponse.access_token){				 
		res.writeHead(302, {
		  'Location': 'Main' ,
		  'Set-Cookie': ['AccToken='+sfdcResponse.access_token,'APIVer='+apiVersion,'InstURL='+sfdcResponse.instance_url,'idURL='+sfdcResponse.id]
		});
	}else{
		res.write('Some error occurred. Make sure connected app is approved previously if its JWT flow, Username and Password is correct if its Password flow. ');
		res.write(' Salesforce Response : ');
		res.write( remoteBody ); 
	} 
	res.end();
	*/
}


// Serve the custom activity's interface, config, etc.
app.use(express.static(Path.join(__dirname, '..', 'public')));

// Start the server and listen on the port specified by heroku or defaulting to 12345
app.listen(process.env.PORT || 12345, () => {
	console.log('Service Cloud customsplit backend is now running!');
});

