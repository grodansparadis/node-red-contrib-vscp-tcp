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
// NODE_DEBUG=node-vscp-vscp-tcp*  for all debug events
// NODE_DEBUG=node-vscp-vscp-tcp-out  for debug events from this module
const util = require('util');
const debuglog = util.debuglog('node-vscp-tcp-out');

module.exports = function(RED) {
  'use strict';

  ///////////////////////////////////////////////////////////////////////////
  // vscpTcpOutputNode
  //
  // @param {*} config - configuration

  function vscpTcpOutputNode(config) {

    // Create the tcp/ip output node
    RED.nodes.createNode(this, config);

    const node = this;

    // Send event to configured host
    node.on('input', function(msg, send, done) {
      // If this is pre-1.0, 'send' will be undefined, so fallback to node.send
      send = send || function() { node.send.apply(node,arguments) }
      msg.payload = msg.payload.toLowerCase();
      send(msg);
      done();
      if (err) {
        // Report back the error
        if (done) {
             // Use done if defined (1.0+)
            done(err)
        } else {
            // Fallback to node.error (pre-1.0)
            node.error(err, msg);
        }
      } else {
        msg.payload = result;
        send(msg);
        // Check done exists (1.0+)
        if (done) {
            done();
        }
      }
    });
  }
  this.on('close', function() {
    debuglog("---------------- node-red CLOSE -------------------");
    if (removed) {
      // This node has been deleted
    } else {
      // This node is being restarted
    }
  });
  
  RED.nodes.registerType('vscp-tcp-out', vscpTcpOutputNode, {
    credentials: {
      username: {type:"text"},
      password: {type:"password"}
    }
  });
}