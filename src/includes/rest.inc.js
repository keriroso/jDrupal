(function(send) {
  /**
   * Adds a pre process hook to all xhr request, and then continues with the call as usual.
   * @param {*} data
   */
  XMLHttpRequest.prototype.send = function(data) {
    var self = this;
    var alters = jDrupal.moduleInvokeAll('rest_pre_process', this, data);
    if (!alters) { send.call(this, data); }
    else { alters.then(function() { send.call(self, data); }); }
  };
})(XMLHttpRequest.prototype.send);

/**
 * Gets the X-CSRF-Token from Drupal.
 * @returns {Promise}
 */
jDrupal.token = function() {
  return new Promise(function(resolve, reject) {
    var req = new XMLHttpRequest();
    req.dg = {
      service: 'system',
      resource: 'token'
    };
    req.open('GET', jDrupal.restPath() + 'rest/session/token');
    req.onload = function() {
      if (req.status == 200) {
        var invoke = jDrupal.moduleInvokeAll('rest_post_process', req);
        if (!invoke) { resolve(req.response); }
        else { invoke.then(resolve(req.response));}
      }
      else { reject(Error(req.statusText)); }
    };
    req.onerror = function() { reject(Error("Network Error")); };
    req.send();
  });
};

/**
 * Connects to Drupal and sets the currentUser object.
 * @returns {Promise}
 */
jDrupal.connect = function() {
  return new Promise(function(resolve, reject) {
    var req = new XMLHttpRequest();
    req.dg = {
      service: 'system',
      resource: 'connect'
    };
    req.open('GET', jDrupal.restPath() + 'jdrupal/connect?_format=json');
    var connected = function() {
      jDrupal.connected = true;
      var result = JSON.parse(req.response);
      if (result.uid == 0) {
        jDrupal.setCurrentUser(jDrupal.userDefaults());
        resolve(result);
      }
      else {
        jDrupal.userLoad(result.uid).then(function(account) {
          jDrupal.setCurrentUser(account);
          resolve(result);
        });
      }
    };
    req.onload = function() {
      if (req.status != 200) { reject(Error(req.statusText)); return; }
      var invoke = jDrupal.moduleInvokeAll('rest_post_process', req);
      if (!invoke) { connected(); }
      else { invoke.then(connected); }
    };
    req.onerror = function() { reject(Error("Network Error")); };
    req.send();
  });
};

/**
 * Logs into Drupal, then makes a jDrupal.connect() call to properly set the currentUser object.
 * @param {String} name
 * @param {String} pass
 * @returns {Promise}
 */
jDrupal.userLogin = function(name, pass) {
  return new Promise(function(resolve, reject) {
    var req = new XMLHttpRequest();
    req.dg = {
      service: 'user',
      resource: 'login'
    };
    req.open('POST', jDrupal.restPath() + 'user/login');
    req.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    var connected = function() { jDrupal.connect().then(resolve); };
    req.onload = function() {
      if (req.status == 200 || req.status == 303) {
        var invoke = jDrupal.moduleInvokeAll('rest_post_process', req);
        if (!invoke) { connected(); }
        else { invoke.then(connected); }
      }
      else { reject(Error(req.statusText)); }
    };
    req.onerror = function() { reject(Error("Network Error")); };
    var data = 'name=' + encodeURIComponent(name) +
      '&pass=' + encodeURIComponent(pass) +
      '&form_id=user_login_form';
    req.send(data);
  });
};

/**
 * Logs out of Drupal, clears the currentUser object, then performs a jDrupal.connect() to properly set the currentUser
 * object.
 * @returns {Promise}
 */
jDrupal.userLogout = function() {
  return new Promise(function(resolve, reject) {
    var req = new XMLHttpRequest();
    req.dg = {
      service: 'user',
      resource: 'logout'
    };
    req.open('GET', jDrupal.restPath() + 'user/logout');
    req.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    var connected = function() {
      jDrupal.setCurrentUser(jDrupal.userDefaults());
      jDrupal.connect().then(resolve);
    };
    req.onload = function() {
      if (req.status == 200 || req.status == 303) {
        var invoke = jDrupal.moduleInvokeAll('rest_post_process', req);
        if (!invoke) { connected(); }
        else { invoke.then(connected); }
      }
      else { reject(Error(req.statusText)); }
    };
    req.onerror = function() { reject(Error("Network Error")); };
    req.send();
  });
};

/**
 * ENTITY PROXY FUNCTIONS
 */

/**
 * Given an entity type and id, this will attempt to load the entity.
 * @param {String} entityType
 * @param {Number} entityID
 * @returns {Promise}
 */
jDrupal.entityLoad = function(entityType, entityID) {
  var entity = new this[this.ucfirst(entityType)](entityID);
  return entity.load();
};

/**
 * Given a comment id, this will attempt to load the comment.
 * @param {Number} cid
 * @returns {Promise}
 */
jDrupal.commentLoad = function(cid) { return this.entityLoad('comment', cid); };

/**
 * Given a node id, this will attempt to load the node.
 * @param {Number} nid
 * @returns {Promise}
 */
jDrupal.nodeLoad = function(nid) { return this.entityLoad('node', nid); };

/**
 * Given a user id, this will attempt to load the account.
 * @param {Number} uid
 * @returns {Promise}
 */
jDrupal.userLoad = function(uid) { return this.entityLoad('user', uid); };
