var fs = require('fs');
var http = require("http");
var https = require("https");
var url = require('url');
var qs = require('querystring');
var crypto = require("crypto");
var redis = require("redis");
var mongo = require('mongoskin');
var fbapi = require('fbgraph');

//settings
//more settings are on the server
var refreshTime = 60000; //ms

//
var appHandlers = {};
var app = {};
app.on = function(name,callback){
    appHandlers[name] = callback;
}

function errorHandler(err,data){
    if(err) console.error((new Date()).toString() + ' - Error!\n' + err + err.stack + '\ndata:' + data);
}

//Connect to MongoDB data
var mongoData= mongo.db(mongourl);
var users = mongoData.collection('user');
var messages = mongoData.collection('messages');

//mongoDB operations
function sendMessage(dest,msg){

    messages.insert({_id:Date.now(),d:dest,s:msg.s,m:msg.m},{safe:true},errorHandler);

}

//Connect to Redis data
var redisData = redis.createClient();
redisData.on("connect",function(reply){ console.log("Redis is connected!"); });
redisData.on("end",function(reply){ console.log("Redis connection was closed!"); });
redisData.on("error", function (err) {
    console.error('Redis Error!\n' + err + err.stack);
});

function info(){
    console.log("\n# Server info:");
	console.log('It is ' + Date.now() + ' - ' + (new Date()).toString());
    redisData.info(function(err,reply){
        console.log("## Redis info");
        console.log(reply);
    });
}

function exit(){

    info();
    console.log('\n# Exiting server');
    server.close();
    mongoData.close();
    redisData.quit();
    process.exit(0);
}

process.on('SIGTERM',exit);

function hackError(response){
	response.writeHead(200, {'Content-Type':'text/json'});
	response.end('{"r":-1,"error":"hackz"}');
}

function errorResponse(response,err){
    response.writeHead(200, {'Content-Type':'text/json'});
    response.end(JSON.stringify({r:-1,error:err.toString(),stack:err.stack.toString()}));
}

function sessionExpired(response){
	response.writeHead(200, {'Content-Type':'text/json'});
	response.end('{"r":-1,"error":"sessionExpired"}');
}

function addUser(userid,pwd){
    var hash = crypto.createHmac('sha1',userid).update(pwd).update(passwordSecret).digest('base64');
    users.insert({_id:userid,p:hash},{safe:true},errorHandler);
    redisData.hmset('u' + userid,{"t": Date.now() + refreshTime,"b":6,"n":4});
}

redisData.hmset('uadmin',{"t": Date.now() + refreshTime,"b":6,"n":4});

app.on('/api/debug',function(request,response){
    response.writeHead(200,{'Content-type':'text/html'});

    response.write('It is ' + Date.now() + ' - ' + (new Date()).toString());
    redisData.keys("*", function (err, keys) {
        response.write('<h2>Redis keys:</h2><br>\n');
        keys.forEach(function (key, pos) {
            redisData.type(key, function (err, keytype) {
                response.write(key + " : " + keytype + '<br>\n');

            });

        });
    });
    setTimeout('response.end()',150);
});

app.on('/api/query',function(request,response){

});




function addExternalUser(id,callback){
    redisData.exists(id,function(err,exists){
        console.log(' ' + (typeof exists) + ' : ' + exists);
        if(!exists){
            console.log('New external user' + id);
            redisData.hmset(id,{"t": Date.now() + refreshTime,"b":6,"n":4});
        }
    });
}

//touches user's data
function touchUserData(userid,handler){
    console.log("Touching user " + userid);
    redisData.hgetall(userid,function(err,data){
        var t = Date.now();
        if(data.t <= t){
            console.log(userid + " - refreshing data.");
            data = {"t":t+refreshTime,"b":6,"n":4};
            redisData.hmset(userid,data);
        }
        handler(data);
    });
}



