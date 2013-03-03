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
        this.server.close(function() {
            done();
        });
    });

    it("will initiate with default options", function(done) {

        var server = this.server = QP.server(function() {

            server.options.should.have.property('port', 8080);
            server.options.should.have.property('url', '127.0.0.1');
            server.options.should.have.property('security', 'none');
            server.options.should.have.property('key', 'this is the default key');
            server.options.should.have.property('secret', 'this is not so secret');

            done();

        });

    });


    it("will initiate with the config options", function(done) {

        var server = this.server = QP.server({
            port: 9099,
            key: 'tjena',
            secret: 'datamaskin',
            timeout: 5000
        }, function() {

            server.options.should.have.property('key', 'tjena');
            server.options.should.have.property('secret', 'datamaskin');
            server.options.should.have.property('port', 9099);
            server.options.should.have.property('timeout', 5000);

            done();

        });

    });

    it("will trigger the add callback when an item is added to the queue", function(done) {

        var server = this.server = QP.server({security: 'oauth'}, function() {

            var callbackCalled = false;

            var callback = function(params, next) {
                params.should.have.property('id', 'foo');
                next(null, '1', {id: 1});
                callbackCalled = true;
            };

            server.setAddCallback(callback);

            var oa = new OAuth( "http://127.0.0.1:8088", "http://127.0.0.1:8088", server.options.key, server.options.secret, "1.0", null, "HMAC-SHA1");
            oa.post( 'http://127.0.0.1:8080/add', '', '', {id: 'foo'}, function (err, data, response) {
                response.statusCode.should.equal(200);
                callbackCalled.should.be.ok;
                done();
            });

        });

    });

    it("will return a queue item when a client asks for one", function(done) {

        var server = this.server = QP.server({security: 'oauth'}, function() {

            var callbackCalled = false;

            var callback = function(params, next) {
                params.should.have.property('id', 'foo');
                next(null, '1', {id: 'foo'});
                callbackCalled = true;
            };

            server.setAddCallback(callback);

            var oa = new OAuth( "http://127.0.0.1:8088", "http://127.0.0.1:8088", server.options.key, server.options.secret, "1.0", null, "HMAC-SHA1");
            oa.post( 'http://127.0.0.1:8080/add', '', '', {id: 'foo'}, function (err, data, response) {

                oa.get( 'http://127.0.0.1:8080/get', '', '', function (err, data, response) {
                    response.statusCode.should.equal(200);
                    var jsonData = JSON.parse(data);
                    jsonData.should.have.property('key', '1');
                    jsonData.should.have.property('data');
                    jsonData.data.should.have.property('id', 'foo');
                    callbackCalled.should.be.ok;
                    done();
                });


            });
        });

    });

    it("will responde with a 401 error if the security is set to oauth and the incorrect secret is used", function(done) {

        var server = this.server = QP.server({security: 'oauth'}, function() {

            var oa = new OAuth( "http://127.0.0.1:8088", '', server.options.key, 'wrong secret', "1.0", null, "HMAC-SHA1");
            oa.post( 'http://127.0.0.1:8080/add', '', '', {id: 'foo'}, function (err, data, response) {
                response.statusCode.should.equal(401);
                done();
            });

        });

    });


    it("will reset items after a timeout", function(done) {

        var server = this.server = QP.server({security: 'oauth', timeout: 500}, function() {

            var callbackCalled = false;

            var callback = function(params, next) {
                next(null, '1', {id: 'foo'});
            };

            server.setAddCallback(callback);

            var oa = new OAuth( "http://127.0.0.1:8088", "http://127.0.0.1:8088", server.options.key, server.options.secret, "1.0", null, "HMAC-SHA1");

            // first we add one
            oa.post( 'http://127.0.0.1:8080/add', '', '', {id: 'foo'}, function (err, data, response) {

                // then we get one frm the queue
                oa.get( 'http://127.0.0.1:8080/get', '', '', function (err, data, response) {
                    var jsonData = JSON.parse(data);
                    jsonData.should.have.property('key', '1');

                    // then we try to get it again, this time otu should be empty
                    oa.get( 'http://127.0.0.1:8080/get', '', '', function (err, data, response) {
                        var jsonData = JSON.parse(data);
                        jsonData.should.have.property('empty', true);

                        // then we wait and try again, and this time it should have the item again
                        setTimeout(function() {

                            oa.get( 'http://127.0.0.1:8080/get', '', '', function (err, data, response) {
                                var jsonData = JSON.parse(data);

                                jsonData.should.have.property('key', '1');
                                done();

                            });

                        }, 700);

                    });

                });
            });

        });

    });

    it("resolve item if it gets a request to the resovle endpoint", function(done) {

        var server = this.server = QP.server({security: 'oauth', timeout: 500}, function() {

            var callbackCalled = false;

            var callback = function(params, next) {
                next(null, '1', {id: 'foo'});
            };

            server.setAddCallback(callback);

            var oa = new OAuth( "http://127.0.0.1:8088", "http://127.0.0.1:8088", server.options.key, server.options.secret, "1.0", null, "HMAC-SHA1");

            // first we add one
            oa.post( 'http://127.0.0.1:8080/add', '', '', {id: 'foo'}, function (err, data, response) {

                // then we get one frm the queue
                oa.get( 'http://127.0.0.1:8080/get', '', '', function (err, data, response) {
                    var jsonData = JSON.parse(data);
                    jsonData.should.have.property('key', '1');

                    // then we try to get it again, this time otu should be empty
                    oa.get( 'http://127.0.0.1:8080/get', '', '', function (err, data, response) {
                        var jsonData = JSON.parse(data);
                        jsonData.should.have.property('empty', true);

                        // then we wait and try again, and this time it should have the item again
                        setTimeout(function() {

                            oa.get( 'http://127.0.0.1:8080/get', '', '', function (err, data, response) {
                                var jsonData = JSON.parse(data);

                                jsonData.should.have.property('key', '1');
                                done();

                            });

                        }, 700);

                    });

                });
            });

        });

    });

});

