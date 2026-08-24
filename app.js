/* Länksida – läser products.json och renderar allt i webbläsaren.
   Inga beroenden, ingen build. Redigera products.json, inte den här filen. */
(function () {
  'use strict';

  // TODO: Byt ut mot din egen endpoint för klickstatistik.
  //       Sätt till null om du inte vill mäta något alls.
  var CLICK_ENDPOINT = null; // t.ex. 'https://din-endpoint.example/klick'

  var els = {
    avatar:   document.getElementById('profile-image'),
    name:     document.getElementById('profile-name'),
    tagline:  document.getElementById('profile-tagline'),
    filters:  document.getElementById('filters'),
    list:     document.getElementById('products'),
    status:   document.getElementById('status'),
    footer:   document.getElementById('footer-note')
  };

  var state = {
    products: [],
    categories: [],
    active: 'alla'
  };

  fetch('products.json', { cache: 'no-cache' })
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(init)
    .catch(function (err) {
      console.error('Kunde inte läsa products.json:', err);
      showStatus('Kunde inte ladda produkterna just nu. Ladda om sidan.');
    });

  function init(data) {
    renderProfile(data.profile || {});

    state.categories = Array.isArray(data.categories) ? data.categories : [];
    state.products = (Array.isArray(data.products) ? data.products : [])
      .slice()
      .sort(function (a, b) {
        // Nyast först. Saknat datum hamnar sist.
        return (b.dateAdded || '').localeCompare(a.dateAdded || '');
      });

    renderFilters();
    render();
  }

  function renderProfile(profile) {
    document.title = profile.name ? profile.name + ' – mina favoriter' : document.title;

    if (profile.image) {
      els.avatar.src = profile.image;
      els.avatar.alt = profile.name ? 'Profilbild för ' + profile.name : 'Profilbild';
      els.avatar.hidden = false;
    }
    els.name.textContent = profile.name || '';
    els.tagline.textContent = profile.tagline || '';
    els.footer.textContent = profile.footerNote || '';
  }

  function renderFilters() {
    var all = [{ id: 'alla', label: 'Allt' }].concat(state.categories);

    all.forEach(function (cat) {
      // Visa bara kategorier som faktiskt har produkter.
      if (cat.id !== 'alla' && !state.products.some(function (p) { return p.category === cat.id; })) {
        return;
      }
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'filter';
      btn.dataset.category = cat.id;
      btn.textContent = cat.label || cat.id;
      btn.setAttribute('aria-pressed', String(cat.id === state.active));
      btn.addEventListener('click', function () {
        state.active = cat.id;
        updateFilterState();
        render();
      });
      els.filters.appendChild(btn);
    });
  }

  function updateFilterState() {
    var buttons = els.filters.querySelectorAll('.filter');
    Array.prototype.forEach.call(buttons, function (btn) {
      btn.setAttribute('aria-pressed', String(btn.dataset.category === state.active));
    });
  }

  function render() {
    var items = state.active === 'alla'
      ? state.products
      : state.products.filter(function (p) { return p.category === state.active; });

    els.list.textContent = '';

    if (!items.length) {
      showStatus('Inga produkter i den här kategorin än.');
      return;
    }
    hideStatus();

    var frag = document.createDocumentFragment();
    items.forEach(function (product) { frag.appendChild(buildCard(product)); });
    els.list.appendChild(frag);
  }

  function buildCard(product) {
    var li = document.createElement('li');
    li.className = 'card';

    var link = document.createElement('a');
    link.className = 'card__link';
    link.href = product.url || '#';
    link.target = '_blank';
    link.rel = 'sponsored noopener';
    link.addEventListener('click', function () { trackClick(product); });

    if (product.image) {
      var figure = document.createElement('figure');
      figure.className = 'card__figure';

      var img = document.createElement('img');
      img.className = 'card__image';
      img.src = product.image;
      img.alt = '';                 // Namnet står i texten intill.
      img.loading = 'lazy';
      img.decoding = 'async';
      img.width = 800;
      img.height = 1000;
      figure.appendChild(img);

      var label = categoryLabel(product.category);
      if (label) {
        var tag = document.createElement('figcaption');
        tag.className = 'card__tag';
        tag.textContent = label;
        figure.appendChild(tag);
      }

      link.appendChild(figure);
    }

    var body = document.createElement('div');
    body.className = 'card__body';

    var text = document.createElement('div');
    text.className = 'card__text';

    // Utan bild finns ingen etikett i bildhörnet – visa den ovanför namnet.
    if (!product.image) {
      var inlineLabel = categoryLabel(product.category);
      if (inlineLabel) {
        var inlineTag = document.createElement('p');
        inlineTag.className = 'card__tag card__tag--inline';
        inlineTag.textContent = inlineLabel;
        text.appendChild(inlineTag);
      }
    }

    var name = document.createElement('p');
    name.className = 'card__name';
    name.textContent = product.name || '';
    text.appendChild(name);

    if (product.description) {
      var desc = document.createElement('p');
      desc.className = 'card__desc';
      desc.textContent = product.description;
      text.appendChild(desc);
    }

    var cta = document.createElement('span');
    cta.className = 'card__cta';
    cta.textContent = 'Köp';

    body.appendChild(text);
    body.appendChild(cta);
    link.appendChild(body);
    li.appendChild(link);
    return li;
  }

  function categoryLabel(id) {
    for (var i = 0; i < state.categories.length; i++) {
      if (state.categories[i].id === id) return state.categories[i].label;
    }
    return id || '';
  }

  /* Klickräkning. Skickar ett litet JSON-event och struntar i svaret –
     länken ska öppnas oavsett om endpointen svarar eller inte. */
  function trackClick(product) {
    if (!CLICK_ENDPOINT) return;

    var payload = JSON.stringify({
      event: 'product_click',
      product: product.name,
      category: product.category,
      url: product.url,
      ts: new Date().toISOString()
    });

    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(CLICK_ENDPOINT, new Blob([payload], { type: 'application/json' }));
        return;
      }
      fetch(CLICK_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true
      }).catch(function () { /* tyst – klick får aldrig blockera länken */ });
    } catch (err) {
      /* tyst */
    }
  }

  function showStatus(text) {
    els.status.textContent = text;
    els.status.hidden = false;
  }

  function hideStatus() {
    els.status.hidden = true;
  }
})();
