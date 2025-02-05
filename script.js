/* DOKUWIKI:include_once vendor/jquery.textcomplete.min.js */

const INCLUDE_PLUGIN_FLAGS = [
    ["noheader", "Don't display the header of the inserted section"],
    ["showheader", "Display the header of the inserted section"],
    ["firstseconly", "Display only the first section of the included page"],
    ["fullpage", "Display the full page"],
    ["readmore", "Show “read more” link in case of firstsection only"],
    ["noreadmore", "Do not show “read more” link in case of firstsection only"],
    ["footer", "Show page footer below the included page"],
    ["nofooter", "Hide page footer below the included page"],
    ["link", "Make the first headline of an included page/section a link to the included page/section"],
    ["nolink", "Do not make the first headline of an included page/section a link"],
    ["permalink", "Show a permalink to the included page in the page footer"],
    ["nopermalink", "Hide permalink to the included page in the page footer"],
    ["date", "Show creation date of the page in the page footer"],
    ["nodate", "Hide creation date of the page in the page footer"],
    ["mdate", "Show modification date of the page in the page footer"],
    ["nomdate", "Hide modification date of the page in the page footer"],
    ["user", "Show user name of the page creator in the page footer"],
    ["nouser", "Hide user name of the page creator in the page footer"],
    ["comments", "Show number of comments in the page footer (requires the discussion plugin)"],
    ["nocomments", "Hide number of comments in the page footer"],
    ["linkbacks", "Show number of linkbacks in the page footer (requires the linkback or backlinks plugin)"],
    ["nolinkbacks", "Hide number of linkbacks in the page footer"],
    ["tags", "Show tags in the page footer (requires the tag plugin)"],
    ["notags", "Hide tags in the page footer"],
    ["editbtn", "Show edit buttons (section edit buttons, edit button below the included page)"],
    ["editbutton", "Show edit buttons (section edit buttons, edit button below the included page)"],
    ["noeditbtn", "Hide edit buttons"],
    ["noeditbutton", "Hide edit buttons"],
    ["redirect", "Redirect back to original page after an edit"],
    ["noredirect", "Do not redirect after an edit"],
    ["indent", "Indent included pages relative to the section of the page they get included in"],
    ["noindent", "Do not indent included pages relative to the section"],
    ["linkonly", "Display only a link instead of the whole page content"],
    ["nolinkonly", "Display the whole page content"],
    ["include_content", "Display the whole page content"],
    ["title", "Show the title instead of the page id"],
    ["notitle", "Show the page id instead of the title"],
    ["pageexists", "Only list page ids of existing pages"],
    ["nopageexists", "List page ids of all pages, regardless of existence"],
    ["existlink", "Display a link and do so only if page page-id exists (combination of linkonly and pageexists)"],
    ["parlink", "Put the link into a paragraph environment"],
    ["noparlink", "Do not put the link into a paragraph environment"],
    ["order=", "Ordering criteria for namespace includes (possible options: id, title, created, modified, indexmenu, custom)"],
    ["rsort", "Reverse the sort order in namespace includes"],
    ["sort", "Do not reverse the sort order in namespace includes"],
    ["depth=", "The maximum depth of subnamespaces of which pages are included in namespace includes"],
    ["exclude=", "Regular expression to exclude certain pages, matches on full page ID"]
  ];
  

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
    return (charAfterCursor() === closingBracket[0] || charAfterCursor() === '|') ? '' : closingBracket;
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
        // THis is to allow Include plugin to work
        { //page search
            match: /(\{\{(?:page|section|namespace)>[\w\-.:~\#]*)$/,
            search: function (fullCapture, callback) {
                if ($editor.data('linksuggest_off') === 1) {
                    callback([]);
                    return;
                }
                const separatedRegex = /\{\{(page|section|namespace)>([\w\-.:~\#]*)$/;
                [fullStr, prefix, term] = fullCapture.match(separatedRegex);
                callbackWithPrefix = (data) => callback(data.map((item) => ({ ...item, prefix }))); 
                jQueryNamespaceSearch(callbackWithPrefix, 'plugin_linksuggest', term);
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
                const prefix = `{{${item.prefix}>`;
                if (item.type === 'd') { //namespace
                    setTimeout(function () {
                        $editor.trigger('keyup');
                    }, 200);
                    return prefix + item.enteredorigns + appendedNs + ':';
                } else { //file
                    $editor.data('linksuggest_off', 1);

                    setTimeout(function () {
                        $editor.data('linksuggest_off', 0);
                    }, 500);
                    if(item.heading) {
                        return prefix + item.enteredorigns + appendedNs + '#' + item.heading + appendClosing('}}');
                    }else {
                        return [prefix + item.enteredorigns + appendedNs, appendClosing('}}')];
                    }
                }

            },
            cache: false
        },
        { // search for flags of include plugin
            match: /(\{\{(?:page|section|namespace)>[\w\-.:~\#]*\&\w+)$/,
            search: function (fullCapture, callback) {
                if ($editor.data('linksuggest_off') === 1) {
                    callback([]);
                    return;
                }
                const separatedRegex = /(\{\{(?:page|section|namespace)>[\w\-.:~\#\&]*\&)(\w+)$/;
                [fullStr, fullPrefix, term] = fullCapture.match(separatedRegex);
                const items = INCLUDE_PLUGIN_FLAGS.filter(([flag, explanation]) => flag.includes(term.toLowerCase())).map(([flag, explanation]) => ({ flag, explanation, prefix: fullPrefix }));
                callback(items);
            },
            template: function (item) { //dropdown list
                console.log(item)
                return linksuggest_escape(item.flag) + `  (${linksuggest_escape(item.explanation)})`;
            },
            index: 1,
            replace: function (item) { //returns what will be put to editor
                return item.prefix + item.flag + appendClosing('}}');
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
    });
});
