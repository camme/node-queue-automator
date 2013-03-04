// need to include should directly here to be able to use not
var should = require('should');
var QP = require('../index');
var restify = require('restify');
var OAuth = require('oauth').OAuth;

describe("The socket server", function() {

    var port = 8020;

    beforeEach(function(done) {

        var self = this;
        setTimeout(function() {
        self.server = QP.server({
            port: ++port,
        },
            function() {
            done();
        });
        }, 500);
    });

    afterEach(function(done) {
        this.server.close(function() {
            done();
        });
    });

    it("will add a client to the client list when a client is connected", function(done) {

        var server = this.server;

        var client = QP.client({port: port}, function() {
            server.clientList.should.have.lengthOf(1);
            done();
        });

    });

/*
    it("will add an item when an add event is trigger", function(done) {

        var server = this.server;

        var client = QP.client({port: port}, function() {

            client.set

            client.add('111', {foo: 'bar'});

            server.queueList.should.have.lengthOf(1);
            done();

        });

    });
    */

    it("will send a queue item to the next client that isnt busy", function(done) {

        var server = this.server;
        var client1 = QP.client({port: port}, function() {

            client1.setProcessCallback(function(key, data, next) {
                key.should.equal('1'); 
                data.should.have.property('foo', 'bar');
                next({datamaskin: 'data'});
                done();
            });

            setTimeout(function() {
                server.addItemToQueue('1', {foo: 'bar'});
            }, 500);

        });

    });


});

