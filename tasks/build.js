var fs = require('fs');
var Path = require('path');
var Parser = require('htmlparser2').Parser;

function getClauseId() {
    var pieces = [];

    for(var i = 0; i < sectionStack.length; i++) {
        pieces.push(sectionStack[i].subclauses.length);
    }

    return pieces.join(".");
}

var spec = "";

var toc = {
    title: '',
    subclauses: [

    ]
};

var sectionStack = [toc];
var seen = [];

function processFile(path) {
    seen.push(path);
    var dir = Path.dirname(path);

    function splice(index, remove, insert) {
        output = output.slice(0, index + offset) + insert + output.slice(index + offset + remove);
        offset += insert.length - remove;
    }

    function addAttributes(endIndex, attrs) {
        var attrString = ' ' + Object.keys(attrs).map(function(key) {
            if(attrs[key] === true) {
                return key
            } else {
                return key + '="' + attrs[key] + '"'
            }
        }).join(" ");

        splice(endIndex, 0, attrString);
    }

    var stats = fs.statSync(path);
    var offset = 0;
    var output = '';
    var skipCloseClause = false;

    if(stats.isFile()) {
        var contents = fs.readFileSync(path, 'utf-8');
        var includeContent = null;
        var includeStart = null;

        output = contents;
        var parser = new Parser({
            onprocessinginstruction: function(name, data) {
                splice(parser.startIndex, data.length + 2, '');
            },
            onopentag: function(name, attributes) {
                if(name === "link" && attributes.rel === "import") {
                    var includePath = Path.join(dir, attributes.href);
                    if(seen.indexOf(includePath) > -1) {
                        console.log('re-including ' + includePath + ' from ' + path);
                    } else {
                        splice(parser.startIndex, parser.endIndex - parser.startIndex + 1, processFile(includePath));
                    }
                } else if(name === "es-clause") {
                    var newSection =  {
                        title: attributes.title,
                        subclauses: []
                    };

                    sectionStack[sectionStack.length - 1].subclauses.push(newSection);
                    newSection.id = getClauseId();
                    newSection.anchor = attributes.anchor;
                    addAttributes(parser.endIndex, {
                        id: newSection.id,
                        anchor: newSection.anchor
                    });

                    sectionStack.push(newSection);
                }
            },
            onclosetag: function(name) {
                if(name === 'es-clause') {
                    sectionStack.pop();
                }
            }
        });

        parser.parseComplete(contents);

        return output;
    } else if(stats.isDirectory()) {
        return processFile(Path.join(path, '/head.html'));
    }
}

function generateToc(depth, current, level) {
    depth = depth || Infinity;
    current = current || toc;
    level = level || 0;

    if(current.subclauses.length === 0) {
        return '';
    }

    var markup = '<ol class="toc">';

    current.subclauses.forEach(function(c, i) {
        if(level < depth) {
          markup += '<li><span class="secnum">' + c.id + '</span> <es-xref target="' + c.anchor + '"></es-xref>';

          markup += generateToc(depth, c, level + 1);
          markup += '</li>'
        }
    });
    markup += '</ol>';

    return markup;
}

var spec = processFile('spec/index.html').replace(/\$/g, '$$$$'); // LOL... never been bitten by replace before...
var layout = fs.readFileSync('layout.html', 'utf-8');
var output = layout.replace('{{> body}}', spec);
output = output.replace('{{> toc}}', '<h2>Table of Contents</h2>' + generateToc(3));
fs.writeFileSync('output/spec.html', output);
fs.writeFileSync('output/spec-raw.html', spec);
