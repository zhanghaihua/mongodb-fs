var config = require('../config')
  , log4js = require('log4js')
  , that;

that = {
  category: null,
  level: 'INFO',
  init: function (config) {
    config = config || {};
    log4js.configure(config.log4js);
    that.category = config.logger && config.logger.category || that.category;
    that.level = config.logger && config.logger.level || that.level;
  },
  getLogger: function (category) {
    var logger;
    logger = log4js.getLogger(category || that.category);
    logger.setLevel(that.level);
    return logger;
  }
};

module.exports = that;