(function () {
  'use strict';

  var root = document.documentElement;
  var storageKey = 'dayanruben-theme';
  var defaultTheme = root.getAttribute('data-theme-default');
  var choices = ['system', 'light', 'dark'];

  function validTheme(value) {
    return choices.indexOf(value) !== -1;
  }

  if (!validTheme(defaultTheme)) defaultTheme = 'system';

  function readPreference() {
    try {
      var saved = window.localStorage.getItem(storageKey);
      return validTheme(saved) ? saved : defaultTheme;
    } catch (error) {
      return defaultTheme;
    }
  }

  // Run before styles/content load. CSS resolves System and follows OS changes.
  var preference = readPreference();
  root.setAttribute('data-theme', preference);

  function systemTheme() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function effectiveTheme() {
    return preference === 'system' ? systemTheme() : preference;
  }

  function nextPreference() {
    if (preference === 'system') return effectiveTheme() === 'dark' ? 'light' : 'dark';
    if (preference === 'dark') return 'light';
    return 'system';
  }

  document.addEventListener('DOMContentLoaded', function () {
    var switcher = document.querySelector('.theme-switcher');
    var button = document.getElementById('theme-toggle');
    var label = document.getElementById('theme-label');

    function render() {
      root.setAttribute('data-theme', preference);
      var current = effectiveTheme();
      var next = nextPreference();
      var nextLabel = next === 'system' ? 'Follow system theme' : 'Switch to ' + next + ' theme';
      button.setAttribute('data-effective-theme', current);
      button.setAttribute('data-preference', preference);
      button.setAttribute('aria-label', nextLabel);
      button.setAttribute('title', nextLabel);
      label.textContent = preference === 'system' ? 'System theme' : preference.charAt(0).toUpperCase() + preference.slice(1) + ' theme';
    }

    button.addEventListener('click', function () {
      preference = nextPreference();
      try {
        if (preference === 'system' && defaultTheme === 'system') {
          window.localStorage.removeItem(storageKey);
        } else {
          window.localStorage.setItem(storageKey, preference);
        }
      } catch (error) {
        // The current page still works when storage is unavailable.
      }
      render();
    });

    window.addEventListener('storage', function (event) {
      if (event.key === storageKey || event.key === null) {
        preference = readPreference();
        render();
      }
    });

    if (window.matchMedia) {
      var mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      var handleSystemChange = function () {
        if (preference === 'system') render();
      };
      if (mediaQuery.addEventListener) mediaQuery.addEventListener('change', handleSystemChange);
      else if (mediaQuery.addListener) mediaQuery.addListener(handleSystemChange);
    }

    render();
    switcher.hidden = false;
  });
}());
