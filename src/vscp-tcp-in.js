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
// https://nodejs.org/api/util.html
// export NODE_DEBUG=node-vscp-tcp*  for all debug events
// export NODE_DEBUG=node-vscp-tcp-in  for debug events from this module
// export NODE_DEBUG=node-vscp-tcp-in-msg to output events
const util = require('util');

const vscp_class = require('node-vscp-class');
const vscp_type = require('node-vscp-type');
const vscp = require('node-vscp');
const vscp_tcp_client = require('node-vscp-tcp');

module.exports = function(RED) {

  'use strict';

  const debuglog = util.debuglog('node-vscp-tcp-in');
  const debuglogmsg = util.debuglog('node-vscp-tcp-in.msg');

  ///////////////////////////////////////////////////////////////////////////
  // vscpTcpInputNode
  //
  // @param {*} config - configuration

  // Create the tcp/ip input node
  function vscpTcpInputNode(config) {

    // Create the tcp/ip input node
    RED.nodes.createNode(this, config);

    var flowContext = this.context().flow;

    // Retrieve the config node
    this.timeout = parseInt(config.timeout) || 10000;
    this.username = this.credentials.username || "admin";
    this.password = this.credentials.password || "secret";
    this.tls = parseInt(config.tls) || 0;
    this.id = config.id; // Id for node from node-red
    
    this.context = config.context;

    // Retrieve the config node
    this.host = RED.nodes.getNode(config.host);
    debuglog("Tcp/ip host node: " + 
              this.host.name + " " + 
              this.host.host + " " + 
              this.host.port + " " + 
              this.host.timeout + " " +
              this.host.interface );
    this.hostname =  this.host.name;         
    this.host = this.host.host || 'localhost';
    this.port = this.host.port || 9598;
    this.interface = this.host.interface || '';
    this.keepalive = parseInt(this.host.keepalive) || 0;

    this.filter = RED.nodes.getNode(config.filter);
    debuglog("VSCP filter node: " + this.filter.filterGuid);

    // Config node state
    this.connected = false;
    this.connecting = false;
    this.closing = false;
    this.options = {};
    this.queue = [];

    const node = this;

    this.connecting = true;
    this.status({fill:"yellow",shape:"dot",text:"node-red:common.status.connecting..."});
    //debuglog(RED._("vscp.state.disconnected",{broker:(node.clientid?node.clientid+"@":"")+node.name}));
    debuglog('Connecting to VSCP server '  + 
              this.hostname + ' - '  + 
              this.host + ' on port: ' + ":" + 
              this.port);

    this.vscpclient = new vscp_tcp_client();
    debuglog("----- 1 -----");
    this.vscpclient.addEventListener((e) => {
      debuglogmsg("Event:",e);
      var msg = { payload:e }
      this.send(msg);
    });

    this.vscpclient.on('connect', function() {
      debuglog("---------------- CONNECT -------------------");
      this.connected = true;
      this.connecting = false;
      node.status({fill:"yellow",shape:"dot",text:"connecting..."});
    });

    this.vscpclient.on('disconnect', function() {
      debuglog("---------------- DISCONNECT -------------------");
      this.connected = false;
      this.connecting = false;
      node.status({fill:"red",shape:"dot",text:"disconnected"});
    });

    this.vscpclient.on('timeout', function() {
      debuglog("---------------- TIMEOUT -------------------");
      this.connected = false;
      this.connecting = false;
      node.status({fill:"red",shape:"dot",text:"timeout"});
    });

    // Signal that connection is alive when in rcvloop mode
    this.vscpclient.on('alive', function() {
      debuglog("---------------- ALIVE -------------------");      
    });

    this.vscpclient.on('error', function(err) {
      debuglog("---------------- ERROR -------------------");
      node.status({fill:"red",shape:"dot",text:"error"});
      node.error(err, err.message); 
    });

    this.on('close', function() {
      debuglog("---------------- node-red CLOSE -------------------");
      if (removed) {
        // This node has been deleted
      } else {
        // This node is being restarted
      }
      const testAsync = async () => {
        await this.vscpclient.disconnect();
      }
      testAsync().catch(err => {
        debuglog("Catching disconnect error");
        debuglog(err);
      })
    });

    function doConnect(client,options) {

      debuglog(options);

      let response = {};  // Command response object
      const testAsync = async () => {

        // Connect to VSCP server/device
        console.log("Connect");
        response = await client.connect(
        {
          host: options.host,
          port: options.port,
          timeout: options.timeout
        });
        debuglog(response, typeof response);
        if ( 'success' !== response.result ) {
          throw new Error("Failed to connect to VSCP host.");
        }

        // Log on to server (step 1 user name)
        // The response object is returned and logged
        response = await client.sendCommand(
        {
          command: "user",
          argument: options.username
        });
        debuglog(response);

        // Log on to server (step 2 password)
        response = await client.sendCommand(
        {
          command: "pass",
          argument: options.password
        });
        debuglog(response);

        // Send no operation command (does nothing)
        response = await client.sendCommand(
        {
          command: "noop"
        })
        debuglog(response);

        // Get channel id
        let chid = await client.getChannelID();
        debuglog("ChannelID: " + chid);

        // Save channel id in a flow context
        if (options.context.length) {
          flowContext.set(options.context+".chid", chid )
        }


        // Get channel GUID
        let guid = await client.getGUID();
        debuglog("GUID: " + guid);

        // Save channel GUID in a flow context
        if (options.context.length) {
          flowContext.set(options.context+".guid", guid )
        }

        // set FILTER if defined
        if ( null != options.filter ) {
          
          console.log("*********** Setting Filter ***********" + options.filter);
          
          response = await client.setFilter({
            filterPriority: options.filter.filterPriority,
            filterClass: options.filter.filterClass,
            filterType: options.filter.filterType,
            filterGuid: options.filter.filterGuid,
          });
          debuglog(response);

          console.log("*********** Setting Mask ***********" + options.filter.maskGuid);

          response = await client.setMask({
            maskPriority: options.filter.maskPriority,
            maskClass: options.filter.maskClass,
            maskType: options.filter.maskType,
            maskGuid: options.filter.maskGuid,
          });
          debuglog(response);

        }

        response = await client.startRcvLoop();
        debuglog(response);
      
        node.status({fill:"green",shape:"dot",text:"connected"});

        const TimeoutObj = setTimeout(() => {
          console.log('timeout beyond time');
        }, options.timeout);

      }
      testAsync().catch(err => {
        node.error(err.message);
        debuglog(err.message);
        node.status({fill:"red",shape:"dot",text:"error: "+err.message});
      })

    }
    debuglog("----- 3 -----");
    // Try to connect to the remote host
    doConnect( this.vscpclient, 
      {
        host: this.host,
        port: this.port,
        timeout: this.timeout,
        username: this.username,
        password: this.password,
        context: this.context,
        filter: this.filter
      });

  }

  RED.nodes.registerType('vscp-tcp-in', vscpTcpInputNode, {
    credentials: {
      username: {type:"text"},
      password: {type:"password"}
    }
  });

};
