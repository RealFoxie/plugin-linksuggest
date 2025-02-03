/* DOKUWIKI:include_once vendor/jquery.textcomplete.min.js */
function linksuggest_escape(text) {
    return jQuery('<div/>').text(text).html();
}
function charAfterCursor() {
    let editor = jQuery('#wiki__text');
    let position = editor.prop('selectionStart');
    return editor.prop('value').substring(position, position + 1);
}

function appendTitle(title) {
    return (title && JSINFO["append_header"] === 1 && charAfterCursor() !== '|') ? '|' + title : '';
}
function appendSubtitle(title) {
    return (title && charAfterCursor() !== '|') ? '|' + title : '';
}
function appendClosing(closingBracket = ']]') {
    return (charAfterCursor() === closingBracket || charAfterCursor() === '|') ? '' : closingBracket;
}

function extraNs(fullNs, existingNs) {
    if(existingNs === '') {return fullNs; }
    else if (fullNs.startsWith(existingNs)) { return fullNs.slice(existingNs.length + 1) }
    else if ((':' + fullNs).startsWith(existingNs)) { return fullNs.slice(existingNs.length) }
    else { return fullNs; }
}


function jQueryNamespaceSearch(callback, callName, term) {
    jQuery.post(
        DOKU_BASE + 'lib/exe/ajax.php',
        {
            call: callName,
            q: term,
            ns: JSINFO['namespace'],
            id: JSINFO['id'],
        },
        function (data) {
            data = JSON.parse(data);
            callback(jQuery.map(data.data, function (item) {
                let id = item.id;

                if (item.type === 'd') {
                    id = id + ':';
                }

                return {
                    ...item,
                    id: id,                    
                };
            }));
        }
    );
}

jQuery(function () {
    let $editor = jQuery('#wiki__text');

    $editor.textcomplete([
        { //page search
            match: /\[{2}([\w\-.:~\#]*)$/,
            search: function (term, callback) {
                if ($editor.data('linksuggest_off') === 1) {
                    callback([]);
                    return;
                }
                jQueryNamespaceSearch(callback, 'plugin_linksuggest', term);
            },
            template: function (item) { //dropdown list
                let image;
                const title = item.heading || item.title;
                let titlePart = title ? ' (' + linksuggest_escape(item.title) + ')' : '';
                let alt = item.type === 'd' ? 'ns' : 'page';
                const addedns = extraNs(item.fullns, item.enteredfullns);
                if (item.type === 'd') { //namespace
                    image = 'ns.png';
                } else { //file
                    image = 'page.png';
                }
                return '<img alt="' + alt + '" src="' + DOKU_BASE + 'lib/images/' + image + '"> ' + linksuggest_escape(addedns) + titlePart;
            },
            index: 1,
            replace: function (item) { //returns what will be put to editor
                let appendedNs = extraNs(item.fullns, item.enteredfullns);
                if (appendedNs !== '') { appendedNs = ':' + appendedNs; }

                if (item.type === 'd') { //namespace
                    setTimeout(function () {
                        $editor.trigger('keyup');
                    }, 200);
                    return '[[' + item.enteredorigns + appendedNs + ':';
                } else { //file
                    $editor.data('linksuggest_off', 1);

                    setTimeout(function () {
                        $editor.data('linksuggest_off', 0);
                    }, 500);
                    if(item.heading) {
                        return '[[' + item.enteredorigns + appendedNs + '#' + item.heading + appendSubtitle(item.title) + appendClosing();
                    }else {
                        return ['[[' + item.enteredorigns + appendedNs, appendTitle(item.title) + appendClosing()];
                    }
                }

            },
            cache: false
        },
        // TODO MERGE THIS IN THE ABOVE by checking the prefix used...
        // THis is to allow Include plugin to work
        { //page search
            match: /\{\{page>([\w\-.:~\#]*)$/,
            search: function (term, callback) {
                if ($editor.data('linksuggest_off') === 1) {
                    callback([]);
                    return;
                }
                jQueryNamespaceSearch(callback, 'plugin_linksuggest', term);
            },
            template: function (item) { //dropdown list
                let image;
                const title = item.heading || item.title;
                let titlePart = title ? ' (' + linksuggest_escape(item.title) + ')' : '';
                let alt = item.type === 'd' ? 'ns' : 'page';
                const addedns = extraNs(item.fullns, item.enteredfullns);
                if (item.type === 'd') { //namespace
                    image = 'ns.png';
                } else { //file
                    image = 'page.png';
                }
                return '<img alt="' + alt + '" src="' + DOKU_BASE + 'lib/images/' + image + '"> ' + linksuggest_escape(addedns) + titlePart;
            },
            index: 1,
            replace: function (item) { //returns what will be put to editor
                let appendedNs = extraNs(item.fullns, item.enteredfullns);
                if (appendedNs !== '') { appendedNs = ':' + appendedNs; }

                if (item.type === 'd') { //namespace
                    setTimeout(function () {
                        $editor.trigger('keyup');
                    }, 200);
                    return '{{page>' + item.enteredorigns + appendedNs + ':';
                } else { //file
                    $editor.data('linksuggest_off', 1);

                    setTimeout(function () {
                        $editor.data('linksuggest_off', 0);
                    }, 500);
                    if(item.heading) {
                        return '{{page>' + item.enteredorigns + appendedNs + '#' + item.heading + appendClosing('}}');
                    }else {
                        return ['{{page>' + item.enteredorigns + appendedNs, appendClosing('}}')];
                    }
                }

            },
            cache: false
        },

        { //media search
            match: /\{{2}([\w\-.:~]*)$/,
            search: function (term, callback) {
                if ($editor.data('linksuggest_off') === 1) {
                    callback([]);
                    return;

                }
                jQueryNamespaceSearch(callback, 'plugin_imglinksuggest', term);
            },
            template: function (item) { //dropdown list
                let image;
                let value = item.id;
                let alt = item.type === 'd' ? 'ns' : 'media';

                if (item.rootns) { //page is in root namespace
                    value = ':' + value;
                }
                if (item.type === 'd') { //namespace
                    image = 'ns.png';
                } else { //file
                    image = 'media_link_nolnk.png';
                }
                return '<img alt="' + alt + '" src="' + DOKU_BASE + 'lib/images/' + image + '"> ' + linksuggest_escape(value);
            },
            index: 1,
            replace: function (item) { //returns what will be put to editor
                let id = item.id;
                if (item.ns) { //prefix with already entered ns
                    id = item.ns + id;
                }
                if (item.type === 'd') { //namespace
                    setTimeout(function () {
                        $editor.trigger('keyup');
                    }, 200);
                    return '{{' + id;
                } else { //file
                    $editor.data('linksuggest_off', 1);

                    setTimeout(function () {
                        $editor.data('linksuggest_off', 0);
                    }, 500);
                    return ['{{' + id, '}}'];
                }

            },
            cache: false
        }], {
        appendTo: 'body',
        maxCount: 50,
        //header:'test',
        //footer: 'schließen'
    });
});
