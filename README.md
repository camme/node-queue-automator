Node Queue Automator
====================
This is a server/client based queue system to distribute work to clients easly.

### Install
Just install as a npm module
  npm install queue-automator

### Usage

The following code is the basic structure for creating all components. You need to write your processing code to make it useful, but all communications is done automaticcaly. The only thing you need to do is write 3 functions:

 - A callback for whenever data is to be added to the queue. This is done on the server with server.setAddCallback(function(data, next) {});
 - A callback for when queue item is done. This is done on the server with server.setProcessCallback(function(key, data, next) {});
 - A callback for when a queue item is recieved by the client to be proccessed. Add it on the client with client.setProcessCallback(function(key, data, next) {});

#### Server

Your server should initiate a server like this:

  var QA = require('queue-automator');

  var server = QA.server({ port: 20301 }, function() {
      console.log('Server is running');
  });

  // Add a callback for each time a queue item is supposed to be added
  server.setAddCallback(function(data, next) {
  
    console.log("Adding queue item with data ", data);

    // ... 
    // Process your data when you get an incoming item to add to the queue.
    // ...
    // Call the next function with a key and your custom data
    // The key is used to identify this queue item
    next(null, data.key, {text1: data.text1, text2: data.text2});
  
  });

  // Add a callback whenever an item has been processed by a client
  server.setProcessCallback(function(key, data, next) {

    console.log("Queue item with key " + key + " is done. The result was " + data.newText);

    // ...
    // Do whatever you need to do with the proccessed data. 
    // ...
    // Call next without anything to mark it as resolved. Send an argument if an error occured.
    next();
    
  });

#### Client
And this is the client

  var QA = require('queue-automator');

  // add an url property for a custom url if needed, otherwise it will point to localhost
  var client = QA.client( { port: 20301 }, function() {
    console.log('client setup');
  });

  client.setProcessCallback(function(key, data, next) {

    console.log("Proccessing queue item with key " + key + " on a client");

    // ...
    // Do whatever you need to do when a queue item needs to be processed
    // ...
    // And send whatever data the proccess got you back to the server by calling next with the custom data
    next({ newText: data.text1 + data.text2 });

  });

#### Adding queue items. With the code above, you could call the following url to add an item to the queue and watch how it is proccessed:

  curl http://localhost:10001/add?key=1&text1=hello&text2=world

#### Info screen
You can whats all proccessed and clients by browsing to http://localhost:20301/info. It will display the queue, the current connected clients and who is proccessing what.

### License
(The MIT License)

Copyright (c) 2011 Camilo Tapia <camilo.tapia@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
