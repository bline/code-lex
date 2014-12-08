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

  describe("lex#interface", function () {
    beforeEach(function () {
      this.clex = require("../index.js");
      this.lex = this.clex.lexer();
    });
    describe("settings", function () {
      it("should set options from constructor", function () {
        var lex = new this.clex.Lex({nsDelimiter: '/'});
        lex.options().nsDelimiter.should.be.equal('/');
        var errHandler = function () {};
        lex = new this.clex.Lex({handleError: errHandler});
        lex.handleError.should.be.equal(errHandler);
      });
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
      it("should throw on bad state", function () {
        var rule = this.clex.rule('foo', 'bar', /foo/);
        this.lex.setRule(rule);
        expect(function () {this.lex.setState('bar');}.bind(this))
          .to.throw();
        expect(function () {this.lex.pushState('bar');}.bind(this))
          .to.throw();
        expect(this.lex.currentState()).to.be.null();
        expect(this.lex.popState()).to.be.null();
        expect(this.lex.resolveNS('bar')).to.be.null();
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
      it("should reject on bad matcher namespace", function () {
        var rule;
        this.lex.setRule(rule = this.clex.rule('foo', /foo/));
        this.lex.setState('foo').setSource('foo');
        rule.matcher.exec = function () { return ["match", "bar.namespace"]; };
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
      it("should allow string token as action return", function () {
        this.lex.setRule(
          this.clex.rule('foo', /foo/).action(function () {
            return 'foo';
          })
        );
        this.lex.setSource('foo').setState('foo');
        this.lex.lex().should.be.equal('foo');
        this.lex.lex().should.be.equal(false);
      });
      it("should allow namespace disable", function () {
        this.lex.setRule(
          this.clex.rule('root', function (rule) {
            rule('foo', /foo/).action(function () {
              return ['foo', 'bar'];
            });
          })
        );
        this.lex.options({disableNS: true});
        this.lex.setSource('foo').setState('root.foo');
        this.lex.lex().should.be.equal('foo');
        this.lex.lex().should.be.equal('bar');
        this.lex.lex().should.be.equal(false);
      });
      it("should allow multiple array of tokens from action", function () {
        this.lex.setRule(
          this.clex.rule('root', function (rule) {
            rule('foo', /foo/).action(function () {
              return ['foo', 'bar', 'baz'];
            });
          })
        );
        this.lex.setSource("foo").setState("root");
        this.lex.lex().should.be.equal('root.foo');
        this.lex.lex().should.be.equal('root.foo.bar');
        this.lex.lex().should.be.equal('root.foo.baz');
        this.lex.lex().should.be.equal(false);
      });
      it("should go to next match with no tokens", function () {
        this.lex.setRule(this.clex.rule(function (rule) {
          rule('foo', /foo/).action(function () {
            return [];
          });
          rule('bar', /bar/);
        }));
        this.lex.setSource('foobar');
        this.lex.lex().should.be.equal('bar');
        this.lex.lex().should.be.equal(false);
      });
      it("should go to next match with no tokens and zero width match", function () {
        this.lex.setRule(this.clex.rule(function (rule) {
          rule('startWithSpace', /^\s*/).action(function () {
            return [];
          });
          rule('foo', /foo/);
        }));
        this.lex.setState('.').setSource('foo');
        this.lex.lex().should.be.equal('foo');
        this.lex.lex().should.be.equal(false);
        this.lex.setState('.').setSource(' foo');
        this.lex.lex().should.be.equal('foo');
        this.lex.lex().should.be.equal(false);
      });
      it("should allow state set", function () {
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
      it("should allow state push/pop", function () {
        var rule;
        this.lex.setRule(
          rule = this.clex.rule('root', function (rule) {
            rule('rule1', function (rule) {
              rule('boo', /foo/);
              rule('bar', /bar/).action(
                function () { this.pushState('root.rule2'); },
                this.defaultAction);
            }).exclusive(true);
            rule('rule2', function (rule) {
              this.options({nsDelimiter: ':'});
              rule('foo', /foo/);
              rule('baz', /baz/)
                .action(function () {
                  expect(this.popState()).to.be.equal('root.rule2');
                }, this.defaultAction);
            }).exclusive(true);
          })
        );
        this.lex.setSource('foobarfoobazfoo').setState('root.rule1');
        this.lex.lex().should.be.equal('root.rule1.boo');
        this.lex.yytext.should.be.equal('foo');
        this.lex.lex().should.be.equal('root.rule1.bar');
        this.lex.yytext.should.be.equal('bar');
        this.lex.currentState().namespace.should.be.equal('root.rule2');
        this.lex.lex().should.be.equal('root.rule2:foo');
        this.lex.yytext.should.be.equal('foo');
        this.lex.lex().should.be.equal('root.rule2:baz');
        this.lex.yytext.should.be.equal('baz');
        this.lex.currentState().namespace.should.be.equal('root.rule1');
        this.lex.lex().should.be.equal('root.rule1.boo');
        this.lex.yytext.should.be.equal('foo');
        this.lex.lex().should.be.equal(false);
      });
      it("should resolve sibling namespaces", function () {
        this.lex.setRule(
          this.clex.rule('root', function (rule) {
            rule('sib1', function () {
              rule('foo', /foo/);
              rule('bar', /bar/);
            });
            rule('sib2', /start/).action(
              function () {
                expect(function () {this.pushState('sib1');}.bind(this))
                  .not.to.throw();
              }, this.defaultAction);
          })
        );
        this.lex.setSource('startfoobar').setState('root.sib2');
        this.lex.lex().should.be.equal('root.sib2');
        this.lex.lex().should.be.equal('root.sib1.foo');
        this.lex.lex().should.be.equal('root.sib1.bar');
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
      it("should set line/column correctly", function () {
        this.lex.setRule(this.clex.rule('rule', /rule\n?/));
        this.lex.setSource("rule\nrule\nrule");
        this.lex.setState('rule');
        this.lex.lex().should.be.equal('rule');
        this.lex.yytext.should.be.equal("rule\n");
        this.lex.getCurrentColumn().should.be.equal(0);
        this.lex.getCurrentLine().should.be.equal(2);
        this.lex.lex().should.be.equal('rule');
        this.lex.yytext.should.be.equal('rule\n');
        this.lex.getCurrentColumn().should.be.equal(0);
        this.lex.getCurrentLine().should.be.equal(3);
        this.lex.lex().should.be.equal('rule');
        this.lex.yytext.should.be.equal('rule');
        this.lex.getCurrentColumn().should.be.equal(4);
        this.lex.getCurrentLine().should.be.equal(3);
      });
      it("should construct proper Error object", function () {
        this.lex.setRule(this.clex.rule('rule', /rule\n?/));
        this.lex.setSource("rule\nrule\nrule");
        this.lex.setState('rule');
        this.lex.lex().should.be.equal('rule');
        this.lex.lex().should.be.equal('rule');
        this.lex.lex().should.be.equal('rule');
        var error = this.lex.newError();
        error.message.should.be.equal('syntax error');
        error = this.lex.newError('test');
        error.message.should.be.equal('test');
        error.lineNumber.should.be.equal(3);
        error.columnNumber.should.be.equal(4);
        expect(error + "").to.be.equal('test at 3:4');

      });
    });
  });
})();