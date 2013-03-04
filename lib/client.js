var socketioClient = require('socket.io-client');

var QueueClient = function(options, done) {

    var self = this;

    if (typeof options == 'function') {
        done = options;
        delete options;
    }

    this.options = {};

    options = options || {};

    this.options.method = options.method || 'socket';
    this.options.url = options.url || '127.0.0.1';
    this.options.port = options.port || 8080;

    if (this.options.method == 'socket') {

        this.client = socketioClient.connect(this.options.url + ":" + this.options.port);

        this.client.on('connected', function(e) {
            self.client.emit("tjena", {'data': 1});
            done();
        });

        this.client.on('error', function(e) {
            console.log("SOCKET ERROR:", e);
        });

        this.client.on('give-queue-item', function(e) {
            //console.log("GOT QUEUE ITEM " + e.key);
            self.gotQueueItem(e.key, e.data);
        });

        this.client.on('disconnect', function() {
            //self.client.removeAllListeners();    //console.log(self.client.socket.transport.websocket);
            self.client.disconnect();
        });

    }

    function bind(fn, scope) {
        return function () {
            return fn.apply(scope, arguments);
        }
    }

}

QueueClient.prototype.gotQueueItem = function(key, data) {
    var self = this;
    if (typeof this.options.process == 'function') {
        (function(key, data) {
            self.options.process(key, data, function(result) {
                self.client.emit('resolve-queue-item', {
                    key: key,
                    result: result,
                });
            });
        })(key, data);
    }
}

QueueClient.prototype.add = function(key, data) {
    this.client.emit('add', {key: key, data: data});
};

QueueClient.prototype.setProcessCallback = function(callback) {
    this.options.process = callback;
};

module.exports = function(options, done) {
    return new QueueClient(options, done);
}
