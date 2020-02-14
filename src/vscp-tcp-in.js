///////////////////////////////////////////////////////////////////////////
// vscp-tcp-in
//
// VSCP tcp/ip input node.
//
// This file is part of the VSCP (http://www.vscp.org)
//
// The MIT License (MIT)
//
// Copyright © 2020 Ake Hedman, Grodans Paradis AB
// <info@grodansparadis.com>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
//

// Debug:
// export NODE_DEBUG=node-vscp-tcp-in

const path = require('path');

// const hlp = require(path.join(__dirname, '/lib/dateTimeHelper.js'));
// https://nodejs.org/api/util.html
// NODE_DEBUG=node-vscp-vscp-tcp*  for all debug events
// NODE_DEBUG=node-vscp-vscp-tcp-in  for debug events from this module
const util = require('util');
const debuglog = util.debuglog('node-vscp-tcp-in');

const vscp_class = require('node-vscp-class');
const vscp_type = require('node-vscp-type');
const vscp = require('node-vscp');
const vscp_tcp_client = require('node-vscp-tcp');

module.exports = function(RED) {
  'use strict';

  ///////////////////////////////////////////////////////////////////////////
  // vscpTcpInputNode
  //
  // @param {*} config - configuration

  // Create the tcp/ip input node
  function vscpTcpInputNode(config) {

    // Create the tcp/ip input node
    RED.nodes.createNode(this, config);

    // Retrieve the config node
    this.timeout = parseInt(config.timeout) || 10000;
    this.username = this.credentials.username || "admin";
    this.password = this.credentials.password || "secret";
    this.id = config.id;
    this.interface = config.interface || '';

    debuglog("Username: "+this.username);

    // Retrieve the config node
    this.host = RED.nodes.getNode(config.host);
    debuglog("Host: "+this.host.name);
    this.filter = RED.nodes.getNode(config.filter);
    debuglog("Filter: "+this.filter);

    // Config node state
    this.connected = false;
    this.connecting = false;
    this.closing = false;
    this.options = {};
    this.queue = [];

    const node = this;

    if (this.host) {
      // Do something with:
      //  this.server.host
      //  this.server.port
    } else {
      // No config node configured
    }

    this.connecting = true;
    this.status({fill:"yellow",shape:"dot",text:"node-red:common.status.connecting..."});
    //debuglog(RED._("vscp.state.disconnected",{broker:(node.clientid?node.clientid+"@":"")+node.name}));
    debuglog('Connecting to VSCP server on port: ' + this.host.name + " "+this.host.host+":"+this.host.port);

    let vscpclient = new vscp_tcp_client(); 

    vscpclient.addEventListener((e) => {
      //debuglog("Event:",e);
      var msg = { payload:e }
      this.send(msg);
    });

    vscpclient.on('connect', function() {
      debuglog("---------------- CONNECT -------------------");
      node.status({fill:"yellow",shape:"dot",text:"connecting..."});
    });

    vscpclient.on('disconnect', function() {
      debuglog("---------------- DISCONNECT -------------------");
      node.status({fill:"red",shape:"dot",text:"disconnected"});
    });

    vscpclient.on('timeout', function() {
      debuglog("---------------- TIMEOUT -------------------");
      node.status({fill:"red",shape:"dot",text:"timeout"});
    });

    vscpclient.on('error', function() {
      debuglog("---------------- ERROR -------------------");
      node.status({fill:"red",shape:"dot",text:"error"});
      /*if (err) {
        if (done) {
            // Node-RED 1.0 compatible
            done(err);
        } else {
            // Node-RED 0.x compatible
            node.error(err, msg);
        }
      }*/
    });

    this.on('close', function() {
      debuglog("---------------- node-red CLOSE -------------------");
      const testAsync = async () => {
        await vscpclient.disconnect();
      }
      testAsync().catch(err => {
        debuglog("Catching disconnect error");
        debuglog(err);
      })
    });

    let strResponse = "";
    const testAsync = async () => {
      // Connect to VSCP server/device
      const value1 = await vscpclient.connect(
      {
        host: this.host.host,
        port: this.host.port,
        timeout: this.host.timeout
      });

      // Send no operation command (does nothing)
      await vscpclient.sendCommand(
      {
        command: "noop"
      })

      // Log on to server (step 1 user name)
      // The response object is returned and logged
      const userResponse = await vscpclient.sendCommand(
      {
        command: "user",
        argument: "admin"
      });
      debuglog(userResponse);

      // Log on to server (step 2 password)
      await vscpclient.sendCommand(
      {
        command: "pass",
        argument: "secret"
      });

      // Send no operation command (does nothing)
      strResponse = await vscpclient.sendCommand(
      {
        command: "noop"
      })
      debuglog(strResponse);

      // Get channel id
      strResponse = await vscpclient.getChannelID();
      debuglog("ChannelID " + strResponse);

      // Get channel id
      strResponse = await vscpclient.getGUID();
      debuglog("GUID " + strResponse);

      strResponse = await vscpclient.startRcvLoop();
      debuglog(strResponse);
      
      node.status({fill:"green",shape:"dot",text:"connected"});
    }
    testAsync().catch(err => {
      debuglog("Catching error");
      debuglog(err.message);
      node.status({fill:"red",shape:"dot",text:"error: "+err.message});
    })
  }

  ///////////////////////////////////////////////////////////////////////////
  // initialize
  //
  // initializes the node
  //

  function initialize() {
    node.debug('initialize');
    if (!node.context().get('cacheData', node.storeName)) {
      node.context().set('cacheData', {}, node.storeName);
    }

    if (!node.context().get('previous', node.storeName)) {
      node.context().set(
          'previous', {
            level: NaN,  // unknown
            reasonCode: -1,
            usedRule: NaN
          },
          node.storeName);
    }

    const getName = (type, value) => {
      if (type === 'num') {
        return value;
      } else if (type === 'str') {
        return '"' + value + '"';
      } else if (type === 'bool') {
        return '"' + value + '"';
      } else if (type === 'global' || type === 'flow') {
        value = value.replace(/^#:(.+)::/, '');
      }
      return type + '.' + value;
    };
    const getNameShort = (type, value) => {
      if (type === 'num') {
        return value;
      } else if (type === 'str') {
        return '"' + hlp.clipStrLength(value, 20) + '"';
      } else if (type === 'bool') {
        return '"' + value + '"';
      } else if (type === 'global' || type === 'flow') {
        value = value.replace(/^#:(.+)::/, '');
        // special for Homematic Devices
        if (/^.+\[('|").{18,}('|")\].*$/.test(value)) {
          value = value.replace(/^.+\[('|")/, '').replace(/('|")\].*$/, '');
          if (value.length > 25) {
            return '...' + value.slice(-22);
          }
          return value;
        }
      }
      if ((type + value).length > 25) {
        return type + '...' + value.slice(-22);
      }
      return type + '.' + value;
    };

    node.rules.count = node.rules.data.length;
    node.rules.lastUntil = node.rules.count - 1;
    node.rules.checkUntil = false;
    node.rules.checkFrom = false;
    node.rules.firstFrom = node.rules.lastUntil;

    setTimeout(() => {
      try {
        initialize();
      } catch (err) {
        node.error(err.message);
        debuglog(util.inspect(err, Object.getOwnPropertyNames(err)));
        node.status({
          fill: 'red',
          shape: 'ring',
          text: RED._(
              'node-red-contrib-sun-position/position-config:errors.error-title')
        });
      }
    }, 200 + Math.floor(Math.random() * 600));
  }

  RED.nodes.registerType('vscp-tcp-in', vscpTcpInputNode, {
    credentials: {
      username: {type:"text"},
      password: {type:"password"}
    }
  });

};
