/*
 * Copyright (C) 2014 Scott Beck, all rights reserved
 *
 * Licensed under the MIT license
 *
 */
(function () {
  'use strict';
  var _ = require('lodash'),
    util = require("util");

  Lex.defaultOptions = {
    defaultAction: Lex.defaultAction,
    handleError: Lex.handleError
  };

  function LexError(message, line, column) {
    this.message = message || 'syntax error';
    this.lineNumber = line;
    this.columnNumber = column;
  }
  util.inherits(LexError, Error);
  LexError.prototype.toString = function () {
    return this.message + ' at ' + this.lineNumber + ':' + this.columnNumber;
  };
  Lex.LexError = LexError;
  function Lex(opt) {
    this._opt = {};
    _.merge(this._opt, Lex.defaultOptions, opt || {});
    this.handleError = this._opt.handleError;
    this.defaultAction = this._opt.defaultAction;
    this.state = null;
    this.states = [];
    this.source = null;
    this.index = 0;
    this.tokens = [];
  }

  // context is lexer
  Lex.defaultAction = function (match, namespace, tokens) {
    this.yytext = match[0];
    return tokens;
  };
  Lex.handleError = function (error) {
    throw error;
  };

  Lex.prototype.addRule = function (rule) {
    rule.compose();
    var actions = rule._skip && rule.actions.length === 0 ? [_.noop] : rule.actions,
      state = {
        namespace: rule.namespace,
        name: rule.namespace || rule.tokenNamespace(),
        matcher: rule.matcher,
        tokens: rule.tokens,
        actions: actions
      };
    return this.addState(state);
  };
  Lex.prototype.addState = function (state) {
    if (state.actions.length === 0 && this._opt.defaultRule)
      state.actions.push(this._opt.defaultRule);
    this.states[state.name] = state;
    return this;
  };
  Lex.prototype.setState = function (state) {
    this.state = this.resolveNS(state);
    return this;
  };
  Lex.prototype.resolveNS = function (ns) {
    if (this.states[ns])
      return this.states[ns];
    var curNs = this.currentState.namespace + '.' + ns;
    if (!this.states[curNs])
      return this.handleError(new Error('invalid namespace ' + ns));
    return this.states[curNs];
  };
  Lex.prototype.setSource = function (source) {
    this.index = 0;
    this.source = source;
  };
  Lex.prototype.lex = function () {
    var match, tokens, currentState;
    if (this.tokens.length)
      return this.tokens.shift();
    if (!this.states.length)
      return this.handleError(new Error("no active states. call setState first"));
    this.reject = true;
    while (this.reject && this.states.length > 0) {
      currentState = this.currentState = this.getCurrentState();
      match = currentState.matcher.exec(this.source);
      if (!match) return false;
      this.reject = false;
      currentState = this.resolveNS(match[1]);
      if (!currentState) return false;
      tokens = [];
      _.forEach(currentState.actions, function (action) {
        var res = action.call(this, match[0], match[1], currentState.tokens);
        if (this.reject)
          return false;
        if (_.isArray(res))
          tokens.push.apply(tokens, res);
        else if (_.isString(res))
          tokens.push(res);
      }.bind(this));
      if (!this.reject) {
        this.tokens = tokens;
        return this.tokens.shift();
      }
    }
  };
  Lex.prototype.getCurrentState = function () {
    return _.last(this.states);
  };
  Lex.prototype.getCurrentColumn = function () {
    var lines = this._source.slice(0, this._index).split('\n');
    return _.last(lines).length - 1;
  };
  Lex.prototype.getCurrentLine = function () {
    return this._source.slice(0, this._index).split('\n').length;
  };
  Lex.prototype.parseError = function (message) {
    return new LexError(message, this.getCurrentLine(), this.getCurrentColumn());
  };
  module.exports = Lex;
})();
