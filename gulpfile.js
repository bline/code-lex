/*
 * Copyright (C) 2014 Scott Beck, all rights reserved
 *
 * Licensed under the MIT license
 *
 */
 /* jshint debug: true, strict: true */
(function () {
  'use strict';
  var gulp = require('gulp');
  var $ = require('gulp-load-plugins')();
  var del = require('del');
  var path = require("path");
  var Buffer = require("buffer").Buffer;
  var pkg = require("./package.json");
  var tinylr = require("tiny-lr");
  var c9WSHost = (pkg.c9.appName || pkg.name) + '-' + pkg.c9.user + '.c9.io';
  var c9Url = 'https://' + (pkg.c9.appName || pkg.name) + '-' + pkg.c9.user + '.c9.io';
  var livereloadUrl = c9Url + '/livereload.js?host=' + c9WSHost + '&port=443';
  var lintSrc = ['./gulpfile.js', './index.js', './lib/**/*.js', 'test/**/*.js', 'bin/*.js'];
  var testSrc = ['test/*helper.js', 'test/*spec.js'];
  var tinyLrServer;

  function runCoverage (opts) {
    return gulp.src(testSrc, { read: false })
      .pipe($.coverage.instrument({
        pattern: ['./lib/**/*.js'],
        debugDirectory: 'debug'}))
      .pipe($.plumber())
      .pipe($.mocha({reporter: 'dot'})
            .on('error', function (err) { console.log("test error: " + err); this.emit('end'); })) // test errors dropped
      .pipe($.plumber.stop())
      .pipe($.coverage.gather())
      .pipe($.coverage.format(opts));
  }

  gulp.task("clean", function (done) {
    del(["coverage/**/*", "coverage", "debug/**/*", "debug"], done);
  });

  gulp.task("lint", function () {
    return gulp.src(lintSrc)
      .pipe($.jshint())
      .pipe($.jshint.reporter(require('jshint-table-reporter')));
  });

  gulp.task('test', function () {
    return gulp.src(testSrc, {read: false})
      .pipe($.plumber())
      .pipe($.mocha({reporter: 'spec'}).on('error', function (err) { console.log("test error: " + err); this.emit('end'); })) // test errors dropped
      .pipe($.plumber.stop());
  });
  gulp.task('coveralls', ['lint'], function () {
    return runCoverage({reporter: 'lcov'})
      .pipe($.coveralls());
  });
  gulp.task('coverage', ['lint'], function () {
    return runCoverage({outFile: './index.html'})
      .pipe($.tap(function (file) {
        file.contents = new Buffer(
          file
            .contents
            .toString()
            .replace(
              /<\/\s*body\s*>\s*(?:<\s*\/html\s*>)?\s*$/,
              '<script src="' + livereloadUrl + '"></script></body></html>'
            )
        );
        if (tinyLrServer) {
          tinyLrServer.changed({body: { files : file.path }});
        }
      }))
      .pipe(gulp.dest('coverage'));
  });
  gulp.task('connect-coverage', ['coverage'], function () {
    $.connect.server({
      root: 'coverage',
      noServer: true,
      https: false,
      port: process.env.PORT,
      host: process.env.IP,
      livereload: { port: process.env.PORT, src: livereloadUrl },
      middleware: function (connect, opt) {
        tinyLrServer = tinylr({app: connect});
        return [
          connect.static(path.join(__dirname, 'coverage')),
          function (req, res, next) {
            console.log("in tinylr request");
            tinyLrServer.handle(req, res, next);
          }
        ];
      }
    });
  });
  gulp.task('watch', function () {
    gulp.watch([lintSrc], ['coverage']);
  });

  gulp.task("default", ['coverage', 'connect-coverage', "watch"]);
})();
