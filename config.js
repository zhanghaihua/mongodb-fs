var pkg = require('./package')
  , that;

that = {
  log: {
    log4js: {
      appenders: [
        {
          type: 'console',
          category: pkg.name
        }
      ]
    },
    category: pkg.name,
    level: 'INFO'
  }
};

module.exports = that;