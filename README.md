couch-tweet-archiver
====================

This is a script to use [node.js] and [CouchDB] to archive your
tweets. You can then use CouchDB views to analyze your tweets or just
keep them around.

IT'S JAVASCRIPT ALL THE WAY DOWN.

Getting Started
---------------

 * Install node.js, version 0.3 or later. (It's probably possible to be
   compatible with version 0.2 with only minor code changes.) Then,
   install [npm]. Do
       npm install underscore oauth
   to get the needed modules.

 * Install CouchDB. I think version 0.8 or later should be okay, but
   haven't tried with anything before 1.0. Create a CouchDB database
   (it can be empty) where your tweets will be stored.

 * Create a [Twitter app].
 
 * Copy `config.json.sample` to `config.json` and fill in the values
   appropriately.
   
 * Run
       node couch-tweet-archiver.js
   and hope for the best.
   
 * Use [futon] or your own code to create views and query the
   database. Or just keep it forever.

Possible Extensions
-------------------

Here are some things that you could work on, if you're so inclined.

 * There's no actual reason that this is restricted to archiving your
   own tweets; you could easily modify the code to archive someone
   else's.
   
 * Similarly, you could modify the `trim_user`, `include_rts`, and
   `include_entities` parameters to your liking.
   
 * There could be a library of useful standard views, or even some
   CouchDB shows and lists for a usable web UI.
   
 * You could make this all somehow actually useful.
 
License
-------

This program is free software. It comes without any warranty, to the
extent permitted by applicable law. You can redistribute it and/or
modify it under the terms of the [Do What The Fuck You Want To Public
License], Version 2, as published by Sam Hocevar. See
http://sam.zoy.org/wtfpl/COPYING for more details.


[node.js]: http://nodejs.org/
[CouchDB]: http://couchdb.apache.org/
[npm]: http://npmjs.org/
[Twitter app]: http://dev.twitter.com/apps
[futon]: http://wiki.apache.org/couchdb/Getting_started_with_Futon
[Do What The Fuck You Want To Public License]: http://sam.zoy.org/wtfpl/
