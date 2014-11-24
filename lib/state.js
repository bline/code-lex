/*
 * Copyright (C) 2014 Scott Beck, all rights reserved
 *
 * Licensed under the MIT license
 *
 */
(function () {
  'use strict';
  var _ = require("lodash"),
    util = require("util"),
    StateBase = require("./state-base"),
    Match = require("./match");


  function State(parent, args) {
    StateBase.call(this);
    this.parent = parent;
    this._callbacks = _.filter(args, _.isFunction);
    this._matches = _.filter(args, _.isRegExp);
    this._tags = _.filter(args, _.isString);
    this._applyTo = _.flatten(_.find(args, _.isArray));
    this._stateReadyCount = 0;
    this._states = [];
    if ((!this._tags.length || !this._matches.length) && !this._callbacks.length)
      return this.emit('error', new Error("either a callback or a name/match must be specified to state()"));

    _.forEach(this._callbacks, function (callback) {
      callback.call(null, this);
    });
    this.tokenName = this._tags[0];

    process.nextTick(this.composeRules.bind(this));
  }
  util.inherits(StateBase, State);

  State.prototype.getMatchInfo = function () {
    if (this._getMatchCache)
      return this._getMatchCache;

    var matches = [], matchCounts = [];
    if (!this.tokenName || !this._matches.length)
      return this.emit('error', new Error('no name or matches set'));

    this.namespace = this.tokenName;
    this._states.forEach(function (state) {
      state.namespace = this.tokenName + '.' + state.tokenName;
      var reStr = state.matchesToSource(), parenCnt = 0;
      reStr.replace(/(?:\\(?:\\\\)*\()|(\((?!\?))/g, function(match, leftParen) {
        if (leftParen) parenCnt++;
      }.bind(this));
      matches.push(reStr);
      matchCounts.push(parenCnt);
    }.bind(this));
    var reStr = '^(?:' + matches.join('|') + ')';
    this._getMatchCache = { regex: new RegExp(reStr), counts: matchCounts };
    return this._getMatchCache;
  };
  State.prototype.getMatches = function (source, collector) {
    var re = this._cachedMatch ? this._cachedMatch : (this._cachedMatch = this._getMatch());
    var matchCounts = this.matchCounts, states = this._states;
    return source.replace(re, function () {
      var args = _.toArray(arguments);
      var fullMatch = args.shift();
      states.forEach(function (state, i) {
        var cnt = matchCounts[i];
        collector.push(state.exec(fullMatch, args.splice(0, cnt)));
      });
      return '';
    });
  };
  State.prototype.exec = function (match, matches) {

  };
  State.prototype.matchesToSource = function () {
    return this._matches.map(function (match) {
      return '(' + Match.toSource(match) + ')';
    }).join('|');
  };
  State.prototype.only = function () {
    if (arguments.length)
      this._applyTo = this._applyTo.concat(_.toArray(arguments));
    return this._applyTo;
  };
  State.prototype.join = function (bool) {
    this._join = bool === false ? false : bool === true ? true : this._join;
    return this._sticky;
  };
  State.prototype.hasTag = function (tag) {
    return this._tags.indexOf(tag) !== -1;
  };
  module.exports = State;
})();