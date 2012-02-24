var http = require("http");
var url = require('url');
var qs = require('querystring');
var crypto = require("crypto");
var redis = require("redis");
var mongo = require('mongoskin');
var fbapi = require('fbgraph');

//settings
//more settings are on the server
var refreshTime = 180 * 1000; //ms

//
var appHandlers = {};
var app = {};
app.on = function(name,callback){
    appHandlers[name] = callback;
};

function errorHandler(err,data){
    if(err) console.error((new Date()).toString() + ' - Error!\n' + err + err.stack + '\ndata:' + data);
}

//Connect to MongoDB data
var mongoData= mongo.db(mongourl);
var users = mongoData.collection('user');
var conversations = mongoData.collection('conversations');
var messages = mongoData.collection('messages');

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






function addExternalUser(id,callback){
    redisData.exists(id,function(err,exists){
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
    var sid = request.cookies['sid'];
    if(sid){
        console.log('SID - ' + sid);
        redisData.get(sid,function(err,userid){
            if(userid !== null){
                handler(userid);
            }
            else sessionExpired(response);
        });
    }
    else sessionExpired(response);
}


function getUser(request,response,handler){
    getUserId(request,response,function(userid){
        touchUserData(userid,function(userdata){
            handler(userid,userdata);
        });
    });
}

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
    getUserId(request,response,function(userid){
        touchUserData(userid,function(user){
            console.log(' Logged in as ' + userid);
            response.writeHead(200, {'Content-Type':'text/json'});
            response.end('{"r":0,"b":'+user.b+',"n":'+user.n+'}');
        });
    });
});



function genSessionCookie(uid,expires){
    var sid = crypto.createHash('md5').update(uid).update(sessionSecret).update(Date.now().toString()).digest('hex');
    console.log("New session created - " + sid + ':' + uid);
	//TODO check for collisions
    redisData.set(sid,uid);
    redisData.expire(sid,expires); //session expiration (seconds)
    return 'sid='+sid+'; Path=/api/; Max-Age='+expires+'; HttpOnly';
}

//onLogin - data := { userid , pwd }
app.on('/api/login',function(request,response,data){
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
});

//onBottle - data := { msg }
app.on('/api/throw',function(request,response,data){
	getUser(request,response,function(userid,user){
        redisData.hincrby(userid,'b',-1,function(err,bottles){
            if(bottles >= 0) {
                response.writeHead(200, {'Content-Type':'text/json'});
                response.end('{"r":'+bottles+'}');

                var bottle = '{"s":"'+userid+'","m":"'+data.msg+'"}';
                redisData.lpush('_bottles',bottle);
                console.log(' Submitted new bottle - usr: ' + JSON.stringify(user) +' msg: ' + bottle);
            }
            else hackError(response);
        });
	});
});


function popBottle(userid,handler,probability){
    if(!probability) probability = 0.1;
    console.log('Trying to catch a bottle with probability of ' + probability + ' by ' + userid);
    if(Math.random() > probability){
        redisData.rpop('_bottles',function(err,bottle){
            if(bottle !== null){
                console.log(' bottle popped ' + bottle);
                bottle = JSON.parse(bottle);
                if(bottle.s === userid){
                    console.log(' Sender is reciever! - going for one more round');
                    redisData.lpush('_bottles',JSON.stringify(bottle));
                    popBottle(userid,handler,probability + 0.4);
                }
                else handler(bottle);
            }
            else{
                console.log(' error popping bottle - junk will be popped!');
                handler({j:'Junk'});
            }
        });
    }
    else handler({j:'Junk'});
}

