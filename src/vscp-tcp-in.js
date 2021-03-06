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

    const node = this;

    var flowContext = this.context().flow;

    // Retrieve the config node
    this.username = this.credentials.username || "admin";
    this.password = this.credentials.password || "secret";
    this.tls = parseInt(config.tls) || 0;

    // The channel id is saved in flow context if a key to 
    // save it under is entered. 
    this.keyctx = config.keyctx;
    debuglog("keyctx: ",this.keyctx, typeof this.keyctx);

    this.nodeid = config.id; // Id for node from node-red
    if ('string' === typeof node.keyctx ) {
      flowContext.set(node.keyctx+".nodeid", this.nodeid );
    }

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
    this.timeout = this.host.timeout || 10000;
    this.interface = this.host.interface || '';
    this.keepalive = parseInt(this.host.keepalive) || 0;

    this.filter = RED.nodes.getNode(config.filter);
    if ( null == this.filter ) {
      // Set a null filter that let everything through
      this.filter = {
        filterPriority: 0,
        maskPriority: 0,
        filterClass: 0,
        maskClass: 0,
        filterType: 0,
        maskType: 0,
        filterGuid: '00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00',
        maskGuid: '00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00'
      };
    }
    debuglog("VSCP filter node: " + this.filter.filterGuid);

    // Config node state
    /* this.connTimeout = 0; */   // Timeout handle
    this.connKeepAlive = 0;       // Keepalive handle
    this.connected = false;
    this.connecting = false;
    this.closing = false;
    this.options = {};
    this.queue = [];

    this.connecting = true;
    this.status({fill:"yellow",shape:"dot",text:"node-red:common.status.connecting..."});
    
    node.log('Connecting to VSCP server '  + 
              this.hostname + ' - '  + 
              this.host + ' on port: ' + ":" + 
              this.port);

    this.vscpclient = new vscp_tcp_client();
    
    ///////////////////////////////////////////////////////////////////////////
    // callback: addEventListener
    //

    this.vscpclient.addEventListener( (strEvent) => {
      var msg = {};
      var ev = new vscp.Event(strEvent);
      debuglogmsg("---------------- EVENT -------------------");
      debuglogmsg("Event:",ev.toJSONObj());
      msg.payload = ev.toJSONObj();
      this.send(msg);
    });

    ///////////////////////////////////////////////////////////////////////////
    // callback: connect
    //

    this.vscpclient.on('connect', function() {
      debuglog("---------------- CONNECT -------------------");
      node.connected = true;
      node.connecting = false;
      node.status({fill:"yellow",shape:"dot",text:"connecting..."});
      /* clearTimeout(node.connTimeout); */
    });

    ///////////////////////////////////////////////////////////////////////////
    // callback: disconnect
    //

    this.vscpclient.on('disconnect', function() {
      debuglog("---------------- DISCONNECT -------------------");
      node.connected = false;
      node.connecting = false;
      node.status({fill:"red",shape:"dot",text:"disconnected"});
    });

    ///////////////////////////////////////////////////////////////////////////
    // callback: timeout
    //

    this.vscpclient.on('timeout', function() {
      debuglog("---------------- TIMEOUT -------------------");
      node.connected = false;
      node.connecting = false;
      node.status({fill:"red",shape:"dot",text:"timeout"});
    });

    ///////////////////////////////////////////////////////////////////////////
    // alive
    //

    // Signal that connection is alive when in rcvloop mode
    this.vscpclient.on('alive', function() {
      debuglogmsg("---------------- ALIVE -------------------"); 
      if ('string' === typeof node.keyctx ) {
        flowContext.set(node.keyctx+".alive", new Date() );
      }
    });

    ///////////////////////////////////////////////////////////////////////////
    // callback: error
    //

    this.vscpclient.on('error', function(err) {
      debuglog("---------------- ERROR -------------------");
      node.status({fill:"red",shape:"dot",text:"error "+err.message});
      node.error(err, err.message); 
    });

    ///////////////////////////////////////////////////////////////////////////
    // callback: close
    //

    this.on('close', function(removed, done) {
      
      debuglog("---------------- node-red CLOSE -------------------");
      
      this.vscpclient.disconnect({
        "onSuccess": function() {
          debuglog("Disconnected ----------------->");
          node.log('Disconnect from VSCP server');
          done();
        }
      });

      // No reconnects during close down
      clearInterval(timeoutHandle);

      node.status({fill:"red",shape:"dot",text:"Connection error: "+err.message});

      if (removed) {
        // This node has been deleted
        debuglog("Node deleted");
      } else {
        // This node is being restarted
        debuglog("Node restarted");
      }

      // const closeAsync = async () => {
      //   await this.vscpclient.disconnect();
      //   node.log('Disconnect from VSCP server');
      // }
      // closeAsync().catch(err => {
      //   debuglog("Catching disconnect error");
      //   debuglog(err);
      //   node.error("Catch on close",err, err.message);
      // })

      // done();

    });

    ///////////////////////////////////////////////////////////////////////////
    // doConnect
    //

    function doConnect(client,options) {

      debuglog(options);

      let response = {};  // Command response object

      const testAsync = async () => {

        // Connect to VSCP server/device
        debuglog("Calling Connect");
        response = await client.connect(
        {
          host: options.host,
          port: options.port,
          timeout: options.timeout
        });
        debuglog("response: "+response);
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
        debuglog("user: response: "+response);

        // Log on to server (step 2 password)
        response = await client.sendCommand(
        {
          command: "pass",
          argument: options.password
        });
        debuglog("pass: response: "+response);

        // Send no operation command (does nothing)
        response = await client.sendCommand(
        {
          command: "noop"
        })
        debuglog("noop: response: "+response);

        // Get channel id
        let chid = await client.getChannelID();
        debuglog("ChannelID: " + chid, options.keyctx);

        // Get channel GUID
        let guid = await client.getGUID();
        debuglog("Channel GUID: " + guid);

        // Save channel id in a flow context
        if ('string' === typeof options.keyctx ) {
          debuglog("Setting keyctx", chid, typeof chid );
          flowContext.set(options.keyctx + ".chid", chid );
          flowContext.set(options.keyctx + ".start", new Date() );
          flowContext.set(options.keyctx + ".guid", guid );
        }

        // set FILTER if defined
        if ( null != options.filter ) {
          
          debuglog("*********** Setting Filter ***********" );
          debuglog(options.filter.filterPriority + " " +
                   options.filter.filterClass + " " +
                   options.filter.filterType + " " +
                   options.filter.filterGuid);

          response = await client.setFilter({
            filterPriority: options.filter.filterPriority,
            filterClass: options.filter.filterClass,
            filterType: options.filter.filterType,
            filterGuid: options.filter.filterGuid,
          });
          debuglog("Filter: Response: "+response);

          debuglog("*********** Setting Mask ***********" );
          debuglog(options.filter.maskPriority + " " +
                   options.filter.maskClass + " " + 
                   options.filter.maskType + " " +
                   options.filter.maskGuid );

          response = await client.setMask({
            maskPriority: options.filter.maskPriority,
            maskClass: options.filter.maskClass,
            maskType: options.filter.maskType,
            maskGuid: options.filter.maskGuid,
          });
          debuglog("Mask: response: " + response);

        }

        response = await client.startRcvLoop();
        debuglog("rcvloop: response: " + response);
      
        node.status({fill:"green",shape:"dot",text:"connected"});
        
      }
      testAsync().catch(err => {
        node.connecting = false;
        node.connected = false;
        node.error(err.message);
        debuglog("doConnect catch error : " + err.message);
        node.status({fill:"red",shape:"dot",text:"Connection error: "+err.message});
      })

    }

    function conn() {

      node.connected = false;
      node.connecting = true;  

      // Try to connect to the remote host
      doConnect( node.vscpclient, 
      {
        host: node.host,
        port: node.port,
        timeout: node.timeout,
        username: node.username,
        password: node.password,
        keyctx: node.keyctx,
        filter: node.filter
      });
    }

    conn();

    var timeoutHandle =  setInterval( () => {
      
      debuglog("Link timeout: connected=" + 
        node.connected + 
        " connecting=" + 
        node.connecting +
        " keepalive=" +
        node.keepalive );

      if ( !node.connected && !node.connecting ) {
        node.log("Reconnecting!");
        node.status({fill:"black",shape:"dot",text:"Reconnecting "});
        conn();
      }
    }, node.keepalive || 5000 );
    
  }
  RED.nodes.registerType('vscp-tcp-in', vscpTcpInputNode, {
    credentials: {
      username: {type:"text"},
      password: {type:"password"}
    }
  });

};
