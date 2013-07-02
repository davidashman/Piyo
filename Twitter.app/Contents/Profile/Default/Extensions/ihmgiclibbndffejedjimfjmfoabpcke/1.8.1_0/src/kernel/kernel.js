/*
 * Kumquat Kernel
 * 
 * Copyright, 2012, Chernikov Alexey - http://github.com/chernikovalexey
 * 
 * Provides routing and managing of all in-extension processes, a few useful
 * APIs, such as User-storage, Web SQL DB API Wrap, Cache.
 * 
 * For its proper work requires Prevel
 * (http://github.com/chernikovalexey/Prevel).
 */

(function(win, doc, undefined) {
  
  // PRIVATE
  
  // Common variables
  // Template for extending storages
  var ext_o_storage = {
    current: '',
    cl: [],
    list: {}
  };
  
  // Empty function
  var ef = function() {};
  
  // Do not create separate data storage for them
  var excludes = 'data,ext,ui'.split(',');
  
  // Common functions
  // Length of the given object
  // Examples: getObjectLength({a: 2, b: 3}) => 2
  var getObjectLength = function(o) {
    if(pl.type(o, 'obj')) {
      var l = 0;
      for(var key in o) {
        ++l;
      }
      return l;
    } else {
      return o.length;
    }
  };
  
  // ======
  // PUBLIC
  
  // Extend window with `ke`
  // General structure of `ke`;
  // perhaps, some properties will be reassigned
  win.ke = {
    data: {},     // Data container
    
    app: {},      // Object with mvc of the current hub
    ui: {},       // User-Interface
    
    import: {},   // Import given script/style
    
    ext: {},      // Object with user-created extensions
    db: {},       // Wrapper for Web SQL DB API
    us: {},       // User-storage with objects
    cache: {},    // Kumquat Cache API
    nav: {}       // Navigation on ordinary pages
  };
  
  for(var key in win.ke) {
    if(!~pl.inArray(key, excludes)) {
      ke.data[key] = {};
    }
  }
  
  /*
   * Module: import (inherently, it's an analogue of `import` in Java)
   * 
   * Provides: - Organizing queues of files to be loaded; - Loading queue after
   * Dom ready; - Supports .js and .css; - Storing history of loaded files; -
   * Reacting with firing callback when queue is loaded.
   */
  
  ke.import = (function() {
    return function(src, sub) {
      return new ke.import.add(src, sub);
    };
  })();
  
  pl.extend(ke.import, {
    ready: [],
    
    // Prefix before the path to file (e.g. root:kernel.kernel)
    // Now root is the only supported prefix
    get prefix() {
      return ~pl.inArray(ke.section, ke.data.kernel.save.internal_pages) ? ke.getConst('ROOT_PREFIX') : '';
    },
    
    // JS or CSS
    parseType: function(src) {
      src = src.replace(/\./g, '/');

      var response;

      if(src.substr(0, 2) === ke.getConst('STYLE_PREFIX')) {
        response = src.substr(2) + '.css';
      } else if(src.substr(5, 2) === ke.getConst('STYLE_PREFIX')) {
        response = 'root:' + src.substr(7) + '.css';
      } else {
        response = src + '.js';
      }

      return response;
    },
    
    addRes: function(src) {
      var prefix = '';
      var slash = '/';
      
      if(src.substring(0, 5) === ke.getConst('ROOT_PREFIX')) {
        prefix = ke.pathToExt;
        slash  = '';
        src    = src.substring(5);
      }
      
      return prefix + (src.substr(src.length - 4) === '.css' ? slash + 'resources/styles/' : slash + 'src/') + src;
    },
    
    add: function(src, sub) {
      src = ke.import.prefix + src;
      
      var root = src.substring(0, 5) === ke.getConst('ROOT_PREFIX');
      
      src = ke.import.addRes( ke.import.parseType(src) );
      
      var file_name = src.split('/').pop().split('.')[0];
      var parent = src.split('/')[root ? 4 : 2];

      if(~pl.inArray(src, ke.data.import.loaded)) {
        return;
      }
        
      if(ke.deploy[parent] && ke.deploy[parent].before) {
        ke.deploy[parent].before(file_name, src.split('/').splice(-2, 1)[0]);
      } else {
        ke.deploy[parent] = {after: ef};
      }
        
      ke.import.ready.push(0);
      
      if(root) {
        pl.ajax({
          url: src,
          type: 'GET',
          success: function(data) {
            if(src.substr(src.length - 4) === '.css') {
              pl('<style>', {
                type: 'text/css'
              }).html(data).appendTo('head');
            } else {
              win.eval(data);
            }
              
            ke.deploy[parent].after(file_name, src.split('/').splice(-2, 1)[0]);
            ke.import.ready.pop();
          }
        });
      } else {
        pl.attach({
          url: src,
          load: function(u, t) {
            if(!pl.type(u, 'str')) {
              ke.import.ready.pop();
              return;
            }

            ke.data.import.loaded.push(
              !pl.empty(ke.data.import.queue_name) ? 
                [ke.data.import.queue_name, u] : 
                u
            );

            ke.import.ready.pop();
            ke.deploy[parent].after(file_name, src.split('/').splice(-2, 1)[0]);
          }
        });
      }
            
      return ke.import;
    },
    
    // Optional for import: fire callback when everything is loaded
    onDone: function(callback) {
      var int = setInterval(function() {
        if(pl.empty(ke.import.ready)) {
          clearInterval(int);
          callback && callback();
        }
      }, 1);
    },
    
    // Loaded files as an array
    getLoaded: function() {
      return ke.data.import.loaded;
    }
  });
  
  /*
   * Module: data (based on basic objects)
   * 
   * Provides storing: - kernel settings; - current flags (dom loaded, ...); -
   * user containers (`ke.storage`).
   */
  
  pl.extend(ke.data.import, {
    loaded: []
  });
  
  pl.extend(ke.data.db, ext_o_storage);
  pl.extend(ke.data.us, ext_o_storage);
  
  pl.extend(ke.data, {
    
    // Kernel storage
    kernel: {
      'const': {
        STYLE_PREFIX: 's:',
        ROOT_PREFIX: 'root:',
        KERNEL_DB: 'KE_Kernel',
        CACHE_TABLE: 'Cache',

        VERBOSE: true
      },
      
      flags: {
        dom_loaded: false,
        kumquat_ready: false
      },
      
      info: {
        url: doc.location.href,
        ver: navigator.appVersion.match('Chrome/([0-9\.]+)')[1],
        lang: navigator.language,
        id: chrome.i18n.getMessage('@@extension_id')
      },
      
      // Public kernel data
      save: {
        internal_pages: ['content']
      }
    }
  });
    
  pl.extend(ke.data.kernel.info, {
    section: ke.data.kernel.info.url.match('chrome-extension://') ? 
      ke.data.kernel.info.url.match(/([A-z0-9]+)\.html/)[1] : 
      window.KumquatSection || 'content'
  });

  /*
   * Public kernel functions and getters
   * 
   */
  
  pl.extend(ke, {
    // A logger, which can be easily turned off
    log: function() {
      if(ke.getConst('VERBOSE')) {
        console.log.apply(console, arguments);
      }
    },

    // Main init
    init: function() {
      if(ke.getFlag('kumquat_ready')) {
        return;
      }

      // Get and execute additional init
      ke.import('kernel.init').onDone(function() {
        ke.loadCurrentHub();
        ke.data.kernel.save.user_init();

        // Deploy Kernel DB environment
        ke.db.choose(ke.getConst('KERNEL_DB'));
        ke.db.execSql('SELECT * FROM ?', [ke.getConst('CACHE_TABLE')], null, function() {
          ke.db.execSql('CREATE TABLE ' + ke.getConst('CACHE_TABLE') + ' (id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, timestamp DATETIME, name VARCHAR(255), data TEXT)', [], null, null);
        });
      });

      // Flags
      ke.setFlagTrue('kumquat_ready');
    },
        
    get section() {
      return ke.data.kernel.info.section;
    },
    
    get extId() {
      return ke.data.kernel.info.id;
    },
    
    // Where `chrome.extension.getURL` does not fit
    get pathToExt() {
      return 'chrome-extension://' + ke.extId + '/';
    },
    
    getFlag: function(n) {
      return ke.data.kernel.flags[n];
    },
    
    // Create a new flag, if it does not exist
    createFlag: function(n, def_val) {
      if(pl.type(ke.data.kernel.flags[n], 'undef')) {
        ke.data.kernel.flags[n] = !pl.type(def_val, 'undef') ? def_val : false;
      }
    },
    
    setFlagTrue: function(n) {
      if(!pl.type(ke.data.kernel.flags[n], 'undef')) {
        ke.data.kernel.flags[n] = true;
      }
    },
    
    setFlagFalse: function(n) {
      if(!pl.type(ke.data.kernel.flags[n], 'undef')) {
        ke.data.kernel.flags[n] = false;
      }
    },
    
    getConst: function(where, n) {
      if (!n) {
        n = where;
        where = 'data.kernel';
      }
      
      var tmp = window.ke;
      var p = where.split('.');
      pl.each(p, function(k, v) {
        tmp = tmp[v];
      });
      
      return tmp['const'][n.toUpperCase()];
    },
    
    loadCurrentHub: function() {
      // Scripts
      ke.import('hub.' + ke.section + '.router');
      ke.import('hub.' + ke.section + '.render');
      ke.import('hub.' + ke.section + '.handlers').onDone(function() {
        var ready = [];

        (ke.app.asyncInit || ke.EF)();

        pl.each(ke.app.import || [], function(k, v) {
          ready.push(0);
          ke.import(v).onDone(function() {
            ready.pop();
          });
        });
        
        var int = setInterval(function() {
          if(pl.empty(ready)) {
            clearInterval(int);
            ke.app.init();

            // Styles
            if(ke.section !== 'background') {
              var path = (ke.section === 'content' || ke.section === window.KumquatSection ? 'internal' : 'public') + '.' + ke.section;
              ke.import('s:pages.common.main');
              ke.import('s:pages.' + path);
            }
          }
        }, 1);
      });
    },

    getResource: function(p) {
      return '/resources/' + p;
    },
      
    getImage: function(n) {
      return this.getResource('images/' + n + '.png');
    },

    getInternalPage: function(n) {
      return '/pages/internal/' + n + '.html';
    },
      
    proccessCall: function() {
      var p = [];
      pl.each(arguments, function(k, v) {
        p.push(v);
      })
      return p.join(',');
    },
      
    parseProccessCall: function(command) {
      var tmp = command.split(',');
      var f = {
        lib: tmp[0],
        cmd: tmp[1],
        exact: tmp[2]
      };
      return f;
    },
      
    // It's a bit shorter
    getLocale: function() {
      return chrome.i18n.getMessage.apply(chrome, arguments);
    },
    
    // Two variants which fires..:
    // - before loading the script/style
    // - after its loading
    deploy: {
      hub: {
        before: function(n) {
          if(n === 'router') {
            pl.extend(ke.app, {
              render: {},    // Attach events, organize ui
              handlers: {},  // Function called by events, render
            });
          }
        },
        
        after: ef
      },
      
      ext: {
        before: function(n, prev) {
          if(prev !== 'ext') {
            ke.ext[prev] = ke.ext[prev] || {};
            ke.ext[prev][n] = {};
          } else {
            ke.ext[n] = {};
          }
        },
        
        after: function(n, prev) {
          pl.each((ke.ext[prev] ? ke.ext[prev][n].import : ke.ext[n].import) || [], function(k, v) {
            ke.import(v);
          });
        }
      },
      
      // UI is not ready yet, but let it be here...
      ui: {
        before: ef,
        after: ef
      }
    }
  });
  
  /*
   * Module: db (useful api for web sql database)
   * 
   * Provides: - Adding new databases - Executing requests to the selected db -
   * Deleting db
   */
  
  // Simple size parsing from a string (5 mb => 5242880)
  var parseSize = function(s) {
    if(pl.type(s, 'int') || pl.type(s, 'undef')) {
      return s;
    }
    
    var t = s.split(' ');
    var to = t.pop().toLowerCase();
    
    return t[0] * Math.pow(1024, to === 'mb' ? 2 : 1);
  };
   
  pl.extend(ke.db, {
    choose: function(name, size) {
      ke.data.db.current = name;
      size = parseSize(size) || 5 * Math.pow(1024, 2);

      if(!ke.data.db.list[name]) {
        ke.data.db.list[name] = openDatabase(name, '1.0.0', name + ' database', size);

        if(!ke.data.db.list[name]) {
          pl.error('Could not connect to the database.');
        }
      }

      return ke.data.db.list[name];
    },
    
    get selected() {
      return ke.data.db.current;
    },
    
    get currentDb() {
      return !pl.empty(ke.data.db.list) ? 
        ke.data.db.list[ke.data.db.current] : 
        null;
    },
        
    execSql: function(req, s, o, f) {
      ke.db.currentDb.transaction(function(tx) {
        tx.executeSql(req, s, function(tx, res) {
          (o || ef)(res);
        }, function(tx, err) {
          (f || ef)(err);
        });
      });
    }
  });
  
  /*
   * Module: us (instant type of storage based on objects)
   * 
   * Provides: - Selecting storage to work with; - Pushing new data to the
   * selected storage; - Getting last element of the storage; - Getting first
   * element of the storage; - Getting arbitrary element of the storage; -
   * Deleting it (storage).
   */
  
  // Init the default storage - with an empty key
  ke.data.us.list[ke.data.us.current] = [];
  
  var _in = function(n, msg) {
    if(pl.type(msg, 'undef')) {
      msg = n;
      n = ke.data.us.current;
    }
    ke.data.us.list[n] = ke.data.us.list[n] || [];
    ke.data.us.list[n][this](msg);
  };
  
  pl.extend(ke.us, {
    choose: function(n) {
      if(pl.type(ke.data.us.list[n], 'undef')) {
        ke.data.us.list[n] = [];
      }
      ke.data.us.cl.push(n);
      ke.data.us.current = n;
    },
    
    // Default key = empty key
    chooseDefault: function() {
      ke.us.choose('');
    },
    
    choosePrev: function() {
      ke.us.choose(ke.data.us.cl.pop());
    },
    
    push: function() {
      _in.apply('push', arguments);
    },
    
    unshift: function() {
      _in.apply('unshift', arguments);
    },
    
    pop: function(n) {
      return ke.data.us.list[n || ke.data.us.current].pop();
    },
    
    shift: function(n) {
      return ke.data.us.list[n || ke.data.us.current].shift();
    },
    
    get: function(n, index) {
      if(pl.type(index, 'undef')) {
        index = n;
        n = ke.data.us.current;
      }
      var us = ke.data.us.list[n];
      return us[index === 'first' ? 0 : (index === 'last' ? us.length - 1 : index)] || us;
    },
    
    pluck: function(n, from, to) {
      if(!pl.type(n, 'str')) {
        to = from;
        from = n;
        n = ke.data.us.current;
      }
      
      var alias = ke.data.us.list[n || ke.data.us.current];
      return alias.splice(from, pl.type(to, 'undef') ? alias.length - 1 : to);
    },
    
    each: function(n, fn) {
      if(pl.type(fn, 'undef')) {
        fn = n;
        n = ke.data.us.current;
      }
      
      var alias = ke.data.us.list[n]; // To prevent changes in `ke.data.us.list`
      pl.each(alias.reverse(), function(k, v) {
        fn(v, k);
      });
    },
    
    length: function(n) {
      return getObjectLength((ke.data.us.list[n || ke.data.us.current] || {}));
    },
    
    empty: function(n) {
      ke.data.us.list[n || ke.data.us.current] = [];
    }
  });
  
  /*
   * Module: cache (long-term cache based on Web SQL DB)
   * 
   * Provides: - Saving; - Getting; - Updating; - Removing elements; - Purging
   * the whole cache; - Going through the cache using `each`.
   */
  
  // Data, at first
  pl.extend(ke.data.cache, {
    table: ke.getConst('CACHE_TABLE')
  });
  
  pl.extend(ke.cache, {    
    chooseDb: function() {
      ke.db.choose(ke.getConst('KERNEL_DB'));
    },
    
    save: function(n, msg) {
      this.chooseDb();
      ke.db.execSql(
        'INSERT INTO ' + ke.data.cache.table + ' (timestamp, name, data) VALUES(?, ?, ?)', 
        [Date.now(), n, msg],
        null, null
      );
    },
    
    get: function(id, callback) {
      this.chooseDb();
      ke.db.execSql(
        'SELECT * FROM ' + ke.data.cache.table + ' WHERE ' + (pl.type(id, 'str') ? 'name' : 'id') + ' = ? ORDER by id DESC',
        [id],
        function(tx, res) {
          var r = [];
          var len = res.rows.length;
          for(var key = 0; key < len; ++key) {
            r.push(res.rows.item(key));
          }
          
          callback(r);
        },
        null
      );
    },
    
    update: function(n, msg) {
      this.chooseDb();
      
      ke.db.execSql(
        'UPDATE ' + ke.data.cache.table + ' SET data = ? WHERE ' + (pl.type(n, 'str') ? 'name' : 'id') + ' = ?',
        [msg, n],
        null, null
      );
    },
    
    clean: function() {
      this.chooseDb();
      ke.db.execSql(
        'DELETE FROM ' + ke.data.cache.table,
        [],
        null, null
      );
    },
    
    remove: function(id) {
      this.chooseDb();
      ke.db.execSql(
        'DELETE FROM ' + ke.data.cache.table + ' WHERE ' + (pl.type(id, 'str') ? 'name' : 'id') + ' = ?',
        [id],
        null, null
      );
    },
    
    each: function(fn) {
      this.chooseDb();
      ke.db.execSql(
        'SELECT * FROM ' + ke.data.cache.table + ' ORDER by id DESC',
        [],
        function(tx, res) {
          var len = res.rows.length;
          var d = null;
          for(var key = 0; key < len; ++key) {
            d = res.rows.item(key);
            fn(d.name, d.data, d.id, d.timestamp);
          }
        },
        null
      );
    }
  });
  
  /*
   * Module: nav (navigation between ordinary pages)
   * 
   * Provides: - Redirecting to the given page.
   */
  
  pl.extend(ke.nav, {
    go: function(pagename, delay) {
      setTimeout(function() {
        doc.location = '/pages/public/' + pagename + '.html';
      }, delay || 0);
    }
  });
  
  // Initialize Kumquat (immediately, on dom is ready, on window is loaded)
  if(!ke.getFlag('kumquat_ready')) {
    ke.init();
  }

  pl(function() {
    ke.setFlagTrue('dom_loaded');
    ke.init();
  });

  pl(window).bind('load', function() {
    if(!ke.getFlag('kumquat_ready')) {
      ke.init();
    }
  });

})(this, document);