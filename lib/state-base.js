/*
 * Copyright (C) 2014 Scott Beck, all rights reserved
 *
 * Licensed under the MIT license
 *
 */
(function () {
  'use strict';
  var _            = require("lodash"),
      EventEmitter = require("events").EventEmitter,
      util         = require("util");

  function StateBase() {
    this._states = [];
    _.bindAll(this, '_onChildReadyHandler')
    EventEmitter.call(this);
  }
  util.inherits(StateBase, EventEmitter);
  StateBase.state = function (parent, args) {
    var state = new this.prototype.constructor(parent, args);
    state.on('error', parent.on.bind(parent, 'error'));
    parent._states.push(state);
    return state;
  };
  StateBase.prototype.state = function () {
    var Klass = this.prototype.constructor;
    var state =  Klass.state.apply(Klass, this, arguments);
    state.once('ready', this._onReadyHandler.bind(this))
  };
  StateBase.prototype._onChildReadyHandler = function (child) {
    var index = this._states.indexOf(child);
    if (index < 0)
      return this.emit('error', new Error('invalid state'));
    this._states.splice(index, 1);
    if (this._states.length === 0)
      this.emit('ready', this);
  };
  module.exports = StateBase;
})();