/* open-eid.js */

const { app, BrowserWindow, MenuItem, Menu, ipcMain, systemPreferences, dialog } = require('deskgap');
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
  
  fs.writeFileSync(path.join(os.homedir(), 'Open e-ID Errors.txt'), '');
 
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
  
  ipcMain.on('get-url', function(e, message) {
    e.sender.send('url', args.replace(proto, 'https'));
  });

  ipcMain.on('get-libs', function(e, message) {
    e.sender.send('libs', locate_libs());
  });


  ipcMain.on('read', function(e, options) {
    try {
      console.log('Read using ' + options.lib_path);
      pkcs11 = new pkcs11js.PKCS11();
      pkcs11.load(options.lib_path);
      pkcs11.C_Initialize();

      // Getting list of slots
      var slots = pkcs11.C_GetSlotList(true);
      if(slots.length == 0) {
        mainWindow.webView.send('alert', {msg: 'Please connect reader and insert card'}); 
        return;
      }
      var slot = slots[0];
      
      try {  
        session = pkcs11.C_OpenSession(slot, pkcs11js.CKF_RW_SESSION | pkcs11js.CKF_SERIAL_SESSION);
      } catch(e) {
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
            
          } catch(e) {
            // ignore
          }
          hObject = pkcs11.C_FindObjects(session);
      }
      pkcs11.C_FindObjectsFinal(session);   
      pkcs11.C_CloseSession(session);                                 
      pkcs11.C_Finalize(); 
      
      var url = new String(args).replace(proto, 'https') + '#' + encodeURIComponent(JSON.stringify(data));
      var cmd = '';
      if(os.platform() == 'darwin') {
        if(bundle == 'com.google.Chrome') {
          browser += 'Contents/MacOS/Google Chrome';
          cmd = '"' + browser + '" --args --app="' + url + '"';
        } else {
          cmd = 'open "' + browser + '" "' + url + '"';     
        }
      } else {
        fs.writeFileSync(path.join(os.homedir(), 'Open e-ID URL.txt'), url);
        // TEST
        url = new String(args).replace(proto, 'https') + '#' + encodeURIComponent('{"test":"test"}');
        cmd = 'iexplore "' + url + '"';
      }
    	exec(cmd);    
      app.quit();
      
    } catch(e){
      fs.writeFileSync(path.join(os.homedir(), 'Open e-ID Errors.txt'), e.toString());
      app.quit();
    }                              
  });  
 
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
            show: false,
            width: 500, height: 300,
            center: true,
        }).once('ready-to-show', () => {
          
          try {
                                
            mainWindow.show();
            if(os.platform() == 'darwin') exec('osascript -e \'tell application "Open e-ID" to activate\'');
            //mainWindow.webView.send('url', args.replace(proto, 'https'));  
            //locate_libs();                      
          
          } catch(e){
            
            fs.writeFileSync(path.join(os.homedir(), 'Open e-ID Errors.txt'), e.toString());
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
    fs.writeFileSync(path.join(os.homedir(), 'Open e-ID Errors.txt'), e.toString());
    app.quit();
}