app.on('/api/catch',function (request,response){
	getUser(request,response,function(userid,user){
        redisData.hincrby(userid,'n',-1,function(err,nets){
            if(nets >= 0) popBottle(userid,function(bottle){
                if(bottle.m){
                    //Send message to the user
                    var token = Date.now();
                    response.writeHead(200, {
                        'Content-Type':'text/json',
                        'Set-Cookie':'tt='+token+'; Path=/api/bottle/; HttpOnly' //send back a token which is needed for throwback
                    });
                    response.end('{"r":'+nets+',"m":"'+bottle.m+'"}');
                    messages.insert({
                        _id:token,t:token,
                        r:userid,s:bottle.s,
                        d:[
                            {s:bottle.s,m:bottle.m}
                        ]
                    });
                }
                else{
                    response.writeHead(200, { 'Content-Type':'text/json' });
                    response.end('{"r":'+nets+',"j":"'+bottle.j+'"}');
                }
            });
            else hackError(response);
        });
	});
});

//onReply
app.on('/api/bottle/reply',function(request,response,data){
    getUserId(request,response,function(userid){
        var token = request.cookies['tt'];
        if(token !== null){
            token = Number(token);
            console.log('Reply to a bottle by user ' + userid + ' : ' + data.m + ' with token ' + token);
            messages.update({_id:token,r:userid},
                {$set:{t:Date.now()},$inc: { e:1 },$push: { d:{s:userid,m:data.m} }},{safe:true},errorHandler); //$push: { d:data.m }$set: { t:Date.now() } , $inc: { e:1 }
        }
        response.writeHead(200, {
            'Set-Cookie':'tt=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly' //delete throwback cookie
        });
        response.end();
    });
});

app.on('/api/bottle/recycle',function (request,response){
    getUserId(request,response,function(userid){
        var token = request.cookies['tt'];
        if(token !== null){
            token = Number(token);
            console.log('Throwing back a bottle with token - '+token);
            messages.findAndModify({'_id':token,'r':userid},[['s','asc']],{},{remove:true},function(err,bottle){
                if(!err){
                    console.log('Bottle is being recycled!');
                    redisData.lpush('_bottles','{"s":"'+bottle.s+'","m":"'+bottle.m+'"}');
                }
            });
        }
        response.writeHead(200, {
            'Set-Cookie':'tt=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly' //delete throwback cookie
        });
        response.end();
    });
});


app.on('/api/fblogin',function(request,response){
    var code = request.parsedUrl.query.code;
    if(code){
        console.log('Successfull FB login with code: ' + code);
        fbapi.authorize({
            "client_id":        '233473013410744'
            , "redirect_uri":   'http://199.30.59.142/api/fblogin'
            , "client_secret":  facebookSecret
            , "code":           code
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
        console.log('FB login unsucessfull: ' + request.parsedUrl.query.error + request.parsedUrl.query.description);
        response.writeHead(200);
        response.end("<script>window.location.href = 'http://199.30.59.142'</script>");
    }
});

function respond(request,response){
    try {
        console.log((new Date()).toString() + ' - Request recieved ' + request.url + ' method:' + request.method);
        request.parsedUrl = url.parse(request.url,true);
        var handler = appHandlers[request.parsedUrl.pathname];
        if(handler){
            //parse cookies
            request.cookies = {};
            request.headers.cookie && request.headers.cookie.split(';').forEach(function( cookie ) {
                var parts = cookie.split('=');
                request.cookies[ parts[ 0 ].trim() ] = ( parts[ 1 ] || '' ).trim();
            });
            //select method
            if(request.method === 'POST'){
                var body = '';
                request.on('data', function (data) {
                    body += data;
                    if (body.length > 100000) {
                        // FLOOD ATTACK OR FAULTY CLIENT, NUKE REQUEST
                        request.connection.destroy();
                    }
                });
                request.on('end', function () {
                    handler(request,response,qs.parse(body));
                });
            }
            else handler(request,response);
        }
        else request.connection.destroy();
    }
    catch(exeption){
        console.error('Exeption caught - ' + exeption.toString());
        request.connection.destroy();
        exit();
    }
}

var server = http.createServer(respond);
server.listen(8000);
console.log("Bottle server up & running at http://127.0.0.1:8000/");
console.log('It is ' + (new Date()).toString());

