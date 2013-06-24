var util = require('util')
  , net = require('net')
  , helper = require('./helper')
  , log = helper.log
  , operators;

operators = {
  '$gt': function (o1, o2) {
    return o1 > o2;
  },
  '$gte': function (o1, o2) {
    return o1 >= o2;
  },
  '$lt': function (o1, o2) {
    return o1 < o2;
  },
  '$lte': function (o1, o2) {
    return o1 <= o2;
  },
  '$ne': function (o1, o2) {
    return o1 != o2;
  }
};

function buildFilterExp(selector) {
  var filterExp, propKey, propValue, propValueType, operator, opKey, opValue;
  log('debug', 'selector :', selector);
  filterExp = '';
  for (propKey in selector) {
    log('debug', 'propKey :', propKey);
    propValue = selector[propKey];
    propValueType = typeof propValue;
    log('debug', 'propValueType :', propValueType);
    if (propValueType === typeof 1
      || propValueType === typeof true) {
      filterExp += util.format(" (item.%s == %s)", propKey, propValue);
      continue;
    }
    if (propValueType === typeof ''
      || propValue['_bsontype'] === 'ObjectID') {
      filterExp += util.format(" (item.%s == '%s')", propKey, propValue);
      continue;
    }
    for (opKey in propValue) {
      opValue = propValue[opKey];
      log('debug', 'opKey :', opKey);
      log('debug', 'opValue :', opValue);
      operator = operators[opKey];
      if (!operator) {
        throw new Error("operator '" + opKey + "' not supported");
      }
      filterExp += util.format(" operators['%s'](item.%s, '%s')", opKey, propKey, opValue);
    }
  }
  log('debug', 'filterExp :', filterExp);
  return filterExp;
}

function filterItems(items, selector) {
  var filterExp, result, key;
  log('trace', 'filterItems');
  filterExp = buildFilterExp(selector);
  result = [];
  log('debug', 'filtering items :', items);
  log('debug', 'selector :', selector);
  for (key in selector) {
    log('debug', 'key :', key);
    items.forEach(function (item) {
      var filterMatch = eval(filterExp);
      log('debug', 'filterMatch :', filterMatch);
      if (filterMatch) {
        result.push(item);
      }
    });
  }
  log('debug', 'filter result :', result);
  return result;
}

function getCollection(clientReqMsg) {
  return eval('that.mocks.' + clientReqMsg.fullCollectionName);
}

that = {
  mocks: null,
  init: function (mocks) {
    that.mocks = mocks;
  },
  process: function (socket) {
    log('trace', 'new socket');
    socket.on('data', function (buf) {
      var header, clientReqMsg;
      header = helper.fromMsgHeaderBuf(buf);
      log('debug', 'header :', header);
      switch (header.opCode) {
        case helper.OP_QUERY:
          clientReqMsg = helper.fromOpQueryBuf(header, buf);
          if (clientReqMsg.fullCollectionName.match(/\.\$cmd$/)) {
            that.doCmdQuery(socket, clientReqMsg);
          } else {
            that.doQuery(socket, clientReqMsg);
          }
          break;
        case helper.OP_INSERT:
          clientReqMsg = helper.fromOpInsertBuf(header, buf);
          that.doInsert(socket, clientReqMsg);
          break;
        case helper.OP_DELETE:
          clientReqMsg = helper.fromOpDeleteBuf(header, buf);
          that.doDelete(socket, clientReqMsg);
          break;
        case helper.OP_UPDATE:
          clientReqMsg = helper.fromOpUpdateBuf(header, buf);
          that.doUpdate(socket, clientReqMsg);
          break;
        default:
          throw new Error('not supported');
      }
    });
    socket.on('end', function () {
      log('trace', 'socket disconnect');
    });
  },
  doCmdQuery: function (socket, clientReqMsg) {
    var reply, replyBuf;
    log('trace', 'doCmdQuery');
    if (clientReqMsg.query['ismaster']) {
      reply = {
        documents: { 'ismaster': true, 'ok': true }
      };
      replyBuf = helper.toOpReplyBuf(clientReqMsg, reply);
      socket.write(replyBuf);
    } else if (clientReqMsg.query['getlasterror']) {
      reply = {
        documents: { 'ok': true }
      };
      replyBuf = helper.toOpReplyBuf(clientReqMsg, reply);
      socket.write(replyBuf);
    } else {
      log('error', 'clientReqMsg :', clientReqMsg);
      throw new Error('not supported');
    }
  },
  doQuery: function (socket, clientReqMsg) {
    var collection, docs, replyBuf;
    log('trace', 'doQuery');
    log('trace', 'clientReqMsg :', clientReqMsg);
    collection = getCollection(clientReqMsg);
    if (clientReqMsg.query && !helper.isEmpty(clientReqMsg.query)) {
      docs = filterItems(collection, clientReqMsg.query);
    } else {
      docs = collection;
    }
    if (clientReqMsg.returnFieldSelector) {
      docs.forEach(function (document) {
        for (var key in document) {
          if (!clientReqMsg.returnFieldSelector[key]) {
            delete document[key];
          }
        }
      });
    }
    replyBuf = helper.toOpReplyBuf(clientReqMsg, { documents: docs });
    socket.write(replyBuf);
  },
  doInsert: function (socket, clientReqMsg) {
    var collection;
    log('trace', 'doInsert');
    collection = getCollection(clientReqMsg);
    clientReqMsg.documents.forEach(function (document) {
      collection.push(document);
    });
  },
  doDelete: function (socket, clientReqMsg) {
    var collection, i, item;
    log('trace', 'doDelete');
    collection = getCollection(clientReqMsg);
    i = 0;
    while (i < collection.length) {
      item = collection[i];
      if (item._id && (item._id.toString() === clientReqMsg.selector._id.toString())) {
        log('trace', 'removing id ', item._id);
        collection.splice(i, 1);
      } else {
        i++;
      }
    }
  },
  doUpdate: function (socket, clientReqMsg) {
    var collection, docs, updateKey, propKey;
    log('trace', 'doUpdate');
    log('debug', 'clientReqMsg :', clientReqMsg);
    collection = getCollection(clientReqMsg);
    if (clientReqMsg.selector && !helper.isEmpty(clientReqMsg.selector)) {
      docs = filterItems(collection, clientReqMsg.selector);
    } else {
      docs = collection;
    }
    log('debug', 'docs :', docs);
    docs.forEach(function (doc) {
      for (updateKey in clientReqMsg.update) {
        if (updateKey === '$set') {
          for (propKey in clientReqMsg.update[updateKey]) {
            eval('doc.' + propKey + '=' + clientReqMsg.update[updateKey][propKey]);
          }
        } else {
          throw new Error('update value "' + updateKey + '" not supported');
        }
      }
    });
    log('debug', 'collection :', util.inspect(collection, { depth: null }));
  }
};

module.exports = that;