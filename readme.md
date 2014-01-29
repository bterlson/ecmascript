## ECMAScript 6 in HTML

### Just give me the spec

Clone the repository, and open `spec/index.html` in a modern browser.

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

Since Imports are not supported natively anywhere, `tasks/build.js` will
transform the spec into an html file your modern browser can render at
`output/spec.html`. Since Custom Elements are not supported natively
anywhere, the assembled output includes Mozilla's
[X-Tag](http://www.x-tags.org/) Custom Elements polyfill to inject
additional markup for the browser to render.  Once there is a browser that
supports Imports and Custom Elements, displaying the spec in the browser
from disk will only require executing some script to add presentation. It
would be possible to tweak the document format to avoid the script
dependency and rely entirely on CSS but that may require increasing
verbosity.
