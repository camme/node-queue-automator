var restify = require('restify');
var passport = require('passport');
var TwoLeggedStrategy = require('passport-http-2legged-oauth').Strategy;
var requestTimeout = 30; // Timeout for the timestamp in seconds
var fs = require('fs');
var socketio = require('socket.io');
var packageInformation = JSON.parse(fs.readFileSync(__dirname + '/../package.json', 'utf8'));
var http = require('http');
var stylus = require('stylus');

var QueueServer = function(options, done) {

    var self = this;
    this.queueList = [];
    this.queueActiveList = [];
    this.queueMap = {};
    this.serverOpen = false;
    this.clientList = [];
    this.clientListMap = {};

    if (typeof options == 'function') {
        done = options;
        delete options;
    }

    // options
    options = options || {};

    this.options = {};
    this.options.security = options.security || 'none';
    this.options.method = options.method || 'socket';
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
    var passportSecurity;
    if (this.options.security === 'oauth') {
        passportSecurity = passport.authenticate('oauth', { session: false });
    }
    else {
        passportSecurity = function(req, res, next) { return next() };
    }

    // create the add endpoint to add items to the queue
    server.get('/add', [ passportSecurity, bind(this.addItemToQueueRequestHandler, this) ] );
    //server.get('/get', [ passportSecurity, bind(this.getItemFromQueue, this) ] );

    server.get('/info', [ passportSecurity, bind(this.serverFile('/public/index.html'), this) ] );
    server.get('/scripts/info.js', [ passportSecurity, bind(this.serverFile('/public/scripts/info.js'), this) ] );
    server.get('/css/style.css', [ passportSecurity, bind(this.serverFile('/public/css/style.css'), this) ] );

    var io = this.io = socketio.listen(server.server, {log: false});

    io.configure(function(){
        io.set('log level', 3);
    });


    function sendClients(socket) {

        var clients = self.io.sockets.clients('workers');

        var list = [];

        clients.forEach(function(client) {
            list.push({
                ip: client.handshake.address,
                id: client.id,
                free: client._free
            });
        });


        if (!socket) {
            io.sockets.in('webbrowsers').emit('client-list', {clients: list});
        }
        else {
            socket.emit('client-list', {clients: list});
        }

    }

    setInterval(sendClients, 5000);

    io.sockets.on('connection', function(socket) {

        var client = socket;

        //self.clientList.push(client);
        self.clientListMap[client.id] = client;

        client.on('i-am-a-web-browser', function() {
            client.join('webbrowsers');
            sendClients(client);
        });

        client.on('i-am-a-worker', function() {

            client.join('workers');    
            client._free = true;

            client.on('add', function(itemData) {
                self.addItemToQueue(itemData.key, itemData.data);
            });

            client.on('resolve-queue-item', function(data) {

                client._free = true;
                //console.log(client.id + " is now free");

                if (typeof self.options.process == 'function') {
                    self.options.process(data.key, data.result, function(err) {
                        if (!err) {

                            var newActiveList = [];
                            for(var i = 0, ii = self.queueActiveList.length; i < ii; i++){
                                var item = self.queueActiveList[i];
                                if (item.key != data.key) {
                                    newActiveList.push(item);
                                }
                                else {
                                    //console.log(" REMOVED " + data.key + " FROM ACTIVE LIST");
                                }
                            }


                            var newList = [];
                            for(var i = 0, ii = self.queueList.length; i < ii; i++){
                                var item = self.queueList[i];
                                if (item.key != data.key) {
                                    newList.push(item);
                                }
                                else {
                                    //console.log(" REMOVED " + data.key + " FROM LIST");
                                }
                            }

                            self.queueActiveList = newActiveList;
                            self.queueList = newList;

                            delete self.queueMap[data.key];

                            setTimeout(function() {
                                self.serveNextQueueItem();
                            }, 100);

                        }
                    });
                }

            });

        });

        //console.log("NEW CLIENT: ", client.id);

        client.emit("connected");

        client.on('disconnect', function() {

            //console.log("Try to remove clients");
            //var newList = [];
            //for(var i = 0, ii = self.clientList.length; i < ii; i++){
            //if (self.clientList[i].id != client.id) {
            //newList.push(self.clientList[i]);
            //}
            //}
            delete  self.clientListMap[client.id];

            self.serveNextQueueItem();
        });

    });

    server.listen(this.options.port, function(err) {
        self.serverOpen = true;
        if (typeof done == 'function') {
            done();
        }
    });

    setInterval(bind(this.serveNextQueueItem, this), 5000);

    function bind(fn, scope) {
        return function () {
            return fn.apply(scope, arguments);
        }
    }

}

