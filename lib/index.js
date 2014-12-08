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

  /**
   * Construct a new `LexError` object with message,
   * line and column number. The `line` and `column`
   * are set automatically for you if you call
   * {@link Lex#newLexError}
   * @constructor
   * @static
   * @memberOf Lex
   * @see {@link Lex#newError}
   * @param {String} [message=syntax error] - error message
   * @param {Number} line - line number the error occured
   * @param {Number} column - the column number for the error
   */
  function LexError(message, line, column) {
    this.message = message || 'syntax error';
    this.lineNumber = line;
    this.columnNumber = column;
  }
  util.inherits(LexError, Error);
  LexError.prototype.toString = function () {
    return this.message + ' at ' + this.lineNumber + ':' + this.columnNumber;
  };
  /**
   * Construct a new Lex object with the given options.
   * @class
   * @alias Lex
   * @param {Lex~Options} [opt=Lex.defaultOptions] - Lexer options
   */
  function Lex(opt) {
    this._opt = {};
    _.merge(this._opt, Lex.defaultOptions);
    /**
     * @private
     * @type {Object<String, Lex~State>}
     */
    this._states      = {};
    /**
     * @private
     * @type {Lex~State[]}
     */
    this._stateStack  = [];
    /**
     * @private
     * @type {(Lex~State|null)}
     */
    this._rejectState = null;
    /**
     * The current source we are lexing. Set with {@link Lex#setSource}.
     * @type {(String|null)}
     */
    this.source       = null;
    /**
     * The current index into `source` were lexing left off.
     * @type {Number}
     */
    this.index        = 0;
    /**
     * Current collected tokens, collected and returned one at a time.
     * @type {String[]}
     */
    this.tokens       = [];
    this._setOptions(this._opt);
    if (opt)
      this._setOptions(opt);
  }
  Lex.LexError = LexError;

  /**
   * Default error handler. Can be set in options or overriden here for all.
   */
  Lex.handleError = function (error) {
    throw error;
  };

  /**
   * Default Lex options. Change these to change for all future
   * instanciations.
   *
   * @type {Lex~Options}
   * @static
   */
  Lex.defaultOptions = {
    handleError: Lex.handleError,
    disableNS: false
  };

  /**
   * Internal method used to set options
   * @private
   * @param {Lex~Options}
   */
  Lex.prototype._setOptions = function (opt) {
    _.merge(this._opt, opt || {});
    this.handleError = this._opt.handleError;
  };
  /**
   * Set/retrieve the current options.
   * @param {Lex~Options} [opt] - merged with current options if present
   * @returns {Lex~Options} - current options object.
   */
  Lex.prototype.options = function (opt) {
    if (opt)
      this._setOptions(opt);
    return this._opt;
  };

  /**
   * Main entry point. Add your root {@link Rule} using this method.
   * @param {Rule} rule - sets the rule for this lexer.
   * @returns {Lex}
   */
  Lex.prototype.setRule = function (rule) {
    rule.compose();
    this._addRule(rule);
    return this;
  };
  /**
   * Internal method which recursiving adds rule.
   * @private
   * @param {Rule} rule
   */
  Lex.prototype._addRule = function (rule) {
    this.addState({
      parent: rule.resolveParentNS() || null,
      next: rule.next,
      name: rule.namespace || rule.tokenNamespace() || '.',
      namespace: rule.resolveNS(),
      matcher: rule.matcher,
      sep: rule.getOption('nsDelimiter'),
      tokens: rule.tokens,
      actions: rule.actions
    });
    rule.forEach(this._addRule.bind(this));
  };
  /**
   * Low level method to add a state.
   * @param {Lex~State}
   * @returns {Lex}
   */
  Lex.prototype.addState = function (state) {
    this._states[state.name] = state;
    return this;
  };
  /**
   * Set the current state.
   * @param {String} namespace
   * @returns {Lex}
   */
  Lex.prototype.setState = function (state) {
    this._stateStack = [this.resolveSiblingNS(state)];
    return this;
  };
  /**
   * Push namespace onto the current state stack
   * @param {String} namespace
   * @returns {Lex}
   */
  Lex.prototype.pushState = function (state) {
    this._stateStack.push(this.resolveSiblingNS(state));
    return this;
  };
  /**
   * Retrieve the current {@link Lex~State} object or null if no current state is set.
   * @returns {Lex~State}
   */
  Lex.prototype.currentState = function () {
    if (!this._stateStack.length)
      return null;
    return _.last(this._stateStack);
  };
  /**
   * Pop the {@link Lex~State} stack.
   * @returns {String} namespace - namespace of the state `pop()`ed
   */
  Lex.prototype.popState = function () {
    if (!this._stateStack.length)
      return null;
    return this._stateStack.pop().namespace;
  };
  /**
   * resolves a namespace to a {@link Lex~State} object. Assumes it could possible be a child of the current state and tries to do a relative resolution first.
   * @param {String} namespace - the namespace to resolve
   * @returns {(Lex~State|null)} the {@link Lex~State} represented by namespace.
   */
  Lex.prototype.resolveNS = function (ns) {
    if (this.curState) {
      var curNs = this.curState.namespace + this.curState.sep + ns;
      if (this._states[curNs])
        return this._states[curNs];
    }
    if (this._states[ns])
      return this._states[ns];
    return null;
  };
  /**
   * resolves a namespace to a {@link Lex~State} object. Assumes it could possibly be a sibling of the current state and tries to do a relative resoltion first.
   * @param {String} namespace - the namespace to resolve
   * @returns {(Lex~State|null)} The {@link Lex~State} respresented by namespace or null if namespace could not be resolved.
   */
  Lex.prototype.resolveSiblingNS = function (ns) {
    if (this.curState && this.curState.parent && this.curState.parent.namespace) {
      var curNs = this.curState.parent.namespace + this.curState.sep + ns;
      if (this._states[curNs])
        return this._states[curNs];
    }
    if (this._states[ns])
      return this._states[ns];
    return null;
  };
  /**
   * Sets the source to lex, clears previous index
   * @param {String} source - source to lex
   * @returns {Lex}
   */
  Lex.prototype.setSource = function (source) {
    this.index = 0;
    this.source = source;
    return this;
  };
  /**
   * Main entry point for lexing. Performs one iteraction, call until false to lex entire source.
   * @returns {String} Last token returned by last match.
   */
  Lex.prototype.lex = function () {
    var tokens;
    if (this.tokens.length)
      return this.tokens.shift();
    if (!this._stateStack.length)
      this._stateStack.push('.');
    this.scanning = true;
    while (this.scanning && this._stateStack.length > 0) {
      tokens = this._scan();
      if (!this.reject) {
        this.tokens = tokens;
        return this.tokens.shift();
      }
    }
    return false;
  };
  /**
   * Internal method called by {@link Lex#lex}.
   * @returns {String[]} Tokens from last match.
   * @private
   */
  Lex.prototype._scan = function () {
    var tokens = [];
    var rejectState = this._rejectState;
    this._rejectState = null;
    this.curState = rejectState || this.currentState();
    this.curState.matcher.setLastIndex(this.index);
    this.reject = false;

    var match = this.curState.matcher.exec(this.source);
    if (match) {
      /* While going through reject states, individual child
       * regular expressions do not have a full namespace.
      */
      if (rejectState && rejectState.parent)
        match[1] = rejectState.parent + rejectState.sep + match[1];
    } else {
      this.reject = true;
      this.scanning = this._nextRejectState();
      return tokens;
    }
    this.curState = this.resolveNS(match[1]);
    if (!this.curState) {
      this.scanning = false;
      this.reject = true;
      return tokens;
    }

    tokens = this._runStateActions(match);

    if (!this.reject) {
      this.index = _.last(match);

      if (tokens.length === 0) {
        /* No tokens to return. */
        this.reject = true;
        /* If the match is non-zero width, resetting this.index
         * is enough to continue to the next state.
         */
        if (match[0][0].length === 0) {
          /* Zero width matches must go a different (less optimized) route. */
          this.scanning = this._nextRejectState();
        }
      }
    } else {
      this.scanning = this._nextRejectState();
    }

    return this._resolveTokens(tokens, this.curState);
  };
  /**
   * Retrieve the current column position
   * @returns {Number} - column position in `source`
   */
  Lex.prototype.getCurrentColumn = function () {
    var lines = this.source.slice(0, this.index).split('\n');
    return _.last(lines).length - 1;
  };
  /**
   * Retrieve the current line number.
   * @returns {Number} - current line number in `source`
   */
  Lex.prototype.getCurrentLine = function () {
    return this.source.slice(0, this.index).split('\n').length;
  };
  /**
   * Constructs a new {@link Lex.LexError} object with the given message. Current line number and column numbers are set for you.
   * @param {String} message - the error message
   * @returns {@link Lex.LexError}
   */
  Lex.prototype.newError = function (message) {
    return new LexError(message, this.getCurrentLine(), this.getCurrentColumn());
  };
  /**
   * Internal helper method to jump to next state when in reject processing mode.
   * @private
   * @returns {Boolean} True is there is a next state to check, false otherewise.
   */
  Lex.prototype._nextRejectState = function () {
    if (this.curState.next) {
      this._rejectState = this.resolveSiblingNS(this.curState.next);
      return !!this._rejectState;
    }
    return false;
  };
  /**
   * Executes current state actions given match.
   * @returns {String[]} tokens collected from current state actions.
   * @private
   */
  Lex.prototype._runStateActions = function (match) {
    var tokens = [];
    _.forEach(this.curState.actions, function (action) {
      var res = action.call(this, match[0][0], match[0].slice(1), match[1], this.curState.tokens);
      if (this.reject)
        return false;
      if (_.isArray(res))
        tokens.push.apply(tokens, res);
      else if (_.isString(res))
        tokens.push(res);
    }.bind(this));
    return tokens;
  };
  /**
   * Resolves tokens to their namespace unless {@link Lex~Options.disableNS} is set, in which case tokens are returned un-prefixed.
   * @private
   * @param {String[]} tokens - array of tokens to prefix
   * @param {Lex~State} state - the state we are prefixing tokens for.
   * @return {String[]} tokens
   */
  Lex.prototype._resolveTokens = function (tokens, state) {
    if (this._opt.disableNS || !state.namespace)
      return tokens;
    return tokens.map(function (token, i) {
      if (i === 0) return state.namespace;
      return [state.namespace, token].join(state.sep);
    });
  };
  /**
   * Callback used during lexing to return tokens and/or push/pop/set state.
   *
   * @callback Lex~ActionCallback
   * @param {String} yytext - The full text which matched.
   * @param {String[]} match - Any `()` matches or empty Array if no matches.
   * @param {String} namespace - The namespace for this match.
   * @param {String[]} tokens - Any tokens there were setup for this State.
   * @returns {(String|String[]|*)} Any return value which is an Array or String
   * will be taken as tokens to be returned. Any other return is ignored.
   * @example
   *  rule('myRule').action(function (yytext, match, namespace, tokens) {
   *    this.yytext = yytext;
   *    return tokens;
   *  });
   */
  /**
   * @typedef {Object} Lex~State
   * @property {String} parent        - parent namespace
   * @property {String} next          - the next siblings namespace
   * @property {String} namespace     - the namespace of this state
   * @property {ReMix}  matcher       - the {@link ReMix} object for matching
   *    this state.
   * @property {String} sep           - namespace delimiter for this state
   * @property {Array}  tokens        - tokens returned by this state
   * @property {Lex~ActionCallback[]} actions - array of action callbacks to be
   * called on a match.
   */
  /**
   * @callback Lex~ErrorCallback
   * @param {(Error|Lex.LexError)} error - error object to handle
   * @example
   *  var lex = new Lex({
   *    handleError: function (error) {
   *      throw error;
   *    }
   *  });
   */
  /**
   * @typedef {Object} Lex~Options
   * @property {Lex~ErrorCallback} handleError={@link Lex.handleError} - Sets the callback for
   * handling errors. Defaults to throwing an error.
   * @property {Boolean} disableNS=false - disable namespaces in match returns. This
   * flattens everything into it's singlular unnamespaced name.
   */
  module.exports = Lex;
})();
