var util = require('util')
  , net = require('net')
  , helper = require('./helper')
  , log = helper.log;

function filterItems(items, selector) {
  var result, key;
  log('trace', 'filterItems');
  result = [];
  log('debug', 'filtering items :', items);
  log('debug', 'selector :', selector);
  for (key in selector) {
    log('debug', 'key :', key);
    items.forEach(function (item) {
      var propValue;
      propValue = eval('item.' + key);
      log('debug', 'propValue :', propValue);
      if (selector[key]['$gt']) {
        if (propValue > selector[key]['$gt']) {
          result.push(item);
        }
      } else if (selector[key]['$gte']) {
        if (propValue >= selector[key]['$gt']) {
          result.push(item);
        }
      } else if (selector[key]['$lt']) {
        if (propValue < selector[key]['$lt']) {
          result.push(item);
        }
      } else if (selector[key]['$lte']) {
        if (propValue <= selector[key]['$lt']) {
          result.push(item);
        }
      } else if (selector[key]['$ne']) {
        if (propValue != selector[key]['$lt']) {
          result.push(item);
        }
      } else if (selector[key]['$all']) {
        throw new Error('operator $all not supported');
      } else if (selector[key]['$in']) {
        throw new Error('operator $in not supported');
      } else if (selector[key]['$nin']) {
        throw new Error('operator $nin not supported');
      } else if (selector[key]['$or']) {
        throw new Error('operator $or not supported');
      } else if (selector[key]['$and']) {
        throw new Error('operator $and not supported');
      } else if (selector[key]['$not']) {
        throw new Error('operator $not not supported');
      } else if (selector[key]['$nor']) {
        throw new Error('operator $nor not supported');
      } else {
        if ((propValue && propValue.toString() === selector[key].toString())
          || (propValue == selector[key])) {
          result.push(item);
        }
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