//returns the userid from session cookie
function getUserId(request,response,handler){
    var found = false;
    request.headers.cookie && request.headers.cookie.split(';').forEach(function( cookie ) {
        var split= cookie.split('=');
        if(split[0].trim() === 'sid'){
            var sid = split[1].trim();
            redisData.get(sid,function(err,userid){
                if(userid !== null){
                    handler(userid);
                }
                else sessionExpired(response);
            });
            found=true;
        }
    });
    if(found === false) sessionExpired(response);
}

function getCookies(request){
    request.cookies = {};
    request.headers.cookie && request.headers.cookie.split(';').forEach(function( cookie ) {
        var split= cookie.split('=');
        request.cookies[split[0]]=split[1];
        console.log('Cookie - ' + request.cookies[split[0]]);
    });
}

function getUser(request,response,handler){
    getUserId(request,response,function(userid){
        touchUserData(userid,function(userdata){
            handler(userid,userdata);
        });
    });
}

//onQuery
function onQuery(request,response){
    getUserId(request,response,function(userid){
        touchUserData(userid,function(user){
            console.log(' Logged in as ' + userid);
            response.writeHead(200, {'Content-Type':'text/json'});
            response.end('{"r":0,"b":'+user.b+',"n":'+user.n+'}');
        });
    });
}

function genSessionCookie(uid,expires){
    var sid = crypto.createHash('md5').update(uid).update(sessionSecret).update(Date.now().toString()).digest('hex');
    console.log("New session created - " + sid + ':' + uid);
	//TODO check for collisions
    redisData.set(sid,uid);
    redisData.expire(sid,expires); //session expiration (seconds)
    return 'sid='+sid+'; Path=/api/; Max-Age='+expires+'; HttpOnly';
}

//onLogin - data := { userid , pwd }
function onLogin(response,data){
    var userid = data.userid;
	var hash = crypto.createHmac('sha1',userid).update(data.pwd).digest('base64');

    //Query user collection for the appropriate user
    users.findOne({_id:userid},function(err,user){
        if(err){
            errorResponse(response,err);
        }
        else if(user !== null && user.p == hash){
            userid = 'u' + userid;
             //Query userdata collection for relevent userdata
            touchUserData(userid,function(userdata){
                response.writeHead(200, {
                    'Content-Type': 'text/json',
                    'Set-Cookie':genSessionCookie(userid,3600)
                });
                response.end('{"r":0,"b":'+userdata.b+',"n":'+userdata.n+'}');
            });
        }
        else {
            response.writeHead(200, {'Content-Type':'text/json'});
            response.end('{"r":-1}');
        }
    });
}

//onBottle - data := { msg }
function onBottle(request,response,data){
	getUser(request,response,function(userid,user){
        redisData.hincrby(userid,'b',-1,function(err,bottles){
            if(bottles >= 0) {
                response.writeHead(200, {'Content-Type':'text/json'});
                response.end('{"r":'+bottles+'}');

                var bottle = '{"s":"'+userid+'","m":"'+data.msg+'"}';
                redisData.lpush('bottle',bottle);
                console.log(' Submitted new bottle - usr: ' + JSON.stringify(user) +' msg: ' + bottle);
            }
            else hackError(response);
        });
	});
}


function popBottle(userid,handler){
	redisData.rpop('bottle',function(err,bottle){
		console.log(' bottle popped ' + bottle);
		if(bottle !== null){
            if(bottle.s === userid){
                console.log('Sender is reciever!');
            }
			handler(JSON.parse(bottle));
		}
		else{
			console.log('error popping bottle');
		}
	});
}

function onNet(request,response){
	getUser(request,response,function(userid,user){
		console.log('Catching net by ' + userid);
        redisData.hincrby(userid,'n',-1,function(err,nets){
            if(nets >= 0) popBottle(userid,function(bottle){
                //Send message to the user
                var token = Date.now();
                messages.insert({_id:token,d:userid,s:bottle.s,m:bottle.m},{safe:true},errorHandler);

                response.writeHead(200, {
                    'Content-Type':'text/json',
                    'Set-Cookie':'tt='+token+'; Path=/api/throwback; HttpOnly' //send back a token which is needed for throwback
                });
                response.end('{"r":'+nets+',"msg":"'+bottle.m+'"}');

                console.log(' Bottle caught - {sender: ' + bottle.s +' msg: ' + bottle.m + ' } ');
            });
            else hackError(response);
        });
	});
}