QueueServer.prototype.getInformation = function(req, res, next) {

    var self = this;

    res.setHeader('Content-Type', 'text/html');

    var html = '<!DOCTYPE HTML>';
    html += '<html lang="en"><head><meta charset="UTF-8"><title>Queue Automator Server</title>';
    html += '<style>* {font-family: arial; color: #666666; }</style>';
    html += '</head><body>';

    html += '<div class="client-list">';
    html += '<h2>Client list</h2>';
    html += '<table><thead><tr><th>ID</th><th>FREE</th></tr></thead><tbody>';

    var clients = self.io.sockets.clients('workers');
    for(var i = 0, ii = clients.length; i < ii; i++){
        html += '<tr>';
        html += '<td>' + clients[i].id + '</td>';
        html += '<td>';
        html += clients[i]._free ? "true" : "false";
        html += '</td>';
        html += '</tr>';
    }

    html += '</table>';
    html += '</div>';

    html += '<div class="queue-active-list">';
    html += '<h2>Active Queue</h2>';
    html += '<table><thead><tr><th>CLIENT</th><th>KEY</th><th>TIMESTAMP</th><th>BODY</th></tr></thead><tbody>';
    for(var i = 0, ii = self.queueActiveList.length; i < ii; i++){
        html += '<tr>';
        html += '<td>' + self.queueActiveList[i].client + '</td>';
        html += '<td>' + self.queueActiveList[i].key + '</td>';
        html += '<td>' + self.queueActiveList[i].timestamp + '</td>';
        try {
            html += '<td>' + JSON.stringify(self.queueList[i].data).substring(0, 100) + '</td>';
        }
        catch(err) {
            html += '<td>NO DATA</td>';
        }
        html += '</tr>';
    }

    html += '</table>';
    html += '</div>';

    html += '<div class="queue-list">';
    html += '<h2>Queue</h2>';
    html += '<table><thead><tr><th>KEY</th><th>TIMESTAMP</th><th>BODY</th></tr></thead><tbody>';
    for(var i = 0, ii = self.queueList.length; i < ii; i++){
        html += '<tr>';
        html += '<td>' + self.queueList[i].key + '</td>';
        html += '<td>' + self.queueList[i].timestamp + '</td>';
        try {
            html += '<td>' + JSON.stringify(self.queueList[i].data).substring(0, 100) + '</td>';
        }
        catch(err) {
            html += '<td>NO DATA</td>';
        }
        html += '</tr>';
    }

    html += '</table>';
    html += '</div>';


    html += '</tbody></table>';
    html += '</body></html>';

    res.send(html);
    return next();

};

QueueServer.prototype.serveNextQueueItem = function() {

    var self = this;

    var newActiveList = [];
    for(var i = 0, ii = this.queueActiveList.length; i < ii; i++){
        var item = this.queueActiveList[i];
        var acceptedTime = (new Date()).getTime() - self.options.timeout;
        if (item.timestamp <= acceptedTime) {
            //console.log("RE ADD TO QUEUE", item.key);
            item.timestamp = (new Date()).getTime();
            delete item.client;
            this.queueList.unshift(item);
        }
        else {
            newActiveList.push(item);
        }
    }
    this.queueActiveList = newActiveList;


    if (this.queueList.length > 0) {

        //console.log("LENGTH OF LIST:", this.queueList.length);
        //console.log("ACTIVE LIST", this.queueList);
        // find next free client
        var clients = self.io.sockets.clients('workers');
        for(var i = 0, ii = clients.length; i < ii; i++){
            var client = clients[i];
            if (client._free === true) {

                var item = this.queueList.shift();

                if (item) {
                    this.queueActiveList.push(item);

                    item.client = client.id;

                    item.timestamp = (new Date()).getTime();
                    //console.log("Give item " + item.key + " to " + client.id);
                    client.emit("give-queue-item", {
                        key: item.key,
                        data: item.data
                    });
                    client._free = false;
                    //break;
                }

            }
        };
        //console.log("LENGTH OF LIST AFTER SENDING:", this.queueList.length);
    }

};

