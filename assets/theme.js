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

  document.addEventListener('DOMContentLoaded', function () {
    var switcher = document.querySelector('.theme-switcher');
    var button = document.getElementById('theme-toggle');
    var label = document.getElementById('theme-label');
    var options = document.getElementById('theme-options');
    var radios = options.querySelectorAll('input');

    function render() {
      root.setAttribute('data-theme', preference);
      label.textContent = preference.charAt(0).toUpperCase() + preference.slice(1);
      radios.forEach(function (radio) {
        radio.checked = radio.value === preference;
      });
    }

    function close(restoreFocus) {
      options.hidden = true;
      button.setAttribute('aria-expanded', 'false');
      if (restoreFocus) button.focus();
    }

    button.addEventListener('click', function () {
      if (!options.hidden) return close(false);
      options.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      options.querySelector('input:checked').focus();
    });

    options.addEventListener('change', function (event) {
      if (!validTheme(event.target.value)) return;
      preference = event.target.value;
      try {
        // A System selection must also override a configured light/dark default.
        if (preference === 'system' && defaultTheme === 'system') {
          window.localStorage.removeItem(storageKey);
        } else {
          window.localStorage.setItem(storageKey, preference);
        }
      } catch (error) {
        // The current page still works when storage is unavailable.
      }
      render();
      event.target.focus();
    });

    // Keep radio arrow-key navigation native; dismiss on Escape or outside focus.
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !options.hidden) {
        event.preventDefault();
        close(true);
      } else if (event.key === 'Tab' && !options.hidden) {
        window.setTimeout(function () {
          if (!switcher.contains(document.activeElement)) close(false);
        }, 0);
      }
    });
    document.addEventListener('click', function (event) {
      if (!switcher.contains(event.target)) close(false);
    });
    document.addEventListener('focusin', function (event) {
      if (!switcher.contains(event.target)) close(false);
    });
    window.addEventListener('storage', function (event) {
      if (event.key === storageKey || event.key === null) {
        preference = readPreference();
        render();
      }
    });

    render();
    switcher.hidden = false;
  });
}());
