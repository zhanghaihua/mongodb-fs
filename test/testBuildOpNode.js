var util = require('util')
  , nodeunit = require('nodeunit')
  , helper = require('../lib/helper')
  , log = helper.log
  , filter = require('../lib/filter');

exports.setUp = function (callback) {
  helper.init({
    logLevel: 'debug',
    verbose: true,
    colors: true
  });
  callback();
};
function testSelector(test, selector, expectedResult) {
  var rootNode;
  rootNode = filter.buildOpNode(selector);
  log('debug', 'rootNode :', util.inspect(rootNode, {depth: null}));
  test.ok(rootNode);
  test.equal(JSON.stringify(rootNode), JSON.stringify(expectedResult));
  test.done();
}

function test1(test) {
  testSelector(test, {
    a: 'avalue',
    'b': 3
  }, {
    op: '$and',
    field: null,
    args: [
      { op: '$eq', field: 'a', args: [ '"avalue"' ] },
      { op: '$eq', field: 'b', args: [ '3' ] }
    ]
  });
}

function test2(test) {
  testSelector(test, {
    $or: [
      {a: 'avalue'},
      {'b': 3}
    ]
  }, {
    op: '$or',
    field: null,
    args: [
      { op: '$eq', field: 'a', args: [ '"avalue"' ] },
      { op: '$eq', field: 'b', args: [ '3' ] }
    ]
  });
}

function test3(test) {
  testSelector(test, {
    field1: { '$in': ['value1', 'value21'] },
    'field2.field3': { $ne: 32 }
  }, {
    op: '$and',
    field: null,
    args: [
      { op: '$in', field: 'field1', args: [ '"value1"', '"value21"' ] },
      { op: '$ne', field: 'field2.field3', args: [ '32' ] }
    ]
  });
}

function test4(test) {
  testSelector(test, {
    field5: { '$all': ['a', 'b'] },
    'field2.field3': { '$gt': 31 }
  }, {
    op: '$and',
    field: null,
    args: [
      { op: '$all', field: 'field5', args: [ '"a"', '"b"' ] },
      { op: '$gt', field: 'field2.field3', args: [ '31' ] }
    ]
  });
}

function test5(test) {
  testSelector(test, {
    'field2.field3': { $not: { $gt: 32 } }
  }, {
    op: '$not',
    field: 'field2.field3',
    args: [
      { op: '$gt', field: 'field2.field3', args: [ '32' ] }
    ]
  });
}

exports.tests = {
  test1: test1,
  test2: test2,
  test3: test3,
  test4: test4,
  test5: test5
};

module.exports = exports;