code-lex
===

stylish stateful delightful code lexer


Still work in progress.


```javascript

/* nearly complete JS lexer implementation */
clex = require('code-lex');

var Lex = clex.Lex;
var lexer = new Lex({ nsDelimiter: '.' }); // default
var rule = clex.rule;
var retool = clex.retool;
rule.registerMatch('jsSingleline', /\/\/[^\r\n\f]*(?:\r\n?|\n|\f|$)/);
rule.registerMatch('jsMultiline', 'cMultiComment');

var jsRule = rule('js', function (rule) {
  rule.options({ nsDelimiter: '.' }); // default
  rule('main', function () {
    rule('jsMultiline');
    rule('jsSingleline');
    rule('jsSingleQ');
    rule('jsDoubleQ');
    rule('Regex').match([Match.backslash('/'), '|`backslashLine`)+\\/']);
    rule('Number').match('number');
  });
  rule('codeEnd', function () {
    rule('token', /\S/);
    rule('SPACE', /\s+/).skip(true);
  });
  rule('end', function () {
    rule('EOF', /$/);
  });
  rule('initial', ['main', 'codeEnd', 'end']);
  rule('es6Template', function () {
    rule('es6Template')
      .match(new RegExp([retool.backslash('${'), '[^$`]+|[\\s\\S]'].join('|')));
    rule('es6TemplateEnd', /`/)
      .action(function () {
        this.setState('js.initial');
        return lexer.defaultAction.apply(lexer, arguments);
      });
    rule('es6TemplateEvalStart', /\${/)
      .action(function () {
        this.pushState('js.es6TemplateEval');
        return lexer.defaultAction.apply(lexer, arguments);
      });
  });
  rule('es6TemplateEval', ['main', 'es6TemplateEvalEnd', 'end']);
  rule('es6TemplateEvalEnd', function () {
    rule('es6TemplateEvalEnd', /}/)
      .action(function () {
        var ns = this.popState();
        if (ns !== 'js.es6TemplateEval')
          this.handleError(new clex.Lex.LexError('invalid close'_);
        return lexer.defaultAction.apply(lexer, arguments);
      });
  });
  rule.action(function () {
    this.pushState('initial');
  });
});
lexer.addRule(jsRule);

lexer.on('error', function (err) {
  console.error(err);
});
var token;
lexer.setSource(source);
lexer.setRule('js');

while ((token = lexer.lex()) != 'EOF')
  console.log(token + ' -> (' + lexer.yytext + ')');

```

```javascript
// something interesting you can do
var server = new require('eventemitter2').EventEmitter2({ wildcard: true });
lexer.defaultAction = function (match, namespace, tokens) {
  if (namespace)
    server.emit(namespace, namespace, match[0], tokens);
  return tokens;
};
server.on('js.*', function (namespace, yytext, tokens) {
  console.log(namespace + " -> ", tokens, " -> (" + yytext + ")");
});
server.on('js.EOF', function () {
  console.log("finished");
});
while ((token = lexer.lex()) != 'EOF')
  console.log(token + ' -> (' + lexer.yytext + ')');

```
