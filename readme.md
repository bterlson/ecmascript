## ECMAScript 6 in HTML

### Just give me the spec
Clone the repository, and open `spec/index.html` in a modern browser.

You may need to start a local http server instead of opening off the file
system. If you need an http server, `npm install -g http-server` works great.

### Introduction
The document format for the specification uses Custom Elements and
Imports.  The custom elements give semantic meaning to ECMAScript
constructs and keep markup terse. Imports enable breaking the
specification up into many files while avoiding a build step. Everything
is plaintext and can be edited with any tool.

The html files were generated from html produced by Jason Orendorf's
[es-spec](https://github.com/jorendorff/es-spec-html) tool.  The script
`tasks/parse.js` parses the html input and builds the output html under
the `spec` directory. Currently this process introduces some bugs but once
the document format is deemed stable the parser can be jettisoned and
one-off markup issues fixed manually.
