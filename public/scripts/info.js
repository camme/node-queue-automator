(function() {

    ready(function() {

        var socket = io.connect('//');

        socket.on('connected', function(data) {
            socket.emit('i-am-a-web-browser');
        });

        socket.on('client-list', function (data) {
            var clients = data.clients;
            var container = document.querySelector('#clients tbody');
            container.innerHTML = '';
            for(var i = 0, ii = clients.length; i < ii; i++){
                var client = clients[i];
                var trDom = document.createElement('tr');
                trDom.innerHTML = '<td>' + client.ip.address + ":" + client.ip.port + '</td><td>' + client.id + '</td><td>' + client.free + '</td>';
                container.appendChild(trDom);
            }
        });

    });

    function ready(callback) {

        // Bind to the content load event
        document.addEventListener("DOMContentLoaded", function() {
            // ...and remove the listener when we are done
            document.removeEventListener("DOMContentLoaded", arguments.callee, false);
            callback();
        });

    };

})();
