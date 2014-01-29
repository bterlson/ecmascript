var http = require('http');
var htmlparser = require('htmlparser2');
var handler = new htmlparser.DomHandler({normalizeWhitespace: false});

var fs = require('fs');
var tidy = require('htmltidy').tidy;

var tidyOptions = {
    showBodyOnly: true,
    indent: 'auto',
    wrap: 100,
    newline: 'LF',
    newInlineTags: 'es-xref es-t es-nt es-gann es-gmod es-gprose es-production-inline es-rhs-inline',
    newBlocklevelTags: 'es-clause es-production es-rhs es-intro es-annex es-note',
    verticalSpace: false
};

http.get('http://people.mozilla.org/~jorendorff/es6-draft.html', function(res) {
    var spec = '';
    res.on('data', function(chunk) { spec += chunk })
    res.on('end', function() {
        var parser = new htmlparser.Parser(handler);
        parser.write(spec);
        parser.end();

        var top = emitSpec(handler.dom)
        top.id = 'index'
        top.subsections.splice(0, 1); // remove contents
        writeSection(top, 'spec/');
    });
});

// Not complete
var voidElems = ["area", "base", "br", "col", "command", "embed", "hr", "img", "input", "keygen",
                 "link", "meta", "param", "source", "track", "wbr"];

function Section() {
    this.contents = '';
    this.title = '';
    this.id = null;
    this.secnum = null;
    this.subsections = [];
}

Section.prototype.printToc = function(indent) {
    indent = indent || '';
    console.log(indent + this.id);
    this.subsections.forEach(function(subsection) {
        subsection.printToc(indent + '  ');
    });
}

function emitAttrs(attrs) {
    return Object.keys(attrs || {}).map(function(key) {
        if(attrs[key] === true) {
            return key
        } else {
            return key + '="' + attrs[key] + '"'
        }
    }).join(" ");
}

var inlineTags = ['b', 'i', 'code', 'span', 'sub'];
function emitTag(node) {
    var attrs = emitAttrs(node.attribs);

    var tag = '<' + node.name;

    if(attrs) {
        tag += ' ' + attrs;
    }

    if(~voidElems.indexOf(node.name)) {
        return tag + ' />'
    }

    tag += '>';

    node.children.forEach(function(child) {
        tag += emitContents(child);
    });

    tag += '</' + node.name + '>';

    if(!~inlineTags.indexOf(node.name)) {
        tag += '\n';
    }

    if(node.name === 'p') {
        tag += '\n';
    }

    return tag;
}

function emitText(node) {
    return node.data.replace(/\r|\n/g, '').replace(/\s+/g, ' ');
}

function emitNode(node) {
    switch(node.type) {
        case 'tag':
            return emitTag(node);
        case 'text':
            return emitText(node);
    }

    return '';
}

