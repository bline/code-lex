/*
 * Copyright (C) 2014 Scott Beck, all rights reserved
 *
 * Licensed under the MIT license
 *
 */
/* jshint undef: true, unused: true */
/* global describe:false, it: false, beforeEach: false, expect */
(function () {
  "use strict";
  describe("lex#exports", function () {
    it("should load without throwing errors", function () {
      (function () {
        require("../index.js");
      })
      .should.not.throw();
    });
    it("should export", function () {
      var clex = require("../index.js");
      clex.should.be.a('object');
      clex.retool.should.be.a('object');
      clex.rule.should.be.a('function');
      clex.lexer.should.be.a('function');
    });
    it("should instanciate", function () {
      var clex = require("../index.js");
      var lex = clex.lexer();
      lex.should.be.instanceof(clex.Lex);
      var rule = clex.rule();
      rule.should.be.instanceof(clex.rule);
    });
  });
  describe("rule#interface", function () {
    beforeEach(function () {
      this.clex = require("../index.js");
      this.rule = this.clex.rule;
    });
    describe("options", function () {
      beforeEach(function () {
        this.defAction = function () {};
        this.sep = ":";
        this.optrule = this.rule();
        this.optrule.options({
          defaultAction: this.defAction,
          nsDelimiter: this.sep
        });
      });
      it("should set defaults", function () {
        var rule = this.rule();
        rule._opt.nsDelimiter.should.be.equal(this.rule.defaultOptions.nsDelimiter);
        rule._opt.defaultAction.should.be.equal(this.rule.defaultAction);
        rule.defaultAction.should.be.equal(this.rule.defaultAction);
      });
      it("should set defaultAction", function () {
        this.optrule.defaultAction.should.be.equal(this.defAction);
      });
      it("should set nsDelimiter", function () {
        this.optrule._opt.nsDelimiter.should.be.equal(this.sep);
      });
    });
    describe("compose", function () {
      beforeEach(function () {
        this.simpleRule = this.rule('foo').compose();
        this.ruleWithRule = this.rule('foo', function (rule) {
          this.subRule = rule('bar', /\w+/);
          this.subRule2 = rule('baz', /\s+/);
        }.bind(this)).compose();
      });
      it("should compose single rule", function () {
        var rule = this.simpleRule;
        rule.tokens.should.be.deep.equal(['foo']);
        rule.namespace.should.to.be.equal('foo');
        rule.tokenName.should.be.equal('foo');
        expect(rule._type).to.be.undefined();
        rule.matcher.hasSpecs().should.be.equal(false);
        rule.actions.should.be.deep.equal([]);
      });
      it("should set tokens", function () {
        this.ruleWithRule.tokens.should.be.deep.equal(['foo']);
        this.subRule.tokens.should.be.deep.equal(['bar']);
        this.subRule2.tokens.should.be.deep.equal(['baz']);
      });
      it("should set namespace", function () {
        this.ruleWithRule.namespace.should.be.equal('foo');
        this.subRule.namespace.should.be.equal('foo.bar');
        this.subRule2.namespace.should.be.equal('foo.baz');
      });
      it("should set tokenName", function () {
        this.ruleWithRule.tokenName.should.be.equal('foo');
        this.subRule.tokenName.should.be.equal('bar');
        this.subRule2.tokenName.should.be.equal('baz');
      });
      it("should setup matcher", function () {
        this.ruleWithRule.matcher.hasSpecs().should.be.equal(true);
        this.subRule.matcher.hasSpecs().should.be.equal(true);
        this.ruleWithRule.matcher.asString().should.be.equal('(\\w+)|(\\s+)');
        this.subRule.matcher.asString().should.be.equal('(\\w+)');
        this.subRule2.matcher.asString().should.be.equal('(\\s+)');
      });
      it("should set parent/child relations", function () {
        this.ruleWithRule._root.should.be.equal(this.ruleWithRule);
        this.subRule._root.should.be.equal(this.ruleWithRule);
        this.subRule2._root.should.be.equal(this.ruleWithRule);
        this.subRule._parent.should.be.equal(this.ruleWithRule);
        this.subRule2._parent.should.be.equal(this.ruleWithRule);
        this.ruleWithRule._rules.length.should.be.equal(2);
        this.ruleWithRule._rules[0].should.be.equal(this.subRule);
        this.ruleWithRule._rules[1].should.be.equal(this.subRule2);
        var cnt = 0;
        this.ruleWithRule.forEach(function (ruleForEach) {
          cnt++;
          if (cnt === 1)
            ruleForEach.should.be.equal(this.subRule);
          if (cnt === 2)
            ruleForEach.should.be.equal(this.subRule2);
        }.bind(this));
        cnt.should.be.equal(2);
      });
    });
  });
  describe("lex#interface", function () {
    beforeEach(function () {
      this.clex = require("../index.js");
      this.lex = this.clex.lexer();
    });
    describe("settings", function () {
      it("should set errorHandler", function () {
        var errHandler = function () {};
        this.lex.options({handleError: errHandler});
        this.lex.handleError.should.be.equal(errHandler);
      });
        it("should set source", function () {
        var src = '';
        this.lex.setSource(src);
        this.lex.source.should.be.equal(src);
      });
      it("should add state", function () {
        var state = {name: 'foo'};
        this.lex.addState(state);
        this.lex._states.foo.should.be.equal(state);
      });
      it("should add rule", function () {
        var rule = this.clex.rule('foo', 'bar', /foo/);
        this.lex.setRule(rule);
        this.lex._states.should.be.deep.equal({
          foo: {
            parent: null,
            namespace: 'foo',
            name: 'foo',
            sep: '.',
            next: null,
            matcher: rule.matcher,
            tokens: ['foo', 'bar'],
            actions: [rule.defaultAction]
          }
        });
      });
    });
    describe("lex", function () {
      it("should lex single rule", function () {
        this.lex.setRule(this.clex.rule('foo', /foo/));
        this.lex.setSource('foo').setState('foo');
        this.lex.lex().should.be.equal('foo');
        this.lex.yytext.should.be.equal('foo');
        this.lex.lex().should.be.equal(false);
      });
      it("should lex multiple rules", function () {
        this.lex.setRule(
          this.clex.rule('init', function (rule) {
            rule('foo', /foo/);
            rule('sep', /;/);
            rule('bar', /bar/);
          })
        );
        this.lex.setSource('foo;bar').setState('init');
        this.lex.lex().should.be.equal('init.foo');
        this.lex.yytext.should.be.equal('foo');
        this.lex.lex().should.be.equal('init.sep');
        this.lex.yytext.should.be.equal(';');
        this.lex.lex().should.be.equal('init.bar');
        this.lex.yytext.should.be.equal('bar');
        this.lex.lex().should.be.equal(false);
      });
      it("should allow state change", function () {
        this.lex.setRule(
          this.clex.rule(function (rule) {
            rule('rule1', function (rule) {
              rule('boo', /foo/);
              rule('bar', /bar/).action(
                function () { this.setState('rule2'); },
                this.defaultAction
              );
            });
            rule('rule2', function (rule) {
              this.options({nsDelimiter: ':'});
              rule('foo', /foo/);
              rule('baz', /baz/)
                .action(function () {
                  this.setState('rule1');
                }, this.defaultAction);
            });
          })
        );
        this.lex.setSource('foobarfoobazfoo').setState('rule1');
        this.lex.lex().should.be.equal('rule1.boo');
        this.lex.yytext.should.be.equal('foo');
        this.lex.lex().should.be.equal('rule1.bar');
        this.lex.yytext.should.be.equal('bar');
        this.lex.currentState().namespace.should.be.equal('rule2');
        this.lex.lex().should.be.equal('rule2:foo');
        this.lex.yytext.should.be.equal('foo');
        this.lex.lex().should.be.equal('rule2:baz');
        this.lex.yytext.should.be.equal('baz');
        this.lex.currentState().namespace.should.be.equal('rule1');
        this.lex.lex().should.be.equal('rule1.boo');
        this.lex.yytext.should.be.equal('foo');
        this.lex.lex().should.be.equal(false);
      });
      it("should allow rejection", function () {
        this.lex.setRule(
          this.clex.rule('rule1', function (rule) {
            rule('foo', /foo(o)?/)
              .action(function (yytext, match) {
                if (match[0])
                  this.reject = true;
              }, rule.defaultAction);
            rule('fooo', /fooo/);
          })
        );
        this.lex.setSource('foofooofoo').setState('rule1');
        this.lex.lex().should.be.equal('rule1.foo');
        this.lex.yytext.should.be.equal('foo');
        this.lex.lex().should.be.equal('rule1.fooo');
        this.lex.yytext.should.be.equal('fooo');
        this.lex.lex().should.be.equal('rule1.foo');
        this.lex.yytext.should.be.equal('foo');
        this.lex.lex().should.be.equal(false);
      });
    });
  });
})();
