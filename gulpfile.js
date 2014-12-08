/*
 * Copyright (C) 2014 Scott Beck, all rights reserved
 *
 * Licensed under the MIT license
 *
 */
 /* jshint debug: true, strict: true */
(function () {
  'use strict';
  var gulp = require('gulp'),
     gutil = require('gulp-util'),
         $ = require('gulp-load-plugins')(),
       del = require('del'),
      path = require("path"),
      exec = require('child_process').exec,
       pkg = require("./package.json"),
    tinylr = require("tiny-lr");

  var c9WSHost = (pkg.c9.appName || pkg.name) + '-' + pkg.c9.user + '.c9.io';
  var c9Url = 'https://' + (pkg.c9.appName || pkg.name) + '-' + pkg.c9.user + '.c9.io';
  var livereloadUrl = c9Url + '/livereload.js?host=' + c9WSHost + '&port=443';
  var files = {
    docsDest: path.join(process.cwd(), '/docs/dex/' + pkg.version),
    lintSrc: ['./gulpfile.js', './index.js', './lib/**/*.js', 'test/**/*.js', 'bin/*.js'],
    testSrc: ['test/*helper.js', 'test/*spec.js']
  };
  var options = {
    jsdoc: {
      cmd: [
        require.resolve('jsdoc/jsdoc.js'),
        '--configure ./config/jsdoc.json',
        '--verbose',
        '--pedantic',
        '--readme ./README.md',
        '--package ./package.json',
        '--destination ./docs'
      ]
    }
  };
  var tinyLrServer;

  function runCoverage (opts) {
    return gulp.src(files.testSrc, { read: false })
      .pipe($.coverage.instrument({
        pattern: ['./lib/**/*.js'],
        debugDirectory: 'debug'}))
      .pipe($.plumber())
      .pipe($.mocha({reporter: 'spec'})
            .on('error', function (err) { console.log("test error: " + err); this.emit('end'); })) // test errors dropped
      .pipe($.plumber.stop())
      .pipe($.coverage.gather())
      .pipe($.coverage.format(opts));
  }

  gulp.task("clean", function (done) {
    del(["coverage/**/*", "coverage", "debug/**/*", "debug"], done);
  });

  gulp.task('clean-docs', function (done) {
    del(['./docs/**/*'], done);
  });
  gulp.task("lint", function () {
    return gulp.src(files.lintSrc)
      .pipe($.jshint())
      .pipe($.jshint.reporter(require('jshint-table-reporter')));
  });

  gulp.task('docs', ['clean-docs'], function (done) {
    exec(options.jsdoc.cmd.join(' '), function (err, stdout, stderr) {
      gutil.log(stdout);
      gutil.log(stderr);
      if (err) return done(err);
      gulp.src('favicon.ico')
        .pipe(gulp.dest(files.docsDest))
        .on('end', done);
    });
  });
  gulp.task('publish-docs', ['docs'], function () {
    return gulp.src('./docs/dex/**/*', {
        base: files.docsDest
      })
      .pipe($.ghPages());
  });
  gulp.task('test', ['lint'], function () {
    return gulp.src(files.testSrc, {read: false})
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
      /*.pipe($.tap(function (file) {
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
      }))*/
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
    gulp.watch([files.lintSrc], ['test']);
  });

  gulp.task("default", ['test', "watch"]);
})();
