///////////////////////////////////////////////////////////////////////////
// vscp-tcp-out
//
// VSCP tcp/ip output node.
//
// This file is part of the VSCP (http://www.vscp.org)
//
// The MIT License (MIT)
//
// Copyright © 2000-2020 Ake Hedman, Grodans Paradis AB
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
// export NODE_DEBUG=node-vscp-tcp-out

const path = require('path');

// const hlp = require(path.join(__dirname, '/lib/dateTimeHelper.js'));
// https://nodejs.org/api/util.html
// export NODE_DEBUG=node-vscp-tcp*     for all de  for debug events from this module
const util = require('util');
const debuglog = util.debuglog('node-red-vscp-tcp-out');
const debuglogmsg = util.debuglog('node-red-vscp-tcp-out-msg');

const vscp_class = require('node-vscp-class');
const vscp_type = require('node-vscp-type');
const vscp = require('node-vscp');
const vscp_tcp_client = require('node-vscp-tcp');

module.exports = function(RED) {

  'use strict';

  ///////////////////////////////////////////////////////////////////////////
  // vscpTcpOutputNode
  //
  // @param {*} config - configuration

  function vscpTcpOutputNode(config) {

    // Create the tcp/ip output node
    RED.nodes.createNode(this, config);

        // Create the tcp/ip input node
        RED.nodes.createNode(this, config);

        var flowContext = this.context().flow;
    
        // Retrieve the config node
        this.username = this.credentials.username || "admin";
        this.password = this.credentials.password || "secret";
        this.tls = parseInt(config.tls) || 0;
        this.nodeid = config.id; // Id for node from node-red
        
        // The channel id is saved in flow context if a key to 
        // save it under is entered. 
        this.keyctx = config.keyctx;
        debuglog("keyctx: ",this.keyctx, typeof this.keyctx);
    
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
        this.chid = 0;
    
        // Config node state
        this.connected = false;
        this.connecting = false;
        this.options = {};
    
        this.connecting = true; 
        this.status({fill:"yellow",shape:"dot",text:"node-red:common.status.connecting..."});
        
        this.log('Connecting to VSCP server '  + 
                  this.hostname + ' - '  + 
                  this.host + ' on port: ' + ":" + 
                  this.port);
    
        this.vscpclient = new vscp_tcp_client();       

        const node = this;

        ///////////////////////////////////////////////////////////////////////////
        // doSendEvent
        //

        var doSendEvent = async (ev) => {
          debuglog(ev,node.keyctx);
          // Get channel id
          if ('string' === typeof node.keyctx ) {
            node.chid = flowContext.get(node.keyctx + ".chid");
            debuglog("Getting keyctx", node.chid, typeof node.chid );
            ev.event.vscpObId = node.chid;
            debuglog("ev.event.vscpObId=",ev.event.vscpObId);
          }
          else {
            ev.event.vscpObId = 0;
            debuglog("ev.event.vscpObId=",ev.event.vscpObId);
          }

          await node.vscpclient.sendEvent(ev);
        }          
        doSendEvent().catch(err => {
          node.error("Error when sending event " + err);
        });

        ///////////////////////////////////////////////////////////////////////////
        // node-red: input 
        // 
        // Send Event
        //
    
        node.on('input', function(msg, send, done) {
          
          var obj = {};
          obj.event = msg.payload;
          doSendEvent(obj);

          if (done) {
            done();
          }

        });
    
        ///////////////////////////////////////////////////////////////////////////
        // callback: connect
        //
    
        node.vscpclient.on('connect', function() {
          debuglog("---------------- CONNECT -------------------");
          node.connected = true;
          node.connecting = false;
          node.status({fill:"yellow",shape:"dot",text:"connecting..."});
        });
    
        ///////////////////////////////////////////////////////////////////////////
        // callback: disconnect
        //
    
        node.vscpclient.on('disconnect', function() {
          debuglog("---------------- DISCONNECT -------------------");
          node.connected = false;
          node.connecting = false;
          node.status({fill:"red",shape:"dot",text:"disconnected"});
        });
    
        ///////////////////////////////////////////////////////////////////////////
        // callback: timeout
        //
    
        node.vscpclient.on('timeout', function() {
          debuglog("---------------- TIMEOUT -------------------");
          node.connected = false;
          node.connecting = false;
          node.status({fill:"red",shape:"dot",text:"timeout"});
        });
    
        ///////////////////////////////////////////////////////////////////////////
        // callback: error
        //
    
        node.vscpclient.on('error', function(err) {
          debuglog("---------------- ERROR -------------------");
          if ('string' === typeof node.keyctx ) {
            flowContext.set(node.keyctx+".error", err );
          }
          node.status({fill:"red",shape:"dot",text:"error "+err.message});
          node.error(err, err.message); 
        });
    
        ///////////////////////////////////////////////////////////////////////////
        // node-red: close
        //
    
        this.on('close', function(removed, done) {
          
          debuglog("---------------- node-red CLOSE -------------------");
          
          if (removed) {
            // This node has been deleted
          } else {
            // This node is being restarted
          }

          const closeAsync = async () => {
            await node.vscpclient.disconnect();
          }
          closeAsync().catch(err => {
            debuglog("Catching disconnect error");
            debuglog(err);
            node.error(err, err.message);
          })

          this.status({fill:"red",shape:"dot",text:"node-red:common.status.closed"});
          if (done) {
            done();
          }

        });
    
        ///////////////////////////////////////////////////////////////////////////
        // doConnect
        //
    
        function doConnect(client,options) {
    
          debuglog("Options :",options);

          node.connecting = true;
    
          let response = {};  // Command response object
          const doAsync = async () => {
    
            // Connect to VSCP server/device
            debuglog("Connect", options);
            response = await client.connect(
            {
              host: options.host,
              port: options.port,
              timeout: options.timeout
            });
            debuglog("connect response: "+response.result);
            if ( 'success' !== response.result ) {
              throw new Error("Failed to connect to VSCP host.");
            }
    
            debuglog("User login: ");

            // Log on to server (step 1 user name)
            // The response object is returned and logged
            response = await client.sendCommand(
            {
              command: "user",
              argument: options.username
            });
            debuglog("user response: "+response.result);
    
            // Log on to server (step 2 password)
            response = await client.sendCommand(
            {
              command: "pass",
              argument: options.password
            });
            debuglog("pass response: "+response.result);
    
            // Send no operation command (does nothing)
            response = await client.sendCommand(
            {
              command: "noop"
            })
            debuglog("noop response: "+response.result);
    
            node.status({fill:"green",shape:"dot",text:"connected"});
            node.connected = true;
            
          }
          doAsync().catch(err => {
            node.error(err.message);
            debuglog(err.message);
            node.status({fill:"red",shape:"dot",text:"Connection error: "+err.message});
          })
    
        }

        function conn() {
          // Try to connect to the remote host
          doConnect(node.vscpclient,  
          {
            host: node.host,
            port: node.port,
            timeout: node.timeout,
            username: node.username,
            password: node.password,
            keyctx: node.keyctx,
            filter: node.filter
          });
        };
    
        conn();
    
        var timeoutHandle =  setInterval( () => {
          if ( !node.connected ) {
            console.log("Reconnecting!");
            conn();
          }
        }, node.keepalive || 5000 );
            
  }
  RED.nodes.registerType('vscp-tcp-out', vscpTcpOutputNode, {
    credentials: {
      username: {type:"text"},
      password: {type:"password"}
    }
  });

}