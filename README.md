code-lex
===

stylish stateful delightful code lexer

```javascript

/* nearly complete JS lexer implementation */
clex = require('code-lex');

var Match = clex.Match;
var lexer = clex.lexer();

Match.register('jsSingle', /\/\/[^\r\n\f]*(?:\r\n?|\n|\f|$)/);
Match.register('jsMulti', 'cStyleComment');

lexer.rule('js', function (rule) {

  rule.comment.multi('jsMulti');
  rule.comment.single('jsSingle');
  rule.code
    .rule('es6TemplateStart', /`/).join(true).end('es6TemplateEnd', /`/)
      .rule('es6TemplateEvalStart', /${/)
      	.start('js')
      	.end('es6TemplateEvalEnd', /}/);
  rule.code.identifiers(['if', 'else', 'for', ..]);
  rule.code.rule('jsRegex').match('\\/(?:[^\\\\\\/]|`backslashLine`)+\\/');
  rule.code.rule('number');
  rule.code.bareWord(/\w+/);
  rule.state('SPACE', /\s+/).skip(true);
  rule.endState('EOF', /$/);
});

lexer.on('error', function (err) {
  console.error(err);
});
lexer.on('ready', function (lexer) {
  var token;
  lexer.setSource(source);
  lexer.setRule('js');
  while ((token = lexer.lex()).type != 'EOF')
    console.log(token);
});

```