function emitXref(node) {
    var target = node.attribs.href.match(/#(.*)$/)[1];
    var contents = '<es-xref target="' + target + '">';

    node.children.forEach(function(child) {
        contents += emitContents(child);
    });

    contents += '</es-xref>';

    return contents;
}

function forEachChild(node, fn) {
    node.children.forEach(fn);
}

function emitNt(node) {
    var contents = '<es-nt>';

    node.children.forEach(function(child) {
        contents += emitContents(child);
    });

    contents += '</es-nt>';

    return contents;
}

function emitT(node) {
    var contents = '<es-t>';

    node.children.forEach(function(child) {
        contents += emitContents(child);
    });

    contents += '</es-t>';

    return contents;
}

function innerText(node) {
    if(node.type === 'text') {
        return emitText(node);
    } else if(node.type === 'tag') {
        return node.children.map(function(child) {
            return innerText(child);
        }).join("");
    }

    return '';
}

function buildRhs(node) {
    var rhs = [];
    var inMod = false;

    node.children.forEach(function(child, index) {
        if(child.type === 'tag' && child.attribs.class === 'nt') {
            var nt = {type: 'nt', value: innerText(child)};

            if(inMod) {
                rhs[rhs.length - 1].contents.push(nt);
            } else {
                rhs.push(nt);
            }
        } else if(child.type === 'tag' && child.attribs.class === 't') {
            var t = {type: 't', value: innerText(child)};

            if(inMod) {
                rhs[rhs.length - 1].contents.push(t);
            } else {
                rhs.push(t);
            }
        } else if(child.name === 'sub') {
            var text = innerText(child);
            if(text === 'opt') {
                rhs[rhs.length - 1].optional = true;
            } else {
                rhs[rhs.length - 1].params = innerText(child).replace(/\r?\n/g, '').match(/\[(.*)\]/)[1];
            }
        } else if(child.name === 'span' && child.attribs.class === 'grhsannot') {
            if(rhs.length === 0) {
                // Have a constraint
                rhs.constraint = innerText(child).replace(/\r?\n/g, '').match(/\[(.*)\]/)[1];
            } else {
                // Have an annotation
                var ann = {type: 'ann', contents: emitContents(child.children).replace(/\r?\n/g, '').match(/\[(.*)\]/)[1]};

                rhs.push(ann)
            }
        } else if(child.name === 'span' && child.attribs.class === 'grhsmod') {
            inMod = true;
            var mod = {type: 'mod', contents: [emitContents(child.children) + ' ']};
            rhs.push(mod);
        } else if(child.name === 'span' && child.attribs.class === 'gprose') {
            rhs.push({type: 'prose', contents: emitContents(child.children)});
        } else if(child.type === 'text' && child.data.match(/&lt;.*&gt;/)) {
            rhs.push({type: 'text', contents: child.data});
        } else if(child.type !== 'text' || child.data.trim() !== '') {
            console.log('WTFFF: ')
            console.log(child);
        }
    });

    return rhs;
}

function buildLhs(node, production) {
    walk(node.children, function(lhsChild) {
        if(lhsChild.name === 'span' && lhsChild.attribs.class === 'nt') { 
            production.lhs = innerText(lhsChild);
        }

        if(lhsChild.name === 'sub') {
            production.params = innerText(lhsChild).match(/\[(.*)\]/)[1];
        }

        if(lhsChild.name === 'span' && lhsChild.attribs.class === 'geq') {
            var sym = innerText(lhsChild);

            if(sym === '::') {
                production.type = 'lexical';
            } else if(sym === ':::') {
                production.type = 'numeric';
            }

            return false;
        }

        if( lhsChild.name === 'span' &&
            lhsChild.attribs.class === 'grhsmod' &&
            innerText(lhsChild) === 'one of' ) {

            production.oneOf = true;
        }
    })
}

function buildProd(node, inline, displayAsBlock) {
    var production = {
        rhs:[],
        inline: inline,
        displayAsBlock: displayAsBlock
    };
    
    if(inline) {
        var lhsFragment = {
            children: []
        }

        var rhsFragment = {
            children: []
        }

        var afterGeq = false;


        node.children.forEach(function(child) {
            if(afterGeq) {
                rhsFragment.children.push(child);
            } else {
                lhsFragment.children.push(child);

                if(child.name === 'span' && child.attribs.class === 'geq') {
                    afterGeq = true;
                }
            }
        });

        buildLhs(lhsFragment, production);
        production.rhs.push(buildRhs(rhsFragment));

        return production;
    }

    walk(node.children, function(child) {

        if(child.name === 'div' && child.attribs.class === 'lhs') {
            // Grab non-terminal and any lhs parameters
            buildLhs(child, production);
            return false;
        }


        if(child.name === 'div' && child.attribs.class === 'rhs') {
            production.rhs.push(buildRhs(child));

            return false;
        }

        if(child.name === 'div' && child.attribs.class === 'gsumxref') {
            walk(child.children, function(node) {
                if(node.name === 'a') {
                    var target = node.attribs.href.match(/#(.*)$/)[1];
                    production.xref = target;
                }
            });
            return false;
        }
        if(child.type !== 'text' || child.data.trim() !== '') {
            console.log(child);
            throw 'Unknown 2';
        }
    })


    return production;
}

function emitSymbol(symbol, nextSymbol, explicitT) {
    var contents = '';
    if(symbol.type === 't') {
        if(explicitT) {
            contents += '<es-t>' + symbol.value + '</es-t>';
        } else {
            contents += symbol.value;
        }

        if(nextSymbol) {
            // no space if we're at the end
            contents += ' ';
        }
    } else if(symbol.type === 'nt') {
        contents += '<es-nt';

        if(symbol.optional) {
            contents += ' optional';
        }

        if(symbol.params) {
            contents += ' params="' + symbol.params + '"';
        }

        contents += '>' + symbol.value + '</es-nt>';
        
        if(nextSymbol) {
            contents += ' ';
        }
    } else if(symbol.type === 'ann') {
        contents += '<es-gann>' + symbol.contents + '</es-gann>';
    } else if(symbol.type === 'mod') {
        contents += '<es-gmod>' + symbol.contents.map(function(c, i) {
            if(typeof c === 'string') {
                return c;
            }

            return emitSymbol(c, symbol.contents[i + 1], true)
        }).join('') + '</es-gmod>';

    } else if(symbol.type === 'prose') {
        contents += '<es-gprose>' + symbol.contents + '</es-gprose>';
    } else if(symbol.type === 'text') {
        contents += symbol.contents;
    } else {
        throw 'Unknown 1';
    }

    return contents;
}

function emitRhs(rhs, inline) {
    var contents;

    if(inline) {
        contents = '<es-rhs-inline';
    } else {
        contents = '<es-rhs';
    }

    if(rhs.constraint) {
        contents += ' constraint="' + rhs.constraint + '"';
    }

    contents += '>';
    if(rhs.every(function(s) { return s.type === 't' })) {
        contents += rhs.map(function(s) { return s.value }).join(' ');
    } else {
        var nts = rhs.reduce(function(count, s) { return s.type === 'nt' ? count + 1 : count}, 0);

        if(nts > 1) {
            contents += '\n';
        }
        rhs.forEach(function(symbol, i) {
            contents += emitSymbol(symbol, rhs[i + 1], nts < 2);
        })
    }

    if(inline) {
        contents += '</es-rhs-inline>';
    } else {
        contents += '</es-rhs>';
    }

    contents = contents;
    return contents;
}

function emitProduction(prod) {
    var contents = '';

    if(prod.inline && !prod.displayAsBlock) {
        contents += '<es-production-inline';
    } else {
        contents += '<es-production';
    }

    contents += ' name="' + prod.lhs + '"';

    if(prod.type) {
        contents += ' type="' + prod.type + '"';
    }

    if(prod.params) {
        contents += ' params="' + prod.params + '"';
    }

    if(prod.xref) {
        contents += ' xref="' + prod.xref + '"';
    }

    if(prod.inline) {
        contents += ' class="inline"';
    }
    if(prod.oneOf) {
        contents += ' oneOf'
    }

    contents += '>\n';
    
    prod.rhs.forEach(function(rhs) {
        contents += emitRhs(rhs, prod.inline && !prod.displayAsBlock);
    });

    if(prod.inline && !prod.displayAsBlock) {
        contents += '</es-production-inline>\n\n';
    } else {
        contents += '</es-production>\n\n';
    }

    return contents;
}

function emitNote(node) {
    contents = '<es-note>';

    walk(node, function(child) {
        if(child.type === 'tag' && child.name === 'span' && child.attribs.class === 'nh') {
            child.skip = true;
        }
    });

    contents += emitContents(node.children);
    contents += '</es-note>';

    return contents;
}

function emitContents(node) {
    if(Array.isArray(node)) {
        return node.map(function(node) { return emitContents(node) }).join('');
    }

    if(node.skip) {
        return '';
    }

    if(node.name === 'section') {
        return '';
    }

    if(node.name === 'a' &&
       (node.attribs.href.match(/~jorendorf/) || node.attribs.href.match(/sec-/))) {
        return emitXref(node);
    }

    if(node.name === 'var') {
        return emitNt(node);
    }

    if(node.name === 'div' && node.attribs.class === 'gp') {
        return emitProduction(
            buildProd(node)
        )
    }

    if((node.name === 'span' && node.attribs.class === 'prod') ||
       (node.name === 'div' && node.attribs.class === 'gp prod')){
        return emitProduction(buildProd(node, true, node.name === 'div'));
    }

    if(node.name === 'span' && node.attribs.class === 'nt') {
        return emitNt(node);
    }

    if(node.name === 'code' && node.attribs.class === 't') {
        return emitT(node);
    }

    if(node.name === 'div' && node.attribs.class === 'front') {
        return emitContents(node.children);
    }

    if(node.name === 'div' && node.attribs.class === 'note') {
        return emitNote(node);
    }

    if(node.name === 'span' &&
       node.attribs.style &&
       node.attribs.style.indexOf("font-family") > -1 &&
       node.attribs.style.indexOf(';') === -1) {
        return emitContents(node.children);
    }
    return emitNode(node);
}

function emitSection(sectionNode) {
    var section = new Section();
    section.id = sectionNode.attribs.id;

    walk(sectionNode.children, function(node) {
        if(node.name === 'section') {
            section.subsections.push(emitSection(node));

            return false;
        }

        if(node.name === 'h1') {
            node.skip = true;
            section.title = node.children.map(function(n) { return n.type === 'text' ? emitText(n).trim() : '' }).join('');

            return false;
        }
    });

    sectionNode.children.forEach(function(child) {
        section.contents += emitContents(child);
    });

    return section;
}

function emitSpec(dom) {
    var spec = new Section();

    walk(dom, function(node) {
        if(node.name === 'section') {
            spec.subsections.push(emitSection(node));
            return false;
        }
    });

    return spec;
}

function walk(node, cb) {
    if(Array.isArray(node)) {
        node.forEach(function(child) {
            walk(child, cb);
        });
    } else {
        var walkChildren = cb(node);

        if(walkChildren !== false && node.children) {
            node.children.forEach(function(child) {
                walk(child, cb);
            });
        }
    }
}

var Path = require('path');

function writeSection(section, currentPath) {
    var sectionId = section.id.replace('sec-', '');
    var level = sectionId === 'index' ? 0 : 1;

    var ssRoot = Path.join(currentPath, sectionId);
    var path = ssRoot + '.html';

    var contents = '<!doctype html>\n';

    if(section.id !== 'index') {
        contents += '<es-clause title="' + section.title + '" anchor="' + section.id + '">\n'
    }

    contents += section.contents + '\n\n';

    section.subsections.forEach(function(sub) {
        if(sub.title === 'Introduction') {
            contents += '<es-intro><h2>Introduction</h2>' + sub.contents + '</es-intro>';
            return;
        }

        if(!sub.id)
            return;
        
        var subpath;

        if(sectionId === 'index') {
            subpath = sub.id.replace('sec-', '');
        } else {
            subpath = Path.join(sectionId, sub.id.replace('sec-', '')).replace(/\\/g, '/').replace(/%/g, '%25');
        }

        if(sub.subsections.length === 0 && sub.contents.length < 1000) {
            contents += '\n<es-clause title="' + sub.title + '" anchor="' + sub.id + '">\n';
            contents += sub.contents;
            contents += '</es-clause>\n\n';
        } else {
            contents += '<link rel="import" href="' +
                            subpath + '.html' +
                        '">\n';

            if(sectionId === 'index') {
                writeSection(sub, currentPath);
            } else {
                try {
                    fs.mkdirSync(Path.join(currentPath, sectionId));
                } catch(e) {};
                writeSection(sub, Path.join(currentPath, sectionId));
            }
        }
    });

    if(section.id !== 'index') {
        contents += '</es-clause>';
    }

    tidy(contents, tidyOptions, function(err, html) {
        html = html.replace(/es-production-inline/g, "es-production")
        html = html.replace(/es-rhs-inline/g, "es-rhs")

        fs.writeFileSync(path, '<!doctype html>\n' + html);
    });
}
