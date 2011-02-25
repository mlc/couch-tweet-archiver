/*
 * couch-tweet-archiver
 * Copyright © 2011 Michael Castleman
 * 
 * This is a node.js script to fetch your tweets and put them in
 * CouchDB for archival and analysis.
 * 
 * It's JAVASCRIPT ALL THE WAY DOWN.
 * 
 * This program is free software. It comes without any warranty, to
 * the extent permitted by applicable law. You can redistribute it
 * and/or modify it under the terms of the Do What The Fuck You Want
 * To Public License, Version 2, as published by Sam Hocevar. See
 * http://sam.zoy.org/wtfpl/COPYING for more details.
 */

var _ = require('underscore')._,
    OAuth = require('oauth').OAuth,
    util = require('util'),
    http = require('http'),
    fs = require('fs');

var user_agent = "couch-tweet-archiver/0.01 node.js/" + process.version + " (http://vermicel.li/)",

    config = JSON.parse(fs.readFileSync("config.json")),

    oa = new OAuth(
      'http://twitter.com/oauth/request_token',
      'http://twitter.com/oauth/access_token',
      config.oauth.consumer_key,
      config.oauth.consumer_secret,
      '1.0',
      undefined,
      'HMAC-SHA1',
      undefined,
      {
        "Accept": "application/json",
        "User-Agent": user_agent
      }
    );

/**
 * Fetch a page of tweets.
 */
function fetch(user, max_id, page, since_id) {
  var url = ['http://api.twitter.com/1/statuses/user_timeline.json'];
  url.push('?user_id=');
  url.push(user);
  url.push('&max_id=');
  url.push(max_id);
  if (page) {
    url.push('&page=');
    url.push(page);
  }
  if (since_id) {
    url.push('&since_id=');
    url.push(since_id);
  }
  url.push('&count=200&trim_user=1&include_rts=1&include_entities=1');
  url = url.join('');
  oa.get(url, config.oauth.token, config.oauth.token_secret, function(error, data, response) {
    if (error) {
      util.error(url);
      util.error(util.inspect(error));
      if ([400, 500, 502, 503].indexOf(error.statusCode) > -1) {
        util.error("waiting 10 seconds, then trying again");
        setTimeout(fetch, 10000, user, max_id, page, since_id);
      }
    } else {
      var statuses = JSON.parse(data);
      dump_ratelimit(response);
      util.debug(statuses.length + " statuses received");
      // we could probably replace this with CouchDB's bulk documents API.
      // if you care that much, do it yourself and send me a patch.
      for (var i = 0, len = statuses.length; i < len; ++i) {
        store_status(statuses[i]);
      }
      if (statuses.length > 0)
        fetch(user, max_id, page + 1, since_id);
    }
  });
};

function store_status(status) {
  return couchdb_put(status.id_str, status);
}

/**
 * Store a document in CouchDB.
 */
function couchdb_put(doc_id, doc, success_callback, error_callback) {
  var options = {
    host: config.couch.host,
    port: config.couch.port,
    path: '/' + config.couch.db + '/' + doc_id,
    method: 'PUT',
    headers: {
      "Content-Type": "application/json",
      "User-Agent": user_agent,
      "Accept": "application/json"
    }
  };

  var request = http.request(options, function(response) {
    response.setEncoding('utf8');
    if (response.statusCode == 201) {
      util.debug(doc_id + " stored in CouchDB");
      if (success_callback)
        response.on('end', success_callback);
    } else {
      if (error_callback) {
        error_callback(response);
      } else {
        util.error("ick, storing status " + status.id_str + " failed, HTTP response " + response.statusCode);
        response.on('data', function(chunk) {
          util.error(chunk);
        });
      }
    }
  });

  request.write(JSON.stringify(doc, function(key, val) {
    if (typeof val === 'function') {
      return val.toString();
    } else {
      return val;
    }
  }));
  request.end();
}

/**
 * If the util view (used to determine the newest tweet in the DB)
 * does not exist, this function will create it.
 */
function create_util_view(callback) {
  var util_view = {
    language: "javascript",
    views: {
      max_id: {
        map: function(doc) {
          if (doc && doc.id_str)
            emit(true, doc.id_str);
        },
        reduce: function(keys, values) {
          var max = values[0], maxlen = max.length;
          for(var i = 1, len = values.length; i < len; ++i) {
            var val = values[i], vallen = val.length;
            /* Javascript can't deal with Twitter's 64-bit ids, so use strings & compare by length then value. */
            if (vallen > maxlen || (vallen === maxlen && val > max)) {
              max = val;
              maxlen = vallen;
            }
          }
          return max;
        }
      }
    }
  };
  couchdb_put('_design/util', util_view, callback);
}

/**
 * Fetch the maximum ID currently stored in the database, posting the needed
 * view if, um, needed.
 */
function get_max_id(callback) {
  var options = {
    host: config.couch.host,
    port: config.couch.port,
    path: '/' + config.couch.db + '/_design/util/_view/max_id',
    headers: {
      "User-Agent": user_agent,
      "Accept": "application/json"
    }
  };
  http.get(options, function(response) {
    response.setEncoding('utf8');
    var data = [];
    if (response.statusCode == 200) {
      response.on('data', function(chunk) {
        data.push(chunk);
      });
      response.on('end', function() {
        callback(JSON.parse(data.join('')));
      });
    } else if (response.statusCode == 404) {
      util.debug("util view does not exist; creating");
      create_util_view(_.bind(get_max_id, this, callback));
    } else {
      util.error("status code " + response.statusCode + " getting max id");
    }
  });
}

function dump_ratelimit(response) {
  util.debug('ratelimit: ' + response.headers['x-ratelimit-remaining'] + ' / ' + response.headers['x-ratelimit-limit'] + ' (reset in ' + (response.headers['x-ratelimit-reset'] - Math.floor(Date.now() / 1000)) + ')' );
}

/**
 * main() starts here, I guess.
 * We take much advantage of node.js's habit of quitting only when there is
 * no work left to do.
 */
get_max_id(function(result) {
  var since_id = undefined;
  if (result.rows && result.rows && result.rows[0].value) {
    since_id = result.rows[0].value;
  }

  oa.get('http://api.twitter.com/1/account/verify_credentials.json?include_entities=true', config.oauth.token, config.oauth.token_secret, function(error, data, response) {
    if (error) {
      util.error(error);
      process.exit(1);
    }
    var user = JSON.parse(data);
    dump_ratelimit(response);
    fetch(user.id_str, user.status.id_str, 1, since_id);
  });
});