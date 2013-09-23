var util = require('util');
var EventEmitter = require('events').EventEmitter;
var helpers = require('../helpers');
var logger = require('../logger');
var Connector = require('./connector');
var Future = require('fibers/future');

function ClientConnector(phantom, appUrl) {
  Connector.call(this)
  appUrl = appUrl || "http://localhost:3000";  
  var self = this;
  self.appUrl = appUrl;
  var errorFired = false;
  var pageOpenedCallbackFired = false;

  //load the phantom page
  var pageOpened = false;
  var page;
  phantom.createPage(function(err, p) {
    if(err) {
      throw err;
    } else {
      page = p;
      page.onConsoleMessage = onConsoleMessage;
      page.open(appUrl, afterOpened);
    }
  });

  function afterOpened(err, status) {
    if(!pageOpenedCallbackFired) {
      pageOpenedCallbackFired = true;
      if(err) {
        throw err;
      } else if(status != 'success') {
        // throw new Error('unsuccessful status: ' + status);
      } else {
        pageOpened = true;
        page.onCallback = onCallback;
        page.onError = onError;
        self.emit('pageOpened');
      }
    }
  }

  function onConsoleMessage(message, line, source) {
    logger.client(message);
  }

  function onCallback(payload) {
    var args = JSON.parse(payload);

    //need to close the clientConnector after we catch an error
    //possiblly an assertion error
    try{
      self.emit.apply(self, args);
    } catch(ex) {
      self.close();
      throw ex;
    }
  };

  function onError(message) {
    if(!errorFired && !message[0].match(/simulating the effect/)) {
      var errorMessage = ' [Error on Client] ' + message[0];
      var error =  new Error(errorMessage);
      error.stack = errorMessage;
      errorFired = true;
      self.emit('error', error);
    }
  }
	
  this.navigate = function navigate(uri, nextStep) {
    if(pageOpened) {
			var url = appUrl + '/' + (uri.indexOf('/') == 0 ? uri.substring(1) : uri);
			page.open.apply(self, [url, function(err, status) {
				nextStep.apply(self, [err, status]);
			}]);
    } else {
      self.on('pageOpened', function() {
        self.navigate.apply(self, [uri, nextStep]);
      });
    }
		
    return this;
  };
	
	this.eval = function eval(clientCode) {
    var parentArguments = arguments;
    var args = [];
    for(var key in arguments) {
      if(key != '0') {
        args.push(arguments[key]);
      }
    }

    if(pageOpened) {
			if(typeof(args[0]) == "function")
				args = [clientCode, args.shift().bind(self)].concat(args);
			else
				args.unshift(clientCode, function() {});
			
			page.evaluate.apply(page, args);
    } else {
      self.on('pageOpened', function() {
        self.eval.apply(self, parentArguments);
      });
    }
    return this;
  };
	
  this.close = function close() {
    this.removeAllListeners('pageOpened');
    if(page) {
      page.onCallback = null;
      page.onError = null;
      page.close();
    }
  };
}

util.inherits(ClientConnector, EventEmitter);

module.exports = ClientConnector;