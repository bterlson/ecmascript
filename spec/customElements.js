var slugToName = {};
var awaitingClause = {};

function setAnchorText(a, text) {
    a.textContent = text;
}

if(!document.registerElement && document.register)
    document.registerElement = document.register;

document.registerElement('es-xref', {
    prototype: {
        __proto__: HTMLElement.prototype,
        createdCallback: function() {
            var target = this.getAttribute('target');

            var a = document.createElement('a');
            a.setAttribute('href', '#' + target);
            if(this.textContent === "") {
                if(slugToName[target]) {
                    a.textContent = slugToName[target];
                } else {
                    a.textContent = target;
                    awaitingClause[target] = awaitingClause[target] || [];
                    awaitingClause[target].push(setAnchorText.bind(null, a));
                }

                this.appendChild(a);
            } else {
                a.textContent = this.textContent;
                this.textContent = '';
            }

            this.appendChild(a);
        }
    }
});

document.registerElement('es-note', {
    prototype: {
        __proto__: HTMLElement.prototype,
        createdCallback: function() {
            var noteNode = document.createElement('span');
            noteNode.setAttribute('class', 'note');
            noteNode.textContent = 'Note'

            this.insertBefore(noteNode, this.firstChild);
        }
    }
});
document.registerElement('es-production', {
    prototype: {
        __proto__: HTMLElement.prototype,
        createdCallback: function() {
            var type = this.getAttribute('type');

            var nt = document.createElement('es-nt');
            nt.innerHTML = this.getAttribute('name');

            var mods = createModifiersNode(this);
            nt.appendChild(mods);

            this.insertBefore(nt, this.children[0])

            var geq = document.createElement('es-geq');
            if(type === 'lexical') {
                geq.textContent = '::';
            } else if(type === 'numeric') {
                geq.textContent = ':::';
            } else {
                geq.textContent = ':';
            }

            this.insertBefore(geq, nt.nextSibling);


            if(this.hasAttribute('oneof')) {
                var elem = document.createElement('es-oneof');
                elem.textContent = 'one of'

                this.insertBefore(elem, geq.nextSibling)
            }
        }
    }
});

document.registerElement('es-rhs', {
    prototype: {
        __proto__: HTMLElement.prototype,
        createdCallback: function() {
            if(this.textContent === '') {
                this.textContent = '[empty]'

                return;
            }

            var constraints = this.getAttribute('constraints');

            if(constraints) {
                var cs = document.createElement('es-constraints');
                cs.textContent = '[' + constraints + ']'

                this.insertBefore(cs, this.children[0]);
            }

            terminalify(this);
        }
    }
});

document.registerElement('es-gann', {
    prototype: {
        __proto__: HTMLElement.prototype,
        createdCallback: function() {
            if(this.firstChild.nodeType === 3) {
                this.firstChild.textContent = '[' + this.firstChild.textContent;
            } else {
                var pre = document.createTextNode('[');
                this.insertBefore(pre, this.children[0]);
            }


            var post = document.createTextNode(']');
            this.appendChild(post);
        }
    }
});


function previousClauseSibling(node) {
    while(node !== null) {
        node = node.previousSibling;

        if(node && node.nodeType === 1 && node.localName === 'es-clause')
            break;
    }

    return node;
}


