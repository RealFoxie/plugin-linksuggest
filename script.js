/* DOKUWIKI:include_once vendor/jquery.textcomplete.min.js */
function linksuggest_escape(text) {
    return jQuery('<div/>').text(text).html();
}

function charAfterCursor() {
    let editor = jQuery('#wiki__text');
    let position = editor.prop('selectionStart');
    return editor.prop('value').substring(position, position+1);
}

function appendTitle(title) {
    return (title && JSINFO["append_header"] === 1 && charAfterCursor() !== '|')? '|' + title : '';
}
function appendSubtitle(title) {
    return (title && charAfterCursor() !== '|')? '|' + title : '';
}
function appendClosing() {
    return (charAfterCursor() === ']' || charAfterCursor() === '|')? '' : ']]';
}

function extraNs(fullNs, existingNs) {
    return fullNs.startsWith(existingNs) ? fullNs.slice(existingNs.length) : fullNs;
}

function jQueryNamespaceSearch(callback, callName, term) {
    jQuery.post(
        DOKU_BASE + 'lib/exe/ajax.php',
        {
            call: callName,
            q:    term,
            ns:   JSINFO['namespace'],
            id:   JSINFO['id'],
        },
        function (data) {
            data = JSON.parse(data);
            callback(jQuery.map(data.data, function (item) {
                let id = item.id;

                if (item.type === 'd') {
                    id = id + ':';
                }

                return {
                    id:     id,
                    ns:     item.ns,
                    title:  item.title,
                    type:   item.type,
                    rootns: item.rootns,
                    fullns: item.fullns,
                };
            }));
        }
    );
}

jQuery(function () {
    let $editor = jQuery('#wiki__text');

    $editor.textcomplete([
        { // deep page search - searching with just a word and no prefixed -.:~ 
            match:    /\[{2}([\w]*)$/,
            search:   function (term, callback) {
                if ($editor.data('linksuggest_off') === 1) {
                    callback([]);
                    return;
                }
                jQueryNamespaceSearch(callback, 'plugin_linksuggest', term);
            },
            template: function (item) { //dropdown list
                let image;
                let title = item.title ? ' (' + linksuggest_escape(item.title) + ')' : '';
                let alt = item.type === 'd' ? 'ns' : 'page';
                let value = item.fullns;

                if (item.type === 'd') { //namespace
                    image = 'ns.png';
                } else { //file
                    image = 'page.png';
                }
                return '<img alt="' + alt + '" src="' + DOKU_BASE + 'lib/images/' + image + '"> ' + linksuggest_escape(value) + title;
            },
            index:    1,
            replace:  function (item) { //returns what will be put to editor
                const path = ':' + item.fullns;
                if (item.type === 'd') { //namespace
                    setTimeout(function () {
                        $editor.trigger('keyup');
                    }, 200);
                    return '[[' + path;
                } else { //file
                    $editor.data('linksuggest_off', 1);

                    setTimeout(function () {
                        $editor.data('linksuggest_off', 0);
                    }, 500);
                    return ['[[' + path, appendTitle(item.title) + appendClosing()];
                }

            },
            cache:  false
        },
        { //Deep Page Section (#) Search
            match:    /\[{2}(\#[\w]*)$/,
            index:    1,
            search:   function (term, callback) {
                if ($editor.data('linksuggest_off') === 1) {
                    callback([]);
                    return;
                }
                jQuery.post(
                    DOKU_BASE + 'lib/exe/ajax.php',
                    {
                        call: 'plugin_linksuggest',
                        q:    term,
                        ns:   JSINFO['namespace'],
                        id:   JSINFO['id'],
                    },
                    function (data) {
                        data = JSON.parse(data);
                        callback(jQuery.map(data.data, function (item) {
                            return {
                                'title': item.title,
                                'fullns': item.fullns,
                                'heading': item.heading
                            };
                        }));
                    }
                );
            },
            template: function (item) { //dropdown list
                let title = item.title ? ' (' + linksuggest_escape(item.title) + ')' : '';
                return linksuggest_escape(item.fullns) + title;
            },

            replace: function (item) { //returns what will be put to editor
                const path = ':' + item.fullns;
                $editor.data('linksuggest_off', 1);
                setTimeout(function () {
                    $editor.data('linksuggest_off', 0);
                }, 500);

                return '[[' + path + '#' + item.heading + appendSubtitle(item.title) + appendClosing();
            },
            cache:   false
        },
        { //page search
            match:    /\[{2}([\w\-.:~]*)$/,
            search:   function (term, callback) {
                if ($editor.data('linksuggest_off') === 1) {
                    callback([]);
                    return;
                }
                jQueryNamespaceSearch(callback, 'plugin_linksuggest', term);
            },
            template: function (item) { //dropdown list
                let image;
                let title = item.title ? ' (' + linksuggest_escape(item.title) + ')' : '';
                let alt = item.type === 'd' ? 'ns' : 'page';
                const addedns = extraNs(item.fullns, item.ns);
                if (item.type === 'd') { //namespace
                    image = 'ns.png';
                } else { //file
                    image = 'page.png';
                }
                return '<img alt="' + alt + '" src="' + DOKU_BASE + 'lib/images/' + image + '"> ' + linksuggest_escape(addedns) + title;
            },
            index:    1,
            replace:  function (item) { //returns what will be put to editor
                if (item.type === 'd') { //namespace
                    setTimeout(function () {
                        $editor.trigger('keyup');
                    }, 200);
                    return '[[' + ':' + item.fullns + ':';
                } else { //file
                    $editor.data('linksuggest_off', 1);

                    setTimeout(function () {
                        $editor.data('linksuggest_off', 0);
                    }, 500);
                    return ['[[' + ':' + item.fullns, appendTitle(item.title) + appendClosing()];
                }

            },
            cache:  false
        }, { //Page Section Search
            match:    /\[\[([\w\-.:~]+#[\w\-.:]*)$/,
            index:    1,
            search:   function (term, callback) {
                if ($editor.data('linksuggest_off') === 1) {
                    callback([]);
                    return;
                }
                jQuery.post(
                    DOKU_BASE + 'lib/exe/ajax.php',
                    {
                        call: 'plugin_linksuggest',
                        q:    term,
                        ns:   JSINFO['namespace'],
                        id:   JSINFO['id'],
                    },
                    function (data) {
                        data = JSON.parse(data);
                        callback(jQuery.map(data.data, function (item) {
                            return {
                                'title': item.title,
                                'fullns': item.fullns,
                                'heading': item.heading
                            };
                        }));
                    }
                );
            },
            template: function (item) { //dropdown list
                let title = item.title ? ' (' + linksuggest_escape(item.title) + ')' : '';

                return linksuggest_escape(item.fullns) + title;
            },

            replace: function (item) { //returns what will be put to editor
                const path = item.fullns.startsWith(':')? item.fullns : ':' + item.fullns;
                $editor.data('linksuggest_off', 1);
                setTimeout(function () {
                    $editor.data('linksuggest_off', 0);
                }, 500);

                return '[[' + path + '#' + item.heading + appendSubtitle(item.title) + appendClosing();
            },
            cache:   false
        }, { //media search
            match:    /\{{2}([\w\-.:~]*)$/,
            search:   function (term, callback) {
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
            index:    1,
            replace:  function (item) { //returns what will be put to editor
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
            cache:  false
        }],{
        appendTo: 'body',
        maxCount: 50,
        //header:'test',
        //footer: 'schließen'
    });
});
