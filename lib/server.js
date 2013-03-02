var restify = require('restify');
var passport = require('passport');
var TwoLeggedStrategy = require('passport-http-2legged-oauth').Strategy;
var requestTimeout = 30; // Timeout for the timestamp in seconds
var fs = require('fs');
var packageInformation = JSON.parse(fs.readFileSync(__dirname + '/../package.json', 'utf8'));

var QueueServer = function(options, done) {

    var self = this;
    this.queueList = [];
    this.queueMap = {};

    if (typeof options == 'function') {
        done = options;
        delete options;
    }

    // options
    options = options || {};
    this.options = {};
    this.options.security = options.security || 'none';
    this.options.key = options.key || 'this is the default key';
    this.options.secret = options.secret || 'this is not so secret';
    this.options.url = options.url || '127.0.0.1';
    this.options.port = options.port || 8080;
    this.options.timeout = options.timeout || 10000;

    // Create server
    var server = this.server = restify.createServer({
        name: packageInformation.name,
        version: packageInformation.version,
        formatters: {
            'application/json': function(req, res, body) {
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                body = typeof body == 'string' ? body : JSON.stringify(body);
                if(req.params && req.params.callback){
                    var callbackFunctionName = req.params.callback.replace(/[^A-Za-z0-9_\.]/g, '');
                    return callbackFunctionName + "(" + body + ");";
                } else {
                    return body;
                }
            },
            'text/css': function formatCSS(req, res, body) {
                if (typeof (body) === 'string')
                    return body;
                return '';
            },
            'text/html': function(req, res, body){
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                return body;
            }
        }
    });


    server.use(restify.queryParser());
    server.use(restify.bodyParser());
    server.use(passport.initialize());

    // setup all security
    setupSecurity.apply(this);
    var passportSecurity = passport.authenticate('oauth', { session: false });

    // create the add endpoint to add items to the queue
    server.post('/add', [ passportSecurity, bind(this.addItemToQueue, this) ] );
    server.get('/get', [ passportSecurity, bind(this.getItemFromQueue, this) ] );


    server.listen(this.options.port, function(err) {
        if (typeof done == 'function') {
            done();
        }
    });

    function bind(fn, scope) {
        return function () {
            return fn.apply(scope, arguments);
        }
    }

}

QueueServer.prototype.getItemFromQueue = function(req, res, next) {

    var self = this;

    // first of we sort and remove old items
    this.queueList.sort(function(a,b) {
        return a.timestamp - b.timestamp;
    });

    var newMap = {};
    var newList = [];
    for(var i = 0, ii = this.queueList.length; i < ii; i++){
        var item = this.queueList[i];
        var acceptedTime = (new Date()).getTime() - self.options.timeout;
        if (item.timestamp >= acceptedTime) {
            newList.push(item);
            newMap[item.key] = item;
        }
        else {
            break;
        }
    }

    this.queueMap = newMap;
    this.queueList = newList;

    var itemToServe = this.queueList.length > 0 ? this.queueList[0] : null;

    if (itemToServe !== null) {
        res.send(item);
    }
    else {
        res.send({empty: true});
    }

    return next();
    //if (typeof self.options.add == 'function') {
    //self.options.add(req.params, function(err, key, data) {
    //if (err) {
    //res.send(500, err);
    //}
    //else {
    //self.addItemToQueue(key, data);
    //res.send({ok: true});
    //return next();
    //}
    //});
    //}
    //else {
    //}
};

QueueServer.prototype.addItemToQueue = function(req, res, next) {
    var self = this;
    if (typeof self.options.add == 'function') {
        self.options.add(req.params, function(err, key, data) {
            if (err) {
                res.send(500, err);
            }
            else {

                if (self.queueMap[key]) {
                    // dont do anything if its already in the queue
                }
                else {

                    var queueItem = {
                        key: key,
                        data: data,
                        timestamp: (new Date()).getTime()
                    };

                    self.queueMap[key] = queueItem;
                    self.queueList.push(queueItem);

                }

                res.send({ok: true});
                return next();
            }
        });
    }
    else {
        res.send({ok: true});
        return next();
    }
};

QueueServer.prototype.setAddCallback = function(callback) {
    this.options.add = callback;
};

QueueServer.prototype.close = function(callback) {
    this.server.close(function() {
        if (callback) {
            callback();
        }
    });
};


module.exports = function(options, next) {
    return new QueueServer(options, next);
}

function setupSecurity() {

    var self = this;

    passport.use(new TwoLeggedStrategy(checkAppKey, checkTimestampAndNonce));

    // Check if the key is valid and get the secret
    function checkAppKey(consumerKey, done) {
        if (consumerKey === self.options.key) {
            var secret = encodeURIComponent(self.options.secret);
            done(null, { id: 1, ok: true }, secret);
        }
        else {
            done({notok: true});
        }
    }

    // Check if the timestamp is ok
    // And make an addiotional check to see if the app has access to what it wants
    function checkTimestampAndNonce(timestamp, nonce, app, req, done) {

        var timeDelta = Math.round((new Date()).getTime() / 1000) - timestamp;
        if (timeDelta >= requestTimeout) {
            done(null, false);
        }
        else {
            done(null, true);
        }

    }

}

