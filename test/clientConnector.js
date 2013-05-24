var assert = require('assert');
var path = require('path');
var fs = require('fs');
var http = require('http');
var Phantom = require('node-phantom');
var helpers = require('../lib/helpers');
var ClientConnector = require('../lib/connectors/client.js');

var CLIENT_TEMPLATE_LOCATION = path.resolve(__dirname, '../lib/injector/templates/client.js');
var clientCode = fs.readFileSync(CLIENT_TEMPLATE_LOCATION, 'utf8');
var phantom;

suite('ClientConnector', function() {
  test('run in client and get result', function(done) {
    var port = helpers.getRandomPort();
    var server = createHttpServer(port);
    var cc;
    getPhantom(function(phantom) {
      cc = new ClientConnector(phantom, 'http://localhost:' + port);
      cc.run(function() {
        emit('result', 10);
      });

      cc.on('result', function(val) {
        assert.equal(val, 10);
        server.close();
        cc.close();
        done();
      })
    })
  });

  test('run in client and get result in async fashion', function(done) {
    var port = helpers.getRandomPort();
    var server = createHttpServer(port);
    var cc;
    getPhantom(function(phantom) {
      cc = new ClientConnector(phantom, 'http://localhost:' + port);
      cc.run(function() {
        setTimeout(function() {
          emit('result', 120);
        })
      });

      cc.on('result', function(val) {
        assert.equal(val, 120);
        server.close();
        cc.close();
        done();
      })
    })
  });

  test('send args to the client and get result', function(done) {
    var port = helpers.getRandomPort();
    var server = createHttpServer(port);
    var cc;
    getPhantom(function(phantom) {
      cc = new ClientConnector(phantom, 'http://localhost:' + port);
      cc.run(function(a, b) {
        emit('result', a + b);
      }, 100, 200);

      cc.on('result', function(val) {
        assert.equal(val, 300);
        server.close();
        cc.close();
        done();
      })
    })
  });
})

function getPhantom(callback) {
  if(phantom) {
    callback(phantom);
  } else {
    Phantom.create(afterCreated);
  }

  function afterCreated(err, ph) {
    phantom = ph;
    if(err) {
      throw err;
    } else {
      callback(phantom);
    }
  }
}

function createHttpServer(port) {
  var server = http.createServer(function(req, res) {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end("<html><head><script type='text/javascript'>" + clientCode + "</script></head></html>");
  });

  server.listen(port);
  return server;
}
