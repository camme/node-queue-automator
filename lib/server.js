

var QueueServer = function(options) {

    options = options || {};
    this.options = {};
    this.options.security = options.security || 'none';
    this.options.key = options.key || 'this is the default key';
    this.options.secret = options.secret || 'this is not so secret';
    this.options.url = options.url || 'localhost';
    this.options.port = options.port || 8080;
    this.options.timeout = options.timeout || 10000;

}

QueueServer.prototype.onAdd = function(callback) {
    this.add = callback;
}

module.exports = function(options) {
    return new QueueServer(options);
}
