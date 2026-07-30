/* Spadeway — storefront interactions.
   Everything here is client-side only; the cart lives in localStorage and
   checkout is deliberately a dead end. This is a mockup, not a shop. */

(function () {
  'use strict';

  var STORAGE_KEY = 'spadeway.cart.v1';
  var FREE_SHIPPING = 75;

  var grid = document.getElementById('product-grid');
  var cards = Array.prototype.slice.call(grid.querySelectorAll('.card'));
  var emptyState = document.getElementById('empty-state');
  var resultCount = document.getElementById('result-count');
  var chips = Array.prototype.slice.call(document.querySelectorAll('.chip'));
  var sortSelect = document.getElementById('sort');

  var overlay = document.getElementById('overlay');
  var drawer = document.getElementById('cart-drawer');
  var cartList = document.getElementById('cart-items');
  var cartEmpty = document.getElementById('cart-empty');
  var cartCount = document.getElementById('cart-count');
  var subtotalEl = document.getElementById('subtotal');
  var meterFill = document.getElementById('meter-fill');
  var meterText = document.getElementById('meter-text');
  var toast = document.getElementById('toast');

  /* --- catalogue read straight off the rendered markup --------------- */

  var catalogue = cards.map(function (card, index) {
    return {
      id: card.dataset.id,
      name: card.querySelector('h3').textContent.trim(),
      cat: card.dataset.cat,
      price: Number(card.dataset.price),
      rating: Number(card.dataset.rating),
      img: card.querySelector('img').getAttribute('src'),
      order: index,
      el: card
    };
  });

  var byId = {};
  catalogue.forEach(function (p) { byId[p.id] = p; });

  /* --- filtering + sorting ------------------------------------------ */

  var activeCat = 'all';

  function money(n) {
    return '$' + n.toFixed(2).replace(/\.00$/, '');
  }

  function applyFilters() {
    var shown = 0;

    catalogue.forEach(function (p) {
      var match = activeCat === 'all' || p.cat === activeCat;
      p.el.hidden = !match;
      if (match) shown++;
    });

    var mode = sortSelect.value;
    var ordered = catalogue.slice().sort(function (a, b) {
      if (mode === 'price-asc') return a.price - b.price;
      if (mode === 'price-desc') return b.price - a.price;
      if (mode === 'rating') return b.rating - a.rating;
      return a.order - b.order;
    });
    ordered.forEach(function (p) { grid.appendChild(p.el); });
    grid.appendChild(emptyState);

    emptyState.hidden = shown > 0;
    resultCount.textContent = shown + (shown === 1 ? ' product' : ' products');
  }

  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c === chip)); });
      activeCat = chip.dataset.cat;
      applyFilters();
    });
  });

  sortSelect.addEventListener('change', applyFilters);

  // Header links that jump to the grid with a category already selected.
  Array.prototype.forEach.call(document.querySelectorAll('[data-jump]'), function (link) {
    link.addEventListener('click', function () {
      var target = link.dataset.jump;
      chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c.dataset.cat === target)); });
      activeCat = target;
      applyFilters();
    });
  });

  /* --- cart state ---------------------------------------------------- */

  var cart = load();

  function load() {
    try {
      var raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!Array.isArray(raw)) return [];
      // Drop anything that no longer matches a product in the catalogue.
      return raw
        .filter(function (line) { return byId[line.id] && line.qty > 0; })
        .map(function (line) { return { id: line.id, qty: Math.min(99, Math.floor(line.qty)) }; });
    } catch (err) {
      return [];
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch (err) {
      /* private browsing — the cart just won't survive a reload */
    }
  }

  function totalItems() {
    return cart.reduce(function (n, line) { return n + line.qty; }, 0);
  }

  function subtotal() {
    return cart.reduce(function (sum, line) { return sum + byId[line.id].price * line.qty; }, 0);
  }

  function add(id) {
    var line = cart.filter(function (l) { return l.id === id; })[0];
    if (line) line.qty = Math.min(99, line.qty + 1);
    else cart.push({ id: id, qty: 1 });
    save();
    render();
  }

  function setQty(id, qty) {
    cart = cart.reduce(function (out, line) {
      if (line.id !== id) out.push(line);
      else if (qty > 0) out.push({ id: id, qty: Math.min(99, qty) });
      return out;
    }, []);
    save();
    render();
  }

  /* --- cart rendering ------------------------------------------------ */

  function render() {
    var count = totalItems();
    cartCount.textContent = String(count);
    cartCount.dataset.empty = String(count === 0);

    cartList.innerHTML = '';

    cart.forEach(function (line) {
      var p = byId[line.id];
      var li = document.createElement('li');
      li.className = 'cart-item';

      var img = document.createElement('img');
      img.src = p.img;
      img.alt = '';
      li.appendChild(img);

      var body = document.createElement('div');

      var h3 = document.createElement('h3');
      h3.textContent = p.name;
      body.appendChild(h3);

      var price = document.createElement('p');
      price.className = 'line-price';
      price.textContent = money(p.price) + ' each';
      body.appendChild(price);

      var foot = document.createElement('div');
      foot.className = 'cart-item-foot';

      var qty = document.createElement('div');
      qty.className = 'qty';

      var minus = document.createElement('button');
      minus.type = 'button';
      minus.textContent = '−';
      minus.setAttribute('aria-label', 'Decrease quantity of ' + p.name);
      minus.addEventListener('click', function () { setQty(p.id, line.qty - 1); });

      var num = document.createElement('span');
      num.textContent = String(line.qty);

      var plus = document.createElement('button');
      plus.type = 'button';
      plus.textContent = '+';
      plus.setAttribute('aria-label', 'Increase quantity of ' + p.name);
      plus.addEventListener('click', function () { setQty(p.id, line.qty + 1); });

      qty.appendChild(minus);
      qty.appendChild(num);
      qty.appendChild(plus);
      foot.appendChild(qty);

      var remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'remove';
      remove.textContent = 'Remove';
      remove.setAttribute('aria-label', 'Remove ' + p.name + ' from cart');
      remove.addEventListener('click', function () { setQty(p.id, 0); });
      foot.appendChild(remove);

      body.appendChild(foot);
      li.appendChild(body);
      cartList.appendChild(li);
    });

    cartEmpty.hidden = cart.length > 0;

    var total = subtotal();
    subtotalEl.textContent = money(total);

    var pct = Math.min(100, (total / FREE_SHIPPING) * 100);
    meterFill.style.width = pct + '%';
    meterText.textContent = total >= FREE_SHIPPING
      ? 'Nice — this order ships free.'
      : money(FREE_SHIPPING - total) + ' away from free shipping.';
  }

  /* --- drawer -------------------------------------------------------- */

  var lastFocus = null;

  function openDrawer() {
    lastFocus = document.activeElement;
    drawer.dataset.open = 'true';
    overlay.dataset.open = 'true';
    drawer.removeAttribute('aria-hidden');
    document.body.style.overflow = 'hidden';
    drawer.querySelector('.drawer-close').focus();
  }

  function closeDrawer() {
    drawer.dataset.open = 'false';
    overlay.dataset.open = 'false';
    drawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }

  document.getElementById('cart-button').addEventListener('click', openDrawer);
  drawer.querySelector('.drawer-close').addEventListener('click', closeDrawer);
  overlay.addEventListener('click', closeDrawer);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && drawer.dataset.open === 'true') closeDrawer();
  });

  /* --- add to cart --------------------------------------------------- */

  var toastTimer;

  function flash(message) {
    toast.textContent = message;
    toast.dataset.show = 'true';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.dataset.show = 'false'; }, 2200);
  }

  grid.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-add]');
    if (!btn) return;
    var id = btn.dataset.add;
    add(id);
    flash(byId[id].name + ' added to cart');
  });

  document.getElementById('checkout').addEventListener('click', function () {
    flash('This is a design mockup — there is no checkout.');
  });

  /* --- newsletter ---------------------------------------------------- */

  var signup = document.getElementById('signup');
  signup.addEventListener('submit', function (e) {
    e.preventDefault();
    var status = document.getElementById('signup-status');
    var email = signup.querySelector('input').value.trim();
    status.textContent = email
      ? 'Thanks — this is a mockup, so nothing was actually sent.'
      : 'Enter an email address first.';
    if (email) signup.reset();
  });

  /* --- go ------------------------------------------------------------ */

  applyFilters();
  render();
})();
