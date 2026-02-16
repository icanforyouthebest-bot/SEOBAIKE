/**
 * SEOBAIKE Lightweight Analytics
 * Sends page view data to Supabase. < 50 lines, no dependencies.
 * Respects Do Not Track. Debounced per page per session.
 */
(function () {
  try {
    // Respect Do Not Track
    if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return;

    var path = location.pathname;
    var key = '__sb_pv_' + path;

    // Debounce: 1 view per page per session
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');

    var SUPABASE_URL = 'https://vmyrivxxibqydccurxug.supabase.co';
    var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZteXJpdnh4aWJxeWRjY3VyeHVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNDAwMjksImV4cCI6MjA4NTYxNjAyOX0.iBV-23LGdm_uKffAExgqSV34-NWoAyv8_-M_cJQZ8Gg';

    var country = (document.documentElement.getAttribute('data-cf-country') || '').substring(0, 2) || null;
    var ua = (navigator.userAgent || '').substring(0, 200);
    var referrer = document.referrer || null;

    var payload = JSON.stringify({
      path: path,
      referrer: referrer,
      user_agent: ua,
      country: country
    });

    // Use fetch with keepalive for reliability (survives page unload)
    var url = SUPABASE_URL + '/rest/v1/page_views';

    if (typeof fetch !== 'undefined') {
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'Prefer': 'return=minimal'
        },
        body: payload,
        keepalive: true
      }).catch(function () {});
    } else {
      // Fallback for older browsers
      var xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('apikey', SUPABASE_KEY);
      xhr.setRequestHeader('Authorization', 'Bearer ' + SUPABASE_KEY);
      xhr.setRequestHeader('Prefer', 'return=minimal');
      xhr.send(payload);
    }
  } catch (e) {}
})();
