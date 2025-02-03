<?php

use dokuwiki\Extension\Event;
use dokuwiki\Logger;
/**
 * DokuWiki Plugin linksuggest (Action Component)
 *
 * ajax autosuggest for links
 *
 * @license GPL 2 (http://www.gnu.org/licenses/gpl.html)
 * @author lisps
 */

class action_plugin_linksuggest extends DokuWiki_Action_Plugin {
    const MAX_RESULTS = 50;
    /**
     * Register the eventhandlers
     *
     * @param Doku_Event_Handler $controller
     */
    public function register(Doku_Event_Handler $controller) {
        $controller->register_hook('AJAX_CALL_UNKNOWN', 'BEFORE', $this, 'page_link');
        $controller->register_hook('AJAX_CALL_UNKNOWN', 'BEFORE', $this, 'media_link');
        $controller->register_hook('DOKUWIKI_STARTED', 'AFTER',  $this, '_add_config');
    }
    public function _add_config(&$event, $param) {
        global $JSINFO;
        $JSINFO['append_header'] = $this->getConf('append_header');
    }

    /**
     * ajax Request Handler
     * page_link
     *
     * @param $event
     */
    public function page_link($event) {
        if ($event->data !== 'plugin_linksuggest') {
            return;
        }
        //no other ajax call handlers needed
        $event->stopPropagation();
        $event->preventDefault();

        global $INPUT;

        //current page/ns
        $current_pageid = trim($INPUT->post->str('id')); //current id
        $current_ns = getNS($current_pageid);
        $originalQ = $INPUT->post->str('q'); //entered string
        $originalQ = trim($originalQ);

        // split of hash part
        list($entered_ns_q, $hash_search) = array_pad(explode('#', $originalQ, 2), 2, null);
        $has_hash = !($hash_search === null);
        $entered_ns = getNS($entered_ns_q); //namespace of entered string
        $entered_orig_ns = $entered_ns === false ? '' : $entered_ns;
        // convert $entered_ns relative links to absolute links
        if((strpos($entered_ns_q, '.') !== false //relative link (., .:, .., ..:, .ns: etc, and :..:, :.: )
            || substr($entered_ns_q, 0, 1) == '~')) {
            
            if($entered_ns === false) {
                if (substr($entered_ns_q, 0, 2) === '..') {
                    $entered_ns = '..';
                } elseif (substr($entered_ns_q, 0, 1) === '.') {
                    $entered_ns = '.';

                } elseif (substr($entered_ns_q, 0, 1) === '~') {
                    $entered_ns = '~';
                }
            }
            $tilde_ns = (substr($entered_ns_q, 0, 1) === '~');
            //resolve the ns based on current id
            if($tilde_ns) {
                //add a random page name, otherwise it ~ or ~: are interpret as ~:start
                $entered_ns .= '~uniqueadditionforlinksuggestplugin'; // 34 characters long
            }

            if (class_exists('dokuwiki\File\PageResolver')) {
                // Igor and later
                $resolver = new dokuwiki\File\PageResolver($current_pageid);
                $entered_ns = $resolver->resolveId($entered_ns);
            } else {
                // Compatibility with older releases
                resolve_pageid(getNS($current_pageid), $entered_ns, $exists);
            }

            if($tilde_ns) {
                $entered_ns = substr($entered_ns, 0,-35); //remove : and unique string
            }
        }

        $entered_page = cleanID(noNS($entered_ns_q)); //page part of entered string
        $matchedPages = [];
        if ($entered_ns === '') { // [[:xxx -> absolute link
            $matchedPages = $this->search_pages_both_limited('', $entered_page, $has_hash);
        } else if($entered_ns === false) {
            if(substr($originalQ, 0, 1) === '#') {  // [[#word search, global heading search
                $matchedPages = $this->search_pages_upwards($current_ns, '', true, true);
            } else { // [[xxx while current page not in root-namespace
                // todo check if this should indeed return namespaces, or only pages
                $matchedPages = $this->search_pages_upwards_both_limited($current_ns, $entered_page, false);
            }
        }else {
            $matchedPages = $this->search_pages_both_limited($entered_ns, $entered_page, $has_hash);
        }
        
        // TODO: when using e.g. :cos:sess#d, it will not give anything, because
        // it does not count everything under "sessions" namespace, because it only searches for pages
        // with sess, and only the namespace :sessions: is given
        // So when doing a search with #, it should be less limited (only page search, but okay if search is inside part of namespaces)
        if($has_hash) {
            // when searching for a hash, also search in its own page
            $matchedPages = array_merge($matchedPages, [['id' => $entered_ns, 'type' => 'f']]);
        }

        $matchedPages = $this->removeDuplicateSearchResults($matchedPages);
        $data_suggestions = [];
        $link = '';
        if($has_hash) {
            // need to look at the TOC of every page...
            foreach ($matchedPages as $entry) {
                $page = $entry['id'];
                $meta = p_get_metadata($page, false, METADATA_RENDER_USING_CACHE);
                if ($entry['type'] === 'f' && isset($meta['internal']['toc']) && isset($meta['description']['tableofcontents'])) {
                    $toc = $meta['description']['tableofcontents'];
                    Event::createAndTrigger('TPL_TOC_RENDER', $toc, null, false);
                    if (is_array($toc) && count($toc) !== 0) {
                        foreach ($toc as $t) { //loop through toc and compare
                            if ($hash_search === '' || stripos($t['hid'], $hash_search) !== false) {
                                $data_suggestions[] = [
                                    'id' => noNS($page),
                                    'enteredfullns' => $entered_ns,
                                    'enteredorigns' => $entered_orig_ns,
                                    'title' => $t['title'],
                                    'fullns' => $page,
                                    'heading' => $t['hid'],
                                ];
                            }
                        }
                    }
                }
                if(count($data_suggestions) > self::MAX_RESULTS) {
                    break;
                }
            }
        }
        else {
            // pure namespace/page search 
            foreach ($matchedPages as $entry) {
                //a page in rootns
                $data_suggestions[] = [
                    'id' => noNS($entry['id']),
                    //return literally ns what user has typed in before page name/namespace name that is suggested
                    'enteredfullns' => $entered_ns,
                    'enteredorigns' => $entered_orig_ns,
                    'type' => $entry['type'], // d/f
                    'title' => $entry['title'] ?? '', //namespace have no title, for pages sometimes no title
                    'fullns' => $entry['id'],
                ];
            }
        }

        echo json_encode([
            'data' => $data_suggestions,
            'link' => $entered_ns_q
        ]);
    }

