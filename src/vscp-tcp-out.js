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

const path = require('path');

// const hlp = require(path.join(__dirname, '/lib/dateTimeHelper.js'));
const util = require('util');

module.exports = function(RED) {
  'use strict';

  ///////////////////////////////////////////////////////////////////////////
  // vscpTcpOutputNode
  //
  // @param {*} config - configuration

  function vscpTcpOutputNode(config) {

    // Create the tcp/ip output node
    RED.nodes.createNode(this, config);

    // Retrieve the config node
    this.positionConfig = RED.nodes.getNode(config.positionConfig);
    this.topic = config.topic || '';
    this.rules = config.rules || [];
    this.azimuthPos = {};
    this.start = config.start;
    this.startType = config.startType || 'none';
    this.startOffset = config.startOffset || 0;
    this.startOffsetType = config.startOffsetType || 'none';
    this.startOffsetMultiplier = config.startOffsetMultiplier || 60;
    this.end = config.end;
    this.endType = config.endType || 'none';
    this.endOffset = config.endOffset || 0;
    this.endOffsetType = config.endOffsetType || 'none';
    this.endOffsetMultiplier = config.endOffsetMultiplier || 60;

    const node = this;

    // Send event to configured host
    node.on('input', function(msg) {
      msg.payload = msg.payload.toLowerCase();
      node.send(msg);
    });
  }
  RED.nodes.registerType('vscp-tcp-out', vscpTcpOutputNode, {
    credentials: {
      username: {type:"text"},
      password: {type:"password"}
    }
  });
}