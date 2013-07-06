var net = require('net')
  , childProcess = require('child_process')
  , helper = require('./helper')
  , log = require('../lib/log')
  , processor = require('./processor')
  , that, logger;

that = {
  server: null,
  config: {
    port: 27017,
    fork: false
  },
  running: false,
  child: null,
  init: function (config) {
    log.init(config.log);
    logger = log.getLogger();
    helper.copyProperties(config, that.config, false);
    processor.init(config.mocks);
  },
  start: function (callback) {
    callback = helper.safeCallback(callback);
    if (that.config.fork) {
      that.child = childProcess.fork(__filename);
      that.child.send({ action: 'start', config: that.config });
      that.child.on('message', function (data) {
        if (data.state === 'started') {
          callback(data.err);
        }
      });
      return;
    }
    logger.trace('starting server');
    that.server = net.createServer(processor.process);
    that.server.listen(that.config.port, function (err) {
      logger.trace('server ready, listening to port ', that.config.port);
      that.running = true;
      callback(err);
    });
  },
  stop: function (callback) {
    callback = helper.safeCallback(callback);
    logger.trace('closing server');
    if (that.child) {
      that.child.send({ action: 'stop' });
      that.child.on('message', function (data) {
        if (data.state === 'stopped') {
          callback(data.err);
        }
        that.child = null;
      });
      return;
    }
    that.server.close(function () {
      logger.trace('server closed');
      that.running = false;
      callback();
    });
  },
  isRunning: function () {
    return that.running || that.child;
  }
};

if (module.parent) {
  module.exports = that;
} else {
  process.on('message', function (data) {
    if (data.action === 'start') {
      data.config.fork = false;
      that.init(data.config);
      that.start(function (err) {
        process.send({ state: 'started', err: err });
      });
    } else if (data.action === 'stop') {
      that.stop(function (err) {
        process.send({ state: 'stopped', err: err });
        process.exit(0);
      });
    }
  });
}