    /**
     * ajax Request Handler
     * media_link
     *
     * @param Event $event
     */
    public function media_link($event) {
        if ($event->data !== 'plugin_imglinksuggest') {
            return;
        }
        //no other ajax call handlers needed
        $event->stopPropagation();
        $event->preventDefault();

        global $INPUT;

        //current media/ns
        $current_pageid = trim($INPUT->post->str('id')); //current id
        $current_ns = getNS($current_pageid);
        $q = trim($INPUT->post->str('q')); //entered string

        $entered_ns = getNS($q); //namespace of entered string
        $trailing = ':'; //needs to be remembered, such that actual user input can be returned
        if($entered_ns === false) {
            //no namespace given (i.e. none : in $q)
            // .xxx, ..xxx, ~xxx, if in front of ns, cleaned in $entered_page
            if (substr($q, 0, 2) === '..') {
                $entered_ns = '..';
            } elseif (substr($q, 0, 1) === '.') {
                $entered_ns = '.';

            } elseif (substr($q, 0, 1) === '~') {
                $entered_ns = '~';
            }
            $trailing = '';
        }

        $entered_media = cleanID(noNS($q)); //page part of entered string

        if ($entered_ns === '') { // [[:xxx -> absolute link
            $matchedMedias = $this->search_medias('', $entered_media);
        } else if (strpos($q, '.') !== false //relative link (., .:, .., ..:, .ns: etc, and :..:, :.: )
            || substr($entered_ns, 0, 1) == '~') { // ~, ~:,
            //resolve the ns based on current id
            $ns = $entered_ns;
            if($entered_ns === '~') {
                //add a random page name, otherwise it ~ or ~: are interpret as ~:start
                $ns .= 'uniqueadditionforlinksuggestplugin';
            }

            if (class_exists('dokuwiki\File\PageResolver')) {
                // Igor and later
                $resolver = new dokuwiki\File\MediaResolver($current_pageid);
                $resolved_ns = $resolver->resolveId($ns);
            } else {
                // Compatibility with older releases
                $resolved_ns = $ns;
                resolve_mediaid(getNS($current_pageid), $resolved_ns, $exists);
            }
            if($entered_ns === '~') {
                $resolved_ns = substr($resolved_ns, 0,-35); //remove : and unique string
            }

            $matchedMedias = $this->search_medias($resolved_ns, $entered_media);
        } else if ($entered_ns === false && $current_ns) { // [[xxx while current page not in root-namespace
            $matchedMedias = array_merge(
                $this->search_medias($current_ns, $entered_media), //search in current for pages
                $this->search_medias('', $entered_media)       //search in root both pgs and ns
            );
        } else {
            $matchedMedias = $this->search_medias($entered_ns, $entered_media);
        }

        $data_suggestions = [];
        foreach ($matchedMedias as $entry) {
            //a page in rootns
            if($current_ns !== '' && !$entry['ns'] && $entry['type'] === 'f') {
                $trailing = ':';
            }

            $data_suggestions[] = [
                'id' => noNS($entry['id']),
                //return literally ns what user has typed in before page name/namespace name that is suggested
                'ns' => $entered_ns . $trailing,
                'type' => $entry['type'], // d/f
                'rootns' => $entry['ns'] ? 0 : 1,
            ];
        }

        echo json_encode([
            'data' => $data_suggestions,
            'link' => ''
        ]);
    }


