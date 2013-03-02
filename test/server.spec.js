// need to include should directly here to be able to use not
var should = require('should');
var QP = require('../index');
var restify = require('restify');
var OAuth = require('oauth').OAuth;

describe("The server", function() {

    beforeEach(function(done) {
        done();
    });

    afterEach(function(done) {
        done();
    });

    it("will initiate with default options", function(done) {

        var server = QP.server();

        server.options.should.have.property('port', 8080);
        server.options.should.have.property('url', 'localhost');
        server.options.should.have.property('security', 'none');
        server.options.should.have.property('key', 'this is the default key');
        server.options.should.have.property('secret', 'this is not so secret');

        done();
    });


    it("will initiate with the config options", function(done) {

        var server = QP.server({
            port: 9099,
            key: 'tjena',
            secret: 'datamaskin',
            timeout: 5000
        });

        server.options.should.have.property('key', 'tjena');
        server.options.should.have.property('secret', 'datamaskin');
        server.options.should.have.property('port', 9099);
        server.options.should.have.property('timeout', 5000);

        done();
    });

    it("will trigger the add callback when an item is added to the queue", function(done) {

        var server = QP.server({security: 'oauth'});
        var client = QP.server();
        var callbackCalled = false;

        var callback = function(params, next) {
            params.should.have.property('querystring');
            params.querystring.shoud.have.property('id', 1);
            next(null, {id: 1});
            callbackCalled = true;
            done();
        };

        var oa = new OAuth( "http://localhost:8088", '', server.options.key, server.options.secret, "1.0", null, "HMAC-SHA1");
        oa.post( 'http://localhost:8080/add', '', '', {id: 1}, function (err, data, response) {

        });

        server.onAdd(callback);

    });


});

