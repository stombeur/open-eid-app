/* open-eid.js */

const { app, BrowserWindow, MenuItem, Menu, ipcMain, ipcRenderer, systemPreferences, dialog } = require('deskgap');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { exec, execSync } = require('child_process');

try {

  let mainWindow;
  var pkcs11js = require('pkcs11js');             
  var pkcs11 = null;
  var session = null;
  var args = '';
   
  if(process.argv.length > 1) args = process.argv[1];
  var parts = args.split(':');
  var proto = parts[0];
  var browser = '';
  var bundle = '';
  parts = args.split('?');
  if(parts.length > 1) {
    parts = parts[1].split('&');
    for(var i = 0; i < parts.length; i++) {
      var nameval = parts[i].split('=');
      if(nameval[0] == 'eid-app') browser = nameval[1];
      if(nameval[0] == 'eid-bundle') bundle = nameval[1];
    }
  }
  
  if(os.platform().indexOf('win') == 0) {
    var activeWin = new String(execSync(__dirname + '\\active-win.exe', { windowsHide: true }));
    if(activeWin.indexOf('{') == 0) {
      activeWinObj = JSON.parse(activeWin);
      if('path' in activeWinObj) browser = activeWinObj.path;
    }
  }
  
  ipcMain.on('get-url', function(e, message) {
    e.sender.send('url', args.replace(proto, 'https'));
  });

  ipcMain.on('get-libs', function(e, message) {
    e.sender.send('libs', locate_libs());
  });


  ipcMain.on('read', function(e, options) {
    eid_read(options);                   
  });  
 
  function eid_read(options) {
    try {
      console.log('Read using ' + options.lib_path);
      pkcs11 = new pkcs11js.PKCS11();
      pkcs11.load(options.lib_path);
      pkcs11.C_Initialize();

      // Getting list of slots
      try {
        var slots = pkcs11.C_GetSlotList(true);
      } catch(e3) {
        try { pkcs11.C_Finalize(); } catch(e4) {}        
        mainWindow.webView.send('alert', {msg: 'Please connect reader and insert card\n\n' + e3.toString()}); 
        setTimeout(function() {
          mainWindow.webView.send('alert', {msg: ''}); 
          eid_read(options);
        }, 2000);
        return false;
      }
      if(slots.length == 0) {
        try { pkcs11.C_Finalize(); } catch(e4) {}        
        mainWindow.webView.send('alert', {msg: 'Please connect reader and insert card'}); 
        setTimeout(function() {
          mainWindow.webView.send('alert', {msg: ''}); 
          eid_read(options);
        }, 2000);
        return false;
      }
      
      var slot = slots[0];
            
      try {  
        session = pkcs11.C_OpenSession(slot, pkcs11js.CKF_RW_SESSION | pkcs11js.CKF_SERIAL_SESSION);
      } catch(e3) {
        mainWindow.webView.send('alert', {msg: 'Please connect reader and insert card'}); 
        return;
      }
      
      pkcs11.C_FindObjectsInit(session, [{ type: pkcs11js.CKA_CLASS, value: pkcs11js.CKO_DATA }]);
      var hObject = pkcs11.C_FindObjects(session);
      var data = {};
      while(hObject) {
          var attrs = pkcs11.C_GetAttributeValue(session, hObject, [
              { type: pkcs11js.CKA_CLASS },
              { type: pkcs11js.CKA_TOKEN },
              { type: pkcs11js.CKA_LABEL },
              { type: pkcs11js.CKA_VALUE }
          ]);
          // Output info for objects from token only
          try {
            var key = attrs[2].value.toString().toLowerCase();
            var value = attrs[3].value.toString();
            if(key == 'chip_number' || key == 'carddata_serialnumber' || key == 'atr') value = attrs[3].value.toString('hex').toUpperCase();
            if(key.indexOf('_hash') != -1 || 
              key.indexOf('_version') != -1 || 
              key.indexOf('_code') != -1 || 
              key.indexOf('_lifecycle') != -1) value = attrs[3].value.toString('hex');
            if(key.indexOf('_data') != -1 || key.indexOf('_file') != -1) value = attrs[3].value.toString('base64');
            data[key] = value;
            
          } catch(e3) {
            // ignore
          }
          hObject = pkcs11.C_FindObjects(session);
      }
      pkcs11.C_FindObjectsFinal(session);   
      pkcs11.C_CloseSession(session);                                 
      pkcs11.C_Finalize(); 
      
      if(options.sign) {
        var canJson = canonicalize(data);
        pkcs11 = new pkcs11js.PKCS11();
        pkcs11.load(options.lib_path);
        pkcs11.C_Initialize(); 
        var slots = pkcs11.C_GetSlotList(true);     
        var slot = slots[0];          
        session = pkcs11.C_OpenSession(slot, pkcs11js.CKF_RW_SESSION | pkcs11js.CKF_SERIAL_SESSION);      
        pkcs11.C_FindObjectsInit(session, [{ type: pkcs11js.CKA_CLASS, value: pkcs11js.CKO_PRIVATE_KEY }]);
        var hObject = pkcs11.C_FindObjects(session);
        while (hObject) {
            var attrs = pkcs11.C_GetAttributeValue(session, hObject, [
                { type: pkcs11js.CKA_CLASS },
                { type: pkcs11js.CKA_TOKEN },
                { type: pkcs11js.CKA_LABEL }
            ]);
            // Output info for objects from token only
            if (attrs[1].value[0]){
                if(attrs[2].value.toString().toUpperCase().indexOf('SIGNATURE') != -1) {
                  pkcs11.C_SignInit(session, { mechanism: pkcs11js.CKM_SHA256_RSA_PKCS }, hObject);
                  pkcs11.C_SignUpdate(session, new Buffer(canJson));
                  var signature = pkcs11.C_SignFinal(session, Buffer(256));  
                  data.signature = signature.toString('base64');
                }
            }
            hObject = pkcs11.C_FindObjects(session);
        }
        /*
        pkcs11.C_SignInit(session, { mechanism: pkcs11js.CKM_SHA256_RSA_PKCS }, keys.privateKey);         
        pkcs11.C_SignUpdate(session, new Buffer(canJson));
        var signature = pkcs11.C_SignFinal(session, Buffer(256));        
        */
        pkcs11.C_FindObjectsFinal(session);        
        pkcs11.C_CloseSession(session);                                 
        pkcs11.C_Finalize(); 
      }
      
      var url = new String(args).replace(proto, 'https') + '#' + encodeURIComponent(JSON.stringify(data));
      var cmd = '';
      var options = {};
      if(os.platform() == 'darwin') {
        if(bundle == 'com.google.Chrome') {
          browser += 'Contents/MacOS/Google Chrome';
          cmd = '"' + browser + '" --args --app="' + url + '"';
        } else if(bundle == 'org.mozilla.firefox') {
          browser += 'Contents/MacOS/firefox';
          cmd = '"' + browser + '" -width 300 -height 300 -new-window "' + url + '"';
        } else if(bundle == 'com.apple.Safari') {
          browser += 'Contents/MacOS/Safari';
          cmd = 'open -a Safari "' + url + '"';
        } else {
          cmd = 'open "' + browser + '" "' + url + '"';     
        }
      } else {
        fs.writeFileSync(path.join(os.homedir(), 'Open e-ID URL.txt'), url);
        if(url.length > 8000) {
          for(var k in data) {
            if(k.indexOf('_data') != -1) delete data[k];
          }
          url = new String(args).replace(proto, 'https') + '#' + encodeURIComponent(JSON.stringify(data));
        }
        if(url.length > 8000) {
          for(var k in data) {
            if(k.indexOf('_file') != -1 && k != 'photo_file') delete data[k];
          }
          url = new String(args).replace(proto, 'https') + '#' + encodeURIComponent(JSON.stringify(data));
        }
        if(url.length > 8000) {
          for(var k in data) {
            if(k == 'photo_file') delete data[k];
          }
          url = new String(args).replace(proto, 'https') + '#' + encodeURIComponent(JSON.stringify(data));
        }
        if(browser.toLowerCase().indexOf('\\iexplore.exe') != -1) {
          if(url.length > 2048) {
            for(var k in data) {
              if(k == 'photo_file') delete data[k];
            }
            url = new String(args).replace(proto, 'https') + '#' + encodeURIComponent(JSON.stringify(data));
          }          
        }
        options = { windowsHide: true };
        fs.writeFileSync(path.join(os.homedir(), 'Open e-ID URL 2.txt'), url);
        
        // todo - firefox (new process + enabled script window close)
        
        if(browser.toLowerCase().indexOf('\\chrome.exe') != -1) {
          cmd = '"' + browser + '" --args --app="' + url + '"';
        } else if(browser.toLowerCase().indexOf('\\firefox.exe') != -1) {
          cmd = '"' + browser + '" -width 300 -height 300 -new-window "' + url + '"';     
        //} else if(browser.toLowerCase().indexOf('\\iexplore.exe') != -1) {
          //cmd = '"' + browser + '" -k "' + url + '"';     
        } else {
          cmd = '"' + browser + '" "' + url + '"';
        }
      }
      fs.writeFileSync(path.join(os.homedir(), 'Open e-ID Cmd.txt'), cmd);
    	exec(cmd, options);    
      app.quit();
      
    } catch(e2){
      dialog.showErrorBox('Error', e2.stack);      
      app.quit();
    }       
  }
 
  var fx = {
    'eid': 'read',
    'openeid': 'read',
    'eidread': 'read',
  	'openeidread': 'read',
  	'eidsign': 'sign',
  	'openeidsign': 'sign',
  	'eid-read': 'read',
  	'openeid-read': 'read',
  	'eid-sign': 'sign',
  	'openeid-sign': 'sign',
  	'e-id': 'read',
  	'open-eid': 'read',
  	'e-id-read': 'read',
  	'open-eid-read': 'read',
  	'e-id-sign': 'sign',
  	'open-eid-sign': 'sign'
  }
  
  function fx_read() {

    app.once('ready', () => {
        mainWindow = new BrowserWindow({
            title: 'Open e-ID',
            titleBarStyle: 'default',
            resizable: true,
            minimizable: false,
            maximizable: false,            
            show: false,
            width: 500, height: 300,
            center: true,
        }).once('ready-to-show', () => {
          
          try {
            
            mainWindow.setMenu(null);    
            mainWindow.show();
            if(os.platform() == 'darwin') exec('osascript -e \'tell application "Open e-ID" to activate\'');
          
          } catch(e){
            
            dialog.showErrorBox('Error', e.stack);
            app.quit();
            
          }            
        });

        mainWindow.loadFile('open-eid-read.html');
    
        mainWindow.on('closed', () => {
            mainWindow = null;
            app.quit();
        });        
    });     	  	
  }
  	
  function fx_sign() {
    app.quit();
  }
  
  if(proto != '' && (proto in fx)) {
    
    var f = fx[proto];
    if(f == 'read') fx_read();
    if(f == 'sign') fx_sign();
    
  } else {
    
    app.once('ready', () => {
        mainWindow = new BrowserWindow({
            title: 'Open e-ID',
            titleBarStyle: 'hiddenInset',
            resizable: false,
            minimizable: false,
            maximizable: false,
            show: false,
            width: 300, height: 100,
            center: true,
        }).once('ready-to-show', () => {
            mainWindow.show();
        });
    
        mainWindow.loadFile("open-eid.html");
    
        mainWindow.on('closed', () => {
            mainWindow = null;
            app.quit();
        });
    });   
     
  } 
  
  function locate_libs() {
    var locate = 'locate *pkcs11*.dylib';
    if(os.platform().indexOf('win') == 0) locate = 'where /r "%ProgramFiles%" *pkcs11*.dll';
    var libs = [];
    try {
      libs = new String(execSync(locate, { windowsHide: true })).replace(/\r/g, '').split('\n');
    } catch(e) {
      //
    }
    fs.writeFileSync(path.join(os.homedir(), 'Open e-ID Libs.txt'), JSON.stringify(libs));    
    var elibs = [];
    for(var i = 0; i < libs.length; i++) {
      if(libs[i] != '') {
        try {
          pkcs11 = new pkcs11js.PKCS11();
          pkcs11.load(libs[i]);
          pkcs11.C_Initialize();
          var module_info = pkcs11.C_GetInfo();
          if(module_info) {
            module_info.path = libs[i];
            elibs[elibs.length++] = module_info;
          }                               
          pkcs11.C_Finalize();
          pkcs11 = null;
          delete pkcs11;
        } catch(e) {
          //    
        }
      }
    }
    fs.writeFileSync(path.join(os.homedir(), 'Open e-ID Libs.txt'), JSON.stringify(elibs));        
    if(libs.length == 0) elibs = {path: '', description: 'No library found - Please install middleware'};
    return elibs;
  }
  
} catch(e){
    try { pkcs11.C_FindObjectsFinal(session); } catch(e2) {}
    try { pkcs11.C_CloseSession(session); } catch(e2) {}                                
    try { pkcs11.C_Finalize(); } catch(e2) {}
    dialog.showErrorBox('Error', e.stack);
    app.quit();
}

var canonicalize = function(object) {
    var buffer = '';
    serialize(object);
    return buffer;
    function serialize(object) {
        if (object !== null && typeof object === 'object') {
            if (Array.isArray(object)) {
                buffer += '[';
                let next = false;
                // Array - Maintain element order
                object.forEach((element) => {
                    if (next) {
                        buffer += ',';
                    }
                    next = true;
                    // Recursive call
                    serialize(element);
                });
                buffer += ']';
            } else {
                buffer += '{';
                let next = false;
                // Object - Sort properties before serializing
                Object.keys(object).sort().forEach((property) => {
                    if (next) {
                        buffer += ',';
                    }
                    next = true;
                    // Properties are just strings - Use ES6
                    buffer += JSON.stringify(property);
                    buffer += ':';
                    // Recursive call
                    serialize(object[property]);
                });
                buffer += '}';
            }
        } else {
            // Primitive data type - Use ES6
            buffer += JSON.stringify(object);
        }
    }
};