    protected function search_pages_upwards_both_limited($ns, $id, $pagesonly) {
        $strict = $this->search_pages_upwards($ns, $id, $pagesonly, true);
        if(count($strict) > self::MAX_RESULTS) {
            return $strict;
        }else {
        return array_merge(
            $strict,
            $this->search_pages_upwards($ns, $id, $pagesonly, false));
        }
    }
    
    protected function search_pages_both_limited($ns, $id, $pagesonly) {
        $strict = $this->search_pages($ns, $id, $pagesonly, true);
        if(count($strict) > self::MAX_RESULTS) {
            return $strict;
        }else {
        return array_merge(
            $strict,
            $this->search_pages($ns, $id, $pagesonly, false));
        }
    }
    /**
     * List available pages, and eventually namespaces
     *
     * @param string $ns namespace to search in
     * @param string $id
     * @param bool $pagesonly true: pages only, false: pages and namespaces
     * @return array
     */
    protected function search_pages($ns, $id, $pagesonly = false, $strictsearch = true) {
        global $conf;

        $data = [];
        $nsd = utf8_encodeFN(str_replace(':', '/', $ns)); //dir

        $opts = [
            'depth' => 10,
            'listfiles' => true,
            'listdirs' => !$pagesonly,
            'pagesonly' => true,
            'firsthead' => true,
            'sneakyacl' => $conf['sneaky_index'],
        ];
        // . '[^\/]*$' => makes sure it only matches if the actual namespace has a match
        $regex = $strictsearch ? '^.*\/' . $id . '[^\/]*$' : '^.*\/\w+' . $id . '[^\/]*$';
        if ($id) {
            $opts['filematch'] = $regex ;
        }
        if ($id && !$pagesonly) {
            $opts['dirmatch'] = $regex ;
        }
        search($data, $conf['datadir'], 'search_universal', $opts, $nsd);
        
        // show smaller namespaces first for a more logical order
        usort($data, function($a, $b) {
            $colonCountA = substr_count($a['id'], ':');
            $colonCountB = substr_count($b['id'], ':');
            // if equal, return original order
            return $colonCountA - $colonCountB;
        });

        return $data;
    }

