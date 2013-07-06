var pkg = require('./package')
  , that;

that = {
  log4js: {
    appenders: [
      {
        type: 'console',
        category: pkg.name
      }
    ]
  },
  logger: {
    category: pkg.name,
    level: 'INFO'
  }
};

module.exports = that;