QueueServer.prototype.getItemFromQueue = function(req, res, next) {

    var self = this;

    var newActiveList = [];
    for(var i = 0, ii = this.queueActiveList.length; i < ii; i++){
        var item = this.queueActiveList[i];
        var acceptedTime = (new Date()).getTime() - self.options.timeout;
        if (item.timestamp <= acceptedTime) {
            item.timestamp = (new Date()).getTime();
            this.queueList.unshift(item);
        }
        else {
            newActiveList.push(item);
        }
    }
    this.queueActiveList = newActiveList;


    var itemToServe = this.queueList.shift();

    if (itemToServe) {
        this.queueActiveList.push(itemToServe);
        res.send(itemToServe);
    }
    else {
        res.send({empty: true});
    }

    return next();

};

QueueServer.prototype.addItemToQueueRequestHandler = function(req, res, next) {
    var self = this;
    if (typeof self.options.add == 'function') {
        try {
            self.options.add(req.params, function(err, key, data) {
                if (!err && key != null && data != null) {
                    var item = self.addItemToQueue(key, data);
                    res.send(200, item);
                }
                if (err) {
                    res.send(500, err);
                }
                return next();
            });
        }
        catch(err) {
            res.send(500, err);
            return next();
        }
    }
    else {
        res.send({ok: true});
        return next();
    }
};

QueueServer.prototype.addItemToQueue = function(key, data) {

    var item = null;

    if (this.queueMap[key]) {
        item = this.queueMap[key];
        // dont do anything if its already in the queue
    }
    else {

        var queueItem = {
            key: key,
            data: data,
            timestamp: (new Date()).getTime()
        };

        this.queueMap[key] = queueItem;
        this.queueList.push(queueItem);

        item = queueItem;

        //console.log("add item", item, " now the queue has " + this.queueList.length + " item");

        this.serveNextQueueItem();

    }
    return item;

};

QueueServer.prototype.setAddCallback = function(callback) {
    this.options.add = callback;
};

QueueServer.prototype.setProcessCallback = function(callback) {
    this.options.process = callback;
};

QueueServer.prototype.serverFile = function(file) {

    if (file.indexOf('.css') > -1) {
        file = file.replace('.css', '.styl');
    }

    return function(req, res, next) {

        fs.readFile(__dirname + '/..' + file, 'utf-8', function(err, content) {

            if (file.indexOf('.html') > -1) {
                res.setHeader('Content-Type', 'text/html');
                res.send(content);
                return next();
            }
            else if (file.indexOf('.js') > -1) {
                res.setHeader('Content-Type', 'text/javascript');
                res.send(content);
                return next();
            }
            else if (file.indexOf('.styl') > -1) {
                res.setHeader('Content-Type', 'text/css');

                stylus.render(content, function(err, css){
                    if (err) {
                        res.send(500, err);
                    }
                    else {
                        res.send(css);
                    }
                    return next();
                });
            }
            else {
                res.send(content);
                return next();
            }

        });

    };

};


QueueServer.prototype.close = function(callback) {

    var self = this;

    if (this.serverOpen) {

        // in case we have errors, lets check them here
        this.server.on('error', function(err) {
            console.log(err);
        });

        // super compliated close structure

        var disconnectedCounter = this.clientList.length;

        if (disconnectedCounter == 0) {

            var timeoutRef = setTimeout(function() {
                self.serverOpen = false;
                if (callback) {
                    callback();
                }
            }, 500);

            self.server.close(function() {
                clearTimeout(timeoutRef);
                self.serverOpen = false;
                if (callback) {
                    callback();
                }
            });

        }
        else {

            // disconnect all clients, otherwise a new batch of client wont work
            this.clientList.forEach(function(client) {

                client.on('disconnect', function() {

                    disconnectedCounter--;

                    if (disconnectedCounter == 0) {

                        self.io.removeAllListeners();

                        //var timeoutRef = setTimeout(function() {
                        //console.log("timeout");
                        //self.serverOpen = false;
                        //if (callback) {
                        //callback();
                        //}
                        //}, 500);
                        //

                        self.server.close(function() {
                            self.serverOpen = false;
                            if (callback) {
                                callback();
                            }

                        });

                    }
                });
                client.disconnect();
            });

        }

    }
    else {
        if (callback) {
            callback();
        }
    } 
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

