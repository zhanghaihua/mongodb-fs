var util = require('util')
  , nodeunit = require('nodeunit')
  , helper = require('../lib/helper')
  , log = helper.log
  , filter = require('../lib/filter')
  , mocks = require('./mocks');

exports.setUp = function (callback) {
  helper.init({
    logLevel: 'debug',
    verbose: true,
    colors: true
  });
  callback();
};

function test1(test) {
  var items;
  items = filter.filterItems(mocks.fakedb.items, {
    field1: 'value1',
    'field2.field3': 31
  });
  log('debug', 'items :', items);
  test.ok(items);
  test.equal(items.length, 1);
  test.done();
}

function test2(test) {
  var items;
  items = filter.filterItems(mocks.fakedb.items, {
    $or: [
      {field1: 'value1'},
      {'field2.field3': 32}
    ]
  });
  log('debug', 'items :', items);
  test.ok(items);
  test.equal(items.length, 2);
  test.done();
}

function test3(test) {
  var items;
  items = filter.filterItems(mocks.fakedb.items, {
    field1: { '$in': ['value1', 'value21'] },
    'field2.field3': { $ne: 32 }
  });
  log('debug', 'items :', items);
  test.ok(items);
  test.equal(items.length, 2);
  test.done();
}

function test4(test) {
  var items;
  items = filter.filterItems(mocks.fakedb.items, {
    field5: { '$all': ['a', 'b'] },
    'field2.field3': { '$gt': 31 }
  });
  log('debug', 'items :', items);
  test.ok(items);
  test.equal(items.length, 1);
  test.done();
}

function test5(test) {
  var items;
  items = filter.filterItems(mocks.fakedb.items, {
    'field2.field3': { $not: { $gt: 32 } }
  });
  log('debug', 'items :', items);
  test.ok(items);
  test.equal(items.length, 2);
  test.done();
}

exports.tests = {
  test1: test1,
  test2: test2,
  test3: test3,
  test4: test4,
  test5: test5
};

module.exports = exports;