    // $strictsearch = should it start with the $id (instead of just containing it)
    // This could be optimized by doing one search in the upper namespace
    // and sorting the results afterwards (with closer results first)
    function search_pages_upwards($ns, $id, $pagesonly, $strictsearch = true) {
        global $conf;

        $opts = [
            'depth' => 0,
            'listfiles' => true,
            'listdirs' => !$pagesonly,
            'pagesonly' => true,
            'firsthead' => true,
            'sneakyacl' => $conf['sneaky_index'],
        ];
        // either start with $id or contain $id (AND NOT START).
        // if you want to do a fuzzy match (both start or contains), call the function twice.
        $regex = $strictsearch ? '^.*\/' . $id : '^.*\/\w+' . $id;
        if ($id) {
            $opts['filematch'] = $regex;
        }
        if ($id && !$pagesonly) {
            $opts['dirmatch'] = $regex;
        }

        // Initialize the results array
        $results = [];
        
        // Step 1: Search in the current namespace
        $nsd = utf8_encodeFN(str_replace(':', '/', $ns)); 
        search($results, $conf['datadir'], 'search_universal', $opts, $nsd);
        
        // Step 2: Move up one level to the parent namespace and search again, until you reach the root namespace
        // Do not search in the global namespace. Always limit to at least one level deep.
        $namespace = $ns;
        while ($namespace) {
            $parentNamespace = substr($namespace, 0, strrpos($namespace, ':'));  // Get the parent namespace
            $nsd = utf8_encodeFN(str_replace(':', '/', $parentNamespace)); //dir
            if ($parentNamespace !== '' && $parentNamespace !== $namespace) {
                $searchResults = [];
                search($searchResults, $conf['datadir'], 'search_universal', $opts, $nsd);
                $results = array_merge($results, $searchResults);
                if(count($results) > 2 * self::MAX_RESULTS) {
                    break; // because there might be duplicates, break on two times the count
                }
            }
            $namespace = $parentNamespace;
        }
        
        // Step 3: Remove duplicates by filtering out results from the current namespace in higher namespace searches
        $filteredResults = $this->removeDuplicateSearchResults($results);
        return $filteredResults;
    }

    function removeDuplicateSearchResults($results) {
        // Temporary array to store already seen IDs
        $seen = [];

        // Filter the array for duplicates via the id
        $filteredResults = array_filter($results, function ($item) use (&$seen) {
            if (in_array($item['id'], $seen)) {
                return false;  // If ID is already seen, filter it out
            } else {
                $seen[] = $item['id'];  // Add the ID to the seen array
                return true;  // Keep the first occurrence
            }
        });
        return $filteredResults;
    }

    /**
     * List available media
     *
     * @param string $ns
     * @param string $id
     * @return array
     */
    protected function search_medias($ns, $id) {
        global $conf;

        $data = [];
        $nsd = utf8_encodeFN(str_replace(':', '/', $ns)); //dir

        $opts = [
            'depth' => 1,
            'listfiles' => true,
            'listdirs' => true,
            'firsthead' => true,
            'sneakyacl' => $conf['sneaky_index'],
        ];
        if ($id) {
            $opts['filematch'] = '^.*\/' . $id;
        }
        if ($id) {
            $opts['dirmatch'] = '^.*\/' . $id;
        }
        search($data, $conf['mediadir'], 'search_universal', $opts, $nsd);

        return $data;
    }

}