function onThrowback(request,response){
    getUserId(request,response,function(userid){
        var token = null;
        request.headers.cookie && request.headers.cookie.split(';').forEach(function( cookie ) {
            var split= cookie.split('=');
            if(split[0].trim() === 'tt'){
                token = split[1].trim();
            }
        });
        if(token !== null){
            token = Number(token);
            console.log('Throwing back a bottle with token - '+token);

            messages.remove({_id:token,d:userid},errorHandler);
            response.writeHead(200, {
                'Content-Type':'text/json',
                'Set-Cookie':'tt=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly' //delete throwback cookie
            });
            response.end('{"r":0}');
        }
        else hackError(response);
    });
}

function respondError(response,msg){
    response.writeHead(500, {'content-type': 'text/plain' });
    response.write('ERROR:' + msg);
    response.end('\n');	
}

function onFBlogin(request,response,query){
    if(query.code){
        console.log('Successfull FB login with code: ' + query.code);
        fbapi.authorize({
            "client_id":        '233473013410744'
            , "redirect_uri":   'http://199.30.59.142/api/fblogin'
            , "client_secret":  facebookSecret
            , "code":           query.code
        }, function (err, fbres) {
            if(err){
                console.log("FB authorization failed!");
                response.writeHead(200);
                response.end("<script>window.location.href = 'http://199.30.59.142'</script>");
            }else{
                console.log("FB authorized - " + fbres.access_token + "; expires:" + fbres.expires);
                fbapi.get('me',function(err,fbdata){
                    if(err) console.log("FB me failed!");
                    else {
                        console.log("FB me succedded - ");
                        var uid = 'x' + fbdata.id;
                        addExternalUser(uid);
                        response.writeHead(200,{'Set-Cookie':genSessionCookie(uid,fbres.expires)});
                        response.end("<script>window.location.href = 'http://199.30.59.142'</script>");
                    }
                });

            }

        });
    }
    else{
        console.log('FB login unsucessfull: ' + query.error + query.error.description);
        respondError(response,'fuu');
    }
}

function respond(request,response){
    try {
        console.log((new Date()).toString() + ' - Request recieved ' + request.url + ' method:' + request.method);
        if(request.method === 'GET'){
            if(request.url === '/api/query') onQuery(request,response);
            else if(request.url === '/api/catch') onNet(request,response);
            else if(request.url === '/api/throwback') onThrowback(request,response);
            else if(request.url === '/api/debug') onDebug(request,response);
            else {
                var u = url.parse(request.url,true);
                if(u.pathname == '/api/fblogin') onFBlogin(request,response,u.query);
                else {
                    var handler = appHandlers[u.pathname];
                    if(handler) handler(request,response);
                    else respondError(response,'Invalid url ' + u.pathname);
                }
            }

        }
        else if(request.method === 'POST'){
            var body = '';
            request.on('data', function (data) {
                body += data;
                if (body.length > 100000) {
                    // FLOOD ATTACK OR FAULTY CLIENT, NUKE REQUEST
                    request.connection.destroy();
                }
            });
            request.on('end', function () {
                var POST = qs.parse(body);
                // use POST
                if(request.url === '/api/throw') onBottle(request,response,POST);
				else if(request.url === '/api/reply') onReply(request,response,POST);
                else if(request.url === '/api/login') onLogin(response,POST);
                else
                    respondError(response,'Invalid POST url: ' + request.url);

            });
        }else respondError(response,'Invalid method ' + request.method);
    }
    catch(exeption){
        respondError(response,'Error: ' + JSON.stringify(exeption));
        exit();
    }
}

var server = http.createServer(respond);
server.listen(8000);
console.log("Bottle server up & running at http://127.0.0.1:8000/");
console.log('It is ' + (new Date()).toString());