document.registerElement('es-clause', {
    prototype: {
        __proto__: HTMLElement.prototype,

        createdCallback: function() {
            var anchor = this.getAttribute('anchor');
            var name = this.getAttribute('title');

            if(awaitingClause[anchor]) {
                awaitingClause[anchor].forEach(function(fn) {
                    fn(name);
                });
                awaitingClause[anchor] = null;
            }

            slugToName[anchor] = name;
        },

        updateChildrenId: function() {
            var sectionNumber = this.sectionNumber;
            var counter = 1;
            var children = this.children;
            var length = children.length;
            for(var i = 0; i < length; i++) {
                if(children[i].localName === 'es-clause') {
                    children[i].sectionNumber = sectionNumber + '.' + counter++;
                }
            }
        },

        set sectionNumber(sectionNumber) {
            if(sectionNumber !== this.id) {
                this.id = sectionNumber;

                if(!sectionNumber) {  // WebKit/Blink return null (should have been fixed in Blink ToT)
                    var header = document.createElement('h1');
                } else {
                    var header = document.createElement('h' + (sectionNumber.split('.').length + 1));
                }

                var anchor = this.getAttribute('anchor');
                var name = this.getAttribute('title');

                var secnum = document.createElement('a');
                secnum.name = anchor;
                secnum.className = 'secnum';
                secnum.textContent = sectionNumber;
                header.appendChild(secnum);

                var text = document.createTextNode(name);
                header.appendChild(text);

                this.insertBefore(header, this.firstChild);

                this.updateChildrenId();
            }
            // Else this will get updated by the parent as needed.
        },

        get sectionNumber() {
            return this.id;
        },

        attachedCallback: function() {
            var name = this.getAttribute('title');

            if(name) {
                var sectionNumber;

                var sibling = previousClauseSibling(this);

                if(this.parentNode.localName !== 'es-clause') {
                    if(sibling) {
                        sectionNumber = "" + (parseFloat(sibling.id) + 1);
                    } else {
                        sectionNumber = "1";
                    }
                } else {
                    sectionNumber = this.parentNode.id;
                    if(!sectionNumber) {
                        return;
                    }

                    if(sibling) {
                        sectionNumber += '.' + (parseFloat(sibling.id.split('.').reverse()[0]) + 1);
                    } else {
                        sectionNumber += '.1';
                    }
                }

                this.sectionNumber = sectionNumber;
            }
        }
    }
});

function terminalify(parentNode) {
    for(var i = 0; i < parentNode.childNodes.length; i++) {
        var node = parentNode.childNodes[i];

        if(node.nodeType === 3) {
            var text = node.textContent.trim();
            var pieces = text.split(/\s/);

            pieces.forEach(function(p) {
                if(p.length === 0) {
                    return;
                }
                var est = document.createElement('es-t');
                est.textContent = p;

                parentNode.insertBefore(est, node);
            }, parentNode);

            parentNode.removeChild(node);
        }
    }

}
function createModifiersNode(node) {
    var modifiers = '';

    var params = node.getAttribute('params');
    if(params) {
        modifiers += ' [' + params + ']'
    }

    if(node.hasAttribute('optional')) {
        modifiers += ' opt';
    }

    var el = document.createElement('es-mods');
    el.textContent = modifiers;

    return el;

}

document.registerElement('es-nt', {
    prototype: {
        __proto__: HTMLElement.prototype,
        createdCallback: function() {
            this.insertBefore(createModifiersNode(this), null);
        }
    }
});

function adoptBody(body) {
    var frag = document.createDocumentFragment();
    var children = [].slice.apply(body.childNodes);

    children.forEach(function(child) {
        child = document.importNode(child, true);
        frag.appendChild(child);
    })

    return frag;
}

function inlineImports(doc) {
    var elems = [].slice.apply(doc.getElementsByTagName('link'));


    elems.filter(function(e) { return e.getAttribute('rel') === 'import' })
        .forEach(function(e) {
            inlineImports(e.import);
            e.parentNode.replaceChild(adoptBody(e.import.body), e);
        });

}

function generateToc(depth, current, level) {
    depth = depth || Infinity;
    current = current || document.body;
    level = level || 0;

    if(level >= depth)
        return '';

    var markup = '<ol class="toc">';
    var c;

    for(var i = 0; i < current.children.length; i++) {
        c = current.children[i];

        if(c.localName === 'es-clause' && level < depth) {
          markup += '<li><span class="secnum">' + c.sectionNumber + '</span> <es-xref target="' + c.getAttribute('anchor') + '"></es-xref>';
          markup += generateToc(depth, c, level + 1);
          markup += '</li>'
        }
    }

    markup += '</ol>';

    return markup;
}

function appendToc() {
    var toc = generateToc(3);
    var ol = document.createElement('ol');
    ol.setAttribute('class', 'toc');
    ol.innerHTML = toc;

    var container = document.createElement('es-intro');
    var header = document.createElement('h2');
    header.textContent = 'Contents';
    container.appendChild(header);
    container.appendChild(ol);

    document.body.insertBefore(container, document.body.firstChild);
}

document.addEventListener('load', function(e) {
    var el = e.target;
    if (el.rel === 'import') {
        inlineImports(el.import);
        el.parentNode.replaceChild(adoptBody(el.import.body), el);
    }
}, true);

document.addEventListener('HTMLImportsLoaded', appendToc);
