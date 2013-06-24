var util = require('util')
  , net = require('net')
  , helper = require('./helper')
  , log = helper.log
  , operators;

operators = {
  '$all': function (o1, o2) {
    var i;
    if (typeof o1.indexOf === 'undefined') {
      return false;
    }
    for (i = 0; i < o2.length; i++) {
      if (o1.indexOf(o2[i]) === -1) {
        return false;
      }
    }
    return true;
  },
  '$gt': function (o1, o2) {
    return o1 > o2;
  },
  '$gte': function (o1, o2) {
    return o1 >= o2;
  },
  '$in': function (o1, o2) {
    var i;
    for (i = 0; i < o2.length; i++) {
      if (o1 === o2[i]) {
        return true;
      }
    }
    return false;
  },
  '$lt': function (o1, o2) {
    return o1 < o2;
  },
  '$lte': function (o1, o2) {
    return o1 <= o2;
  },
  '$ne': function (o1, o2) {
    return o1 != o2;
  },
  '$nin': function (o1, o2) {
    var i;
    for (i = 0; i < o2.length; i++) {
      if (o1 == o2[i]) {
        return false;
      }
    }
    return true;
  }
};

function buildFilterExps(selector, item) {
  var filterExps, propKey, itemPropValue, propValue, propValueType, operator, opKey, opValue;
  filterExps = [];
  for (propKey in selector) {
    itemPropValue = eval('item.' + propKey);
    propValue = selector[propKey];
    propValueType = typeof propValue;
    if (propValueType === typeof 1
      || propValueType === typeof true
      || propValueType === typeof '') {
      filterExps.push(itemPropValue == propValue);
      continue;
    }
    if (propValue['_bsontype'] === 'ObjectID') {
      filterExps.push(itemPropValue == propValue.toString());
      continue;
    }
    for (opKey in propValue) {
      opValue = propValue[opKey];
      operator = operators[opKey];
      if (!operator) {
        throw new Error("operator '" + opKey + "' not supported");
      }
      filterExps.push(operator(itemPropValue, opValue));
    }
  }
  return filterExps;
}

function filterItems(items, selector) {
  var result, key;
  log('trace', 'filterItems');
  result = [];
  for (key in selector) {
    items.forEach(function (item) {
      var filterExps, filterExp, filterMatch;
      filterExps = buildFilterExps(selector, item);
      filterExp = filterExps.join(' && ');
      filterMatch = eval(filterExp);
      if (filterMatch) {
        result.push(item);
      }
    });
  }
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
    log('debug', 'clientReqMsg :', clientReqMsg);
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
    collection = getCollection(clientReqMsg);
    if (clientReqMsg.selector && !helper.isEmpty(clientReqMsg.selector)) {
      docs = filterItems(collection, clientReqMsg.selector);
    } else {
      docs = collection;
    }
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
  }
};

module.exports = that;