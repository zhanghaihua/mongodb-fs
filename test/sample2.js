var mongoose = require('mongoose')
  , mongodbFs = require('../lib/mongodb-fs');

mongoose.model('MyModel', {
  a: String,
  b: String
});

mongodbFs.init({
  port: 27027,
  mocks: {
    fakedb: {
      mymodels: []
    }
  },
  verbose: true,
  logLevel: 'error',
  colors: true,
  fork: true
});

mongodbFs.start(function (err) {
  con = mongoose.createConnection('mongodb://localhost:27027/fakedb', { server: { poolSize: 1 } }, function (err) {
    var MyModel, myModel;
    MyModel = con.model('MyModel');
    myModel = new MyModel({
      a: 'avalue',
      b: 'bvalue'
    });
    myModel.save(function (err) {
      MyModel.find(function (err, myModels) {
        console.log('myModels :', myModels);
        mongoose.disconnect(function (err) { // clean death
          mongodbFs.stop(function (err) {
            console.log('bye!');
          });
        });
      });
    });
  });
});
