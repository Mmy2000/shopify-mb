function getFocusableElements(container) {
  return Array.from(
      container.querySelectorAll(
          "summary, a[href], button:enabled, [tabindex]:not([tabindex^='-']), [draggable], area, input:not([type=hidden]):enabled, select:enabled, textarea:enabled, object, iframe"
      )
  );
}

class SectionId {
  static #separator = '__';

  // for a qualified section id (e.g. 'template--22224696705326__main'), return just the section id (e.g. 'template--22224696705326')
  static parseId(qualifiedSectionId) {
    return qualifiedSectionId.split(SectionId.#separator)[0];
  }

  // for a qualified section id (e.g. 'template--22224696705326__main'), return just the section name (e.g. 'main')
  static parseSectionName(qualifiedSectionId) {
    return qualifiedSectionId.split(SectionId.#separator)[1];
  }

  // for a section id (e.g. 'template--22224696705326') and a section name (e.g. 'recommended-products'), return a qualified section id (e.g. 'template--22224696705326__recommended-products')
  static getIdForSection(sectionId, sectionName) {
    return `${sectionId}${SectionId.#separator}${sectionName}`;
  }
}

class HTMLUpdateUtility {
  /**
   * Used to swap an HTML node with a new node.
   * The new node is inserted as a previous sibling to the old node, the old node is hidden, and then the old node is removed.
   *
   * The function currently uses a double buffer approach, but this should be replaced by a view transition once it is more widely supported https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API
   */
  static viewTransition(oldNode, newContent, preProcessCallbacks = [], postProcessCallbacks = []) {
    preProcessCallbacks?.forEach((callback) => callback(newContent));

    const newNodeWrapper = document.createElement('div');
    HTMLUpdateUtility.setInnerHTML(newNodeWrapper, newContent.outerHTML);
    const newNode = newNodeWrapper.firstChild;

    // dedupe IDs
    const uniqueKey = Date.now();
    oldNode.querySelectorAll('[id], [form]').forEach((element) => {
      element.id && (element.id = `${element.id}-${uniqueKey}`);
      element.form && element.setAttribute('form', `${element.form.getAttribute('id')}-${uniqueKey}`);
    });

    oldNode.parentNode.insertBefore(newNode, oldNode);
    oldNode.style.display = 'none';

    postProcessCallbacks?.forEach((callback) => callback(newNode));

    setTimeout(() => oldNode.remove(), 500);
  }

  // Sets inner HTML and reinjects the script tags to allow execution. By default, scripts are disabled when using element.innerHTML.
  static setInnerHTML(element, html) {
    element.innerHTML = html;
    element.querySelectorAll('script').forEach((oldScriptTag) => {
      const newScriptTag = document.createElement('script');
      Array.from(oldScriptTag.attributes).forEach((attribute) => {
        newScriptTag.setAttribute(attribute.name, attribute.value);
      });
      newScriptTag.appendChild(document.createTextNode(oldScriptTag.innerHTML));
      oldScriptTag.parentNode.replaceChild(newScriptTag, oldScriptTag);
    });
  }
}

document.querySelectorAll('[id^="Details-"] summary').forEach((summary) => {
  summary.setAttribute('role', 'button');
  summary.setAttribute('aria-expanded', summary.parentNode.hasAttribute('open'));

  if(summary.nextElementSibling.getAttribute('id')) {
    summary.setAttribute('aria-controls', summary.nextElementSibling.id);
  }

  summary.addEventListener('click', (event) => {
    event.currentTarget.setAttribute('aria-expanded', !event.currentTarget.closest('details').hasAttribute('open'));
  });

  if (summary.closest('header-drawer')) return;
  summary.parentElement.addEventListener('keyup', onKeyUpEscape);
});

const trapFocusHandlers = {};

function trapFocus(container, elementToFocus = container) {
  var elements = getFocusableElements(container);
  var first = elements[0];
  var last = elements[elements.length - 1];

  removeTrapFocus();

  trapFocusHandlers.focusin = (event) => {
    if (
        event.target !== container &&
        event.target !== last &&
        event.target !== first
    )
      return;

    document.addEventListener('keydown', trapFocusHandlers.keydown);
  };

  trapFocusHandlers.focusout = function() {
    document.removeEventListener('keydown', trapFocusHandlers.keydown);
  };

  trapFocusHandlers.keydown = function(event) {
    if (event.code.toUpperCase() !== 'TAB') return; // If not TAB key
    // On the last focusable element and tab forward, focus the first element.
    if (event.target === last && !event.shiftKey) {
      event.preventDefault();
      first.focus();
    }

    //  On the first focusable element and tab backward, focus the last element.
    if (
        (event.target === container || event.target === first) &&
        event.shiftKey
    ) {
      event.preventDefault();
      last.focus();
    }
  };

  document.addEventListener('focusout', trapFocusHandlers.focusout);
  document.addEventListener('focusin', trapFocusHandlers.focusin);

  elementToFocus.focus();

  if (elementToFocus.tagName === 'INPUT' &&
      ['search', 'text', 'email', 'url'].includes(elementToFocus.type) &&
      elementToFocus.value) {
    elementToFocus.setSelectionRange(0, elementToFocus.value.length);
  }
}

// Here run the querySelector to figure out if the browser supports :focus-visible or not and run code based on it.
try {
  document.querySelector(":focus-visible");
} catch(e) {
  focusVisiblePolyfill();
}

function focusVisiblePolyfill() {
  const navKeys = ['ARROWUP', 'ARROWDOWN', 'ARROWLEFT', 'ARROWRIGHT', 'TAB', 'ENTER', 'SPACE', 'ESCAPE', 'HOME', 'END', 'PAGEUP', 'PAGEDOWN']
  let currentFocusedElement = null;
  let mouseClick = null;

  window.addEventListener('keydown', (event) => {
    if(navKeys.includes(event.code.toUpperCase())) {
      mouseClick = false;
    }
  });

  window.addEventListener('mousedown', (event) => {
    mouseClick = true;
  });

  window.addEventListener('focus', () => {
    if (currentFocusedElement) currentFocusedElement.classList.remove('focused');

    if (mouseClick) return;

    currentFocusedElement = document.activeElement;
    currentFocusedElement.classList.add('focused');

  }, true);
}

function pauseAllMedia() {
  document.querySelectorAll('.js-youtube').forEach((video) => {
    video.contentWindow.postMessage('{"event":"command","func":"' + 'pauseVideo' + '","args":""}', '*');
  });
  document.querySelectorAll('.js-vimeo').forEach((video) => {
    video.contentWindow.postMessage('{"method":"pause"}', '*');
  });
  document.querySelectorAll('video').forEach((video) => video.pause());
  document.querySelectorAll('product-model').forEach((model) => {
    if (model.modelViewerUI) model.modelViewerUI.pause();
  });
}

function removeTrapFocus(elementToFocus = null) {
  document.removeEventListener('focusin', trapFocusHandlers.focusin);
  document.removeEventListener('focusout', trapFocusHandlers.focusout);
  document.removeEventListener('keydown', trapFocusHandlers.keydown);

  if (elementToFocus) elementToFocus.focus();
}

function onKeyUpEscape(event) {
  if (event.code.toUpperCase() !== 'ESCAPE') return;

  const openDetailsElement = event.target.closest('details[open]');
  if (!openDetailsElement) return;

  const summaryElement = openDetailsElement.querySelector('summary');
  openDetailsElement.removeAttribute('open');
  summaryElement.setAttribute('aria-expanded', false);
  summaryElement.focus();
}

class QuantityInput extends HTMLElement {
  constructor() {
    super();
    this.input = this.querySelector('input');
    this.changeEvent = new Event('change', { bubbles: true });

    this.input.addEventListener('change', this.onInputChange.bind(this));
    this.querySelectorAll('button').forEach(
        (button) => button.addEventListener('click', this.onButtonClick.bind(this))
    );
  }

  quantityUpdateUnsubscriber = undefined;

  connectedCallback() {
    this.validateQtyRules();
    this.quantityUpdateUnsubscriber = subscribe(PUB_SUB_EVENTS.quantityUpdate, this.validateQtyRules.bind(this));
  }

  disconnectedCallback() {
    if (this.quantityUpdateUnsubscriber) {
      this.quantityUpdateUnsubscriber();
    }
  }

  onInputChange(event) {
    this.validateQtyRules();
  }

  onButtonClick(event) {
    event.preventDefault();
    const previousValue = this.input.value;

    event.target.name === 'plus' ? this.input.stepUp() : this.input.stepDown();
    if (previousValue !== this.input.value) this.input.dispatchEvent(this.changeEvent);
  }

  validateQtyRules() {
    const value = parseInt(this.input.value);
    if (this.input.min) {
      const min = parseInt(this.input.min);
      const buttonMinus = this.querySelector(".quantity__button[name='minus']");
      buttonMinus.classList.toggle('disabled', value <= min);
    }
    if (this.input.max) {
      const max = parseInt(this.input.max);
      const buttonPlus = this.querySelector(".quantity__button[name='plus']");
      buttonPlus.classList.toggle('disabled', value >= max);
    }
  }
}

customElements.define('quantity-input', QuantityInput);

function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

function fetchConfig(type = 'json') {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': `application/${type}` }
  };
}

/*
 * Shopify Common JS
 *
 */
if ((typeof window.Shopify) == 'undefined') {
  window.Shopify = {};
}

Shopify.bind = function(fn, scope) {
  return function() {
    return fn.apply(scope, arguments);
  }
};

Shopify.setSelectorByValue = function(selector, value) {
  for (var i = 0, count = selector.options.length; i < count; i++) {
    var option = selector.options[i];
    if (value == option.value || value == option.innerHTML) {
      selector.selectedIndex = i;
      return i;
    }
  }
};

Shopify.addListener = function(target, eventName, callback) {
  target.addEventListener ? target.addEventListener(eventName, callback, false) : target.attachEvent('on'+eventName, callback);
};

Shopify.postLink = function(path, options) {
  options = options || {};
  var method = options['method'] || 'post';
  var params = options['parameters'] || {};

  var form = document.createElement("form");
  form.setAttribute("method", method);
  form.setAttribute("action", path);

  for(var key in params) {
    var hiddenField = document.createElement("input");
    hiddenField.setAttribute("type", "hidden");
    hiddenField.setAttribute("name", key);
    hiddenField.setAttribute("value", params[key]);
    form.appendChild(hiddenField);
  }
  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
};

Shopify.CountryProvinceSelector = function(country_domid, province_domid, options) {
  this.countryEl         = document.getElementById(country_domid);
  this.provinceEl        = document.getElementById(province_domid);
  this.provinceContainer = document.getElementById(options['hideElement'] || province_domid);

  Shopify.addListener(this.countryEl, 'change', Shopify.bind(this.countryHandler,this));

  this.initCountry();
  this.initProvince();
};

Shopify.CountryProvinceSelector.prototype = {
  initCountry: function() {
    var value = this.countryEl.getAttribute('data-default');
    Shopify.setSelectorByValue(this.countryEl, value);
    this.countryHandler();
  },

  initProvince: function() {
    var value = this.provinceEl.getAttribute('data-default');
    if (value && this.provinceEl.options.length > 0) {
      Shopify.setSelectorByValue(this.provinceEl, value);
    }
  },

  countryHandler: function(e) {
    var opt       = this.countryEl.options[this.countryEl.selectedIndex];
    var raw       = opt.getAttribute('data-provinces');
    var provinces = JSON.parse(raw);

    this.clearOptions(this.provinceEl);
    if (provinces && provinces.length == 0) {
      this.provinceContainer.style.display = 'none';
    } else {
      for (var i = 0; i < provinces.length; i++) {
        var opt = document.createElement('option');
        opt.value = provinces[i][0];
        opt.innerHTML = provinces[i][1];
        this.provinceEl.appendChild(opt);
      }

      this.provinceContainer.style.display = "";
    }
  },

  clearOptions: function(selector) {
    while (selector.firstChild) {
      selector.removeChild(selector.firstChild);
    }
  },

  setOptions: function(selector, values) {
    for (var i = 0, count = values.length; i < values.length; i++) {
      var opt = document.createElement('option');
      opt.value = values[i];
      opt.innerHTML = values[i];
      selector.appendChild(opt);
    }
  }
};

class MenuDrawer extends HTMLElement {
  constructor() {
    super();

    this.mainDetailsToggle = this.querySelector('details');

    this.addEventListener('keyup', this.onKeyUp.bind(this));
    this.addEventListener('focusout', this.onFocusOut.bind(this));
    this.bindEvents();
  }

  bindEvents() {
    this.querySelectorAll('summary').forEach(summary => summary.addEventListener('click', this.onSummaryClick.bind(this)));
    // this.querySelectorAll('button:not(.localization-selector)').forEach(button => button.addEventListener('click', this.onCloseButtonClick.bind(this)));
    this.querySelectorAll(
      'button:not(.localization-selector):not(.country-selector__close-button):not(.country-filter__reset-button)'
    ).forEach((button) => button.addEventListener('click', this.onCloseButtonClick.bind(this))
    );
  }

  onKeyUp(event) {
    if(event.code.toUpperCase() !== 'ESCAPE') return;

    const openDetailsElement = event.target.closest('details[open]');
    if(!openDetailsElement) return;

    openDetailsElement === this.mainDetailsToggle ? this.closeMenuDrawer(event, this.mainDetailsToggle.querySelector('summary')) : this.closeSubmenu(openDetailsElement);
  }

  onSummaryClick(event) {
    const summaryElement = event.currentTarget;
    const detailsElement = summaryElement.parentNode;
    const parentMenuElement = detailsElement.closest('.has-submenu');
    const isOpen = detailsElement.hasAttribute('open');
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    function addTrapFocus() {
      trapFocus(summaryElement.nextElementSibling, detailsElement.querySelector('button'));
      summaryElement.nextElementSibling.removeEventListener('transitionend', addTrapFocus);
    }

    if (detailsElement === this.mainDetailsToggle) {
      if(isOpen) event.preventDefault();
      isOpen ? this.closeMenuDrawer(event, summaryElement) : this.openMenuDrawer(summaryElement);

      if (window.matchMedia('(max-width: 992px)')) {
        document.documentElement.style.setProperty('--viewport-height', `${window.innerHeight}px`);
      }
    } else {
      setTimeout(() => {
        detailsElement.classList.add('menu-opening');
        summaryElement.setAttribute('aria-expanded', true);
        parentMenuElement && parentMenuElement.classList.add('submenu-open');
        !reducedMotion || reducedMotion.matches ? addTrapFocus() : summaryElement.nextElementSibling.addEventListener('transitionend', addTrapFocus);
      }, 100);
    }
  }

  openMenuDrawer(summaryElement) {
    setTimeout(() => {
      this.mainDetailsToggle.classList.add('menu-opening');
    });
    summaryElement.setAttribute('aria-expanded', true);
    trapFocus(this.mainDetailsToggle, summaryElement);
    document.body.classList.add(`overflow-hidden-${this.dataset.breakpoint}`);
  }

  closeMenuDrawer(event, elementToFocus = false) {
    if (event === undefined) return;

    this.mainDetailsToggle.classList.remove('menu-opening');
    this.mainDetailsToggle.querySelectorAll('details').forEach(details => {
      details.removeAttribute('open');
      details.classList.remove('menu-opening');
    });
    this.mainDetailsToggle.querySelectorAll('.submenu-open').forEach(submenu => {
      submenu.classList.remove('submenu-open');
    });
    document.body.classList.remove(`overflow-hidden-${this.dataset.breakpoint}`);
    removeTrapFocus(elementToFocus);
    this.closeAnimation(this.mainDetailsToggle);
    
  }

  onFocusOut() {
    setTimeout(() => {
      if (this.mainDetailsToggle.hasAttribute('open') && !this.mainDetailsToggle.contains(document.activeElement)) this.closeMenuDrawer();
    });
  }

  onCloseButtonClick(event) {
    const detailsElement = event.currentTarget.closest('details');
    this.closeSubmenu(detailsElement);
  }

  closeSubmenu(detailsElement) {
    const parentMenuElement = detailsElement.closest('.submenu-open');
    parentMenuElement && parentMenuElement.classList.remove('submenu-open');
    detailsElement.classList.remove('menu-opening');
    detailsElement.querySelector('summary').setAttribute('aria-expanded', false);
    removeTrapFocus(detailsElement.querySelector('summary'));
    this.closeAnimation(detailsElement);
  }

  closeAnimation(detailsElement) {
    let animationStart;

    const handleAnimation = (time) => {
      if (animationStart === undefined) {
        animationStart = time;
      }

      const elapsedTime = time - animationStart;

      if (elapsedTime < 400) {
        window.requestAnimationFrame(handleAnimation);
      } else {
        detailsElement.removeAttribute('open');
        if (detailsElement.closest('details[open]')) {
          trapFocus(detailsElement.closest('details[open]'), detailsElement.querySelector('summary'));
        }
      }
    }

    window.requestAnimationFrame(handleAnimation);
  }
}

customElements.define('menu-drawer', MenuDrawer);

class HeaderDrawer extends MenuDrawer {
  constructor() {
    super();
  }

  openMenuDrawer(summaryElement) {
    this.header = this.header || document.querySelector('.section-header');
    this.borderOffset = this.borderOffset || this.closest('.header-wrapper').classList.contains('header-wrapper--border-bottom') ? 1 : 0;
    document.documentElement.style.setProperty('--header-bottom-position', `${parseInt(this.header.getBoundingClientRect().bottom - this.borderOffset)}px`);
    this.header.classList.add('menu-open');

    setTimeout(() => {
      this.mainDetailsToggle.classList.add('menu-opening');
    });

    summaryElement.setAttribute('aria-expanded', true);
    window.addEventListener('resize', this.onResize);
    trapFocus(this.mainDetailsToggle, summaryElement);
    document.body.classList.add(`overflow-hidden-${this.dataset.breakpoint}`);
  }

  closeMenuDrawer(event, elementToFocus) {
    if (!elementToFocus) return;
    super.closeMenuDrawer(event, elementToFocus);
    this.header.classList.remove('menu-open');
    window.removeEventListener('resize', this.onResize);
  }

  onResize = () => {
    this.header && document.documentElement.style.setProperty('--header-bottom-position', `${parseInt(this.header.getBoundingClientRect().bottom - this.borderOffset)}px`);
    document.documentElement.style.setProperty('--viewport-height', `${window.innerHeight}px`);
  };
}

customElements.define('header-drawer', HeaderDrawer);

class ModalDialog extends HTMLElement {
  constructor() {
    super();
    this.querySelector('[id^="ModalClose-"]').addEventListener(
        'click',
        this.hide.bind(this, false)
    );
    this.addEventListener('keyup', (event) => {
      if (event.code.toUpperCase() === 'ESCAPE') this.hide();
    });
    if (this.classList.contains('media-modal')) {
      this.addEventListener('pointerup', (event) => {
        if (event.pointerType === 'mouse' && !event.target.closest('deferred-media, product-model')) this.hide();
      });
    } else {
      this.addEventListener('click', (event) => {
        if (event.target === this) this.hide();
      });
    }
  }

  connectedCallback() {
    if (this.moved) return;
    this.moved = true;
    document.body.appendChild(this);
  }

  show(opener) {
    this.openedBy = opener;
    const popup = this.querySelector('.template-popup');
    document.body.classList.add('overflow-hidden');
    this.setAttribute('open', '');
    if (popup) popup.loadContent();
    trapFocus(this, this.querySelector('[role="dialog"]'));
    window.pauseAllMedia();
  }

  hide() {
    document.body.classList.remove('overflow-hidden');
    document.body.dispatchEvent(new CustomEvent('modalClosed'));
    this.removeAttribute('open');
    removeTrapFocus(this.openedBy);
    window.pauseAllMedia();
  }
}
customElements.define('modal-dialog', ModalDialog);

class ModalOpener extends HTMLElement {
  constructor() {
    super();

    const button = this.querySelector('button');

    if (!button) return;
    button.addEventListener('click', () => {
      const modal = document.querySelector(this.getAttribute('data-modal'));
      if (modal) modal.show(button);
    });
  }
}
customElements.define('modal-opener', ModalOpener);

class DeferredMedia extends HTMLElement {
  constructor() {
    super();
    const poster = this.querySelector('[id^="Deferred-Poster-"]');
    if (!poster) return;
    poster.addEventListener('click', this.loadContent.bind(this));
  }

  loadContent(focus = true) {
    window.pauseAllMedia();
    if (!this.getAttribute('loaded')) {
      const content = document.createElement('div');
      content.appendChild(this.querySelector('template').content.firstElementChild.cloneNode(true));

      this.setAttribute('loaded', true);
      const deferredElement = this.appendChild(content.querySelector('video, model-viewer, iframe'));
      if (focus) deferredElement.focus();
      if (deferredElement.nodeName == 'VIDEO' && deferredElement.getAttribute('autoplay')) {
        // force autoplay for safari
        deferredElement.play();
      }
    }
  }
}

customElements.define('deferred-media', DeferredMedia);


class SliderComponent extends HTMLElement {
  constructor() {
    super();
    this.slider = this.querySelector('[id^="Slider-"]');
    this.sliderItems = this.querySelectorAll('[id^="Slide-"]');
    this.enableSliderLooping = false;
    this.currentPageElement = this.querySelector('.slider-counter--current');
    this.pageTotalElement = this.querySelector('.slider-counter--total');
    this.prevButton = this.querySelector('button[name="previous"]');
    this.nextButton = this.querySelector('button[name="next"]');

    if (!this.slider || !this.nextButton) return;

    this.initPages();
    const resizeObserver = new ResizeObserver((entries) => this.initPages());
    resizeObserver.observe(this.slider);

    this.slider.addEventListener('scroll', this.update.bind(this));
    this.prevButton.addEventListener('click', this.onButtonClick.bind(this));
    this.nextButton.addEventListener('click', this.onButtonClick.bind(this));
  }

  initPages() {
    this.sliderItemsToShow = Array.from(this.sliderItems).filter((element) => element.clientWidth > 0);
    if (this.sliderItemsToShow.length < 2) return;
    this.sliderItemOffset = this.sliderItemsToShow[1].offsetLeft - this.sliderItemsToShow[0].offsetLeft;
    this.slidesPerPage = Math.floor(
      (this.slider.clientWidth - this.sliderItemsToShow[0].offsetLeft) / this.sliderItemOffset
    );
    this.totalPages = this.sliderItemsToShow.length - this.slidesPerPage + 1;
    this.update();
  }

  resetPages() {
    this.sliderItems = this.querySelectorAll('[id^="Slide-"]');
    this.initPages();
  }

  update() {
    // Temporarily prevents unneeded updates resulting from variant changes
    // This should be refactored as part of https://github.com/Shopify/dawn/issues/2057
    if (!this.slider || !this.nextButton) return;

    const previousPage = this.currentPage;
    this.currentPage = Math.round(this.slider.scrollLeft / this.sliderItemOffset) + 1;

    if (this.currentPageElement && this.pageTotalElement) {
      this.currentPageElement.textContent = this.currentPage;
      this.pageTotalElement.textContent = this.totalPages;
    }

    if (this.currentPage != previousPage) {
      this.dispatchEvent(
        new CustomEvent('slideChanged', {
          detail: {
            currentPage: this.currentPage,
            currentElement: this.sliderItemsToShow[this.currentPage - 1],
          },
        })
      );
    }

    if (this.enableSliderLooping) return;

    if (this.isSlideVisible(this.sliderItemsToShow[0]) && this.slider.scrollLeft === 0) {
      this.prevButton.setAttribute('disabled', 'disabled');
    } else {
      this.prevButton.removeAttribute('disabled');
    }

    if (this.isSlideVisible(this.sliderItemsToShow[this.sliderItemsToShow.length - 1], -1)) {
      this.nextButton.setAttribute('disabled', 'disabled');
    } else {
      this.nextButton.removeAttribute('disabled');
    }
  }

  isSlideVisible(element, offset = 0) {
    const lastVisibleSlide = this.slider.clientWidth + this.slider.scrollLeft - offset;
    return element.offsetLeft + element.clientWidth <= lastVisibleSlide && element.offsetLeft >= this.slider.scrollLeft;
  }

  onButtonClick(event) {
    event.preventDefault();
    const step = event.currentTarget.dataset.step || 1;
    this.slideScrollPosition =
      event.currentTarget.name === 'next'
        ? this.slider.scrollLeft + step * this.sliderItemOffset
        : this.slider.scrollLeft - step * this.sliderItemOffset;
    this.setSlidePosition(this.slideScrollPosition);
  }

  setSlidePosition(position) {
    this.slider.scrollTo({
      left: position,
    });
  }
}

customElements.define('slider-component', SliderComponent);

class SlideshowComponent extends SliderComponent {
  constructor() {
    super();
    this.sliderControlWrapper = this.querySelector('.slider-buttons');
    this.enableSliderLooping = true;

    if (!this.sliderControlWrapper) return;

    this.sliderFirstItemNode = this.slider ? this.slider.querySelector('.slideshow__slide') : null;
    if (!this.sliderFirstItemNode) return;

    this.sliderItemsToShow = this.slider ? Array.from(this.slider.querySelectorAll('.slideshow__slide')) : [];
    if (this.sliderItemsToShow && this.sliderItemsToShow.length > 0) {
        this.currentPage = 1;
    }

    this.sliderControlLinksArray = this.sliderControlWrapper ? Array.from(this.sliderControlWrapper.querySelectorAll('.slider-counter__link')) : [];
    this.sliderControlLinksArray.forEach(link => link.addEventListener('click', this.linkToSlide.bind(this)));
    
    if (this.slider) {
        this.slider.addEventListener('scroll', this.setSlideVisibility.bind(this));
    }
    
    this.setSlideVisibility();

    if (this.slider && this.slider.getAttribute('data-autoplay') === 'true') {
        this.setAutoPlay();
    }
    this.extraVisibleElement = 0;
    this.sliderItemsToShow.forEach(ele => {
      if (this.isElementVisible(ele)) this.extraVisibleElement++;
    });
    if (this.extraVisibleElement != 0) this.extraVisibleElement--;
  }

  setAutoPlay() {
    this.sliderAutoplayButton = this.querySelector('.slideshow__autoplay');
    this.autoplaySpeed = this.slider?.dataset.speed * 1000 || 5000; // Default to 5000 if undefined

    if (this.sliderAutoplayButton) {
        this.sliderAutoplayButton.addEventListener('click', this.autoPlayToggle.bind(this));
    }
    this.addEventListener('mouseover', this.focusInHandling.bind(this));
    this.addEventListener('mouseleave', this.focusOutHandling.bind(this));
    this.addEventListener('focusin', this.focusInHandling.bind(this));
    this.addEventListener('focusout', this.focusOutHandling.bind(this));

    this.play();
    this.autoplayButtonIsSetToPlay = true;
  }

  isElementVisible(element){
      const rect = element.getBoundingClientRect();
      const rect1 = this.getBoundingClientRect();

      return (
        rect.left >=  rect1.left &&
        rect.right <= rect1.right
      );
  }

  onButtonClick(event) {
    super.onButtonClick(event);
    const isFirstSlide = this.currentPage === 1;
    const isLastSlide = (this.currentPage + this.extraVisibleElement) === this.sliderItemsToShow.length; // custom code

    if (!isFirstSlide && !isLastSlide) return;
    if (isFirstSlide && event.currentTarget.name === 'previous') {
      this.slideScrollPosition = this.slider.scrollLeft + this.sliderFirstItemNode.clientWidth * this.sliderItemsToShow.length;
    } else if (isLastSlide && event.currentTarget.name === 'next') {
      this.slideScrollPosition = 0;
    }
    this.slider.scrollTo({
      left: this.slideScrollPosition 
    });
  }

  update() {
    super.update();
    this.sliderControlButtons = this.querySelectorAll('.slider-counter__link');
    this.prevButton.removeAttribute('disabled');

    if (!this.sliderControlButtons.length) return;

    this.sliderControlButtons.forEach(link => {
      link.classList.remove('slider-counter__link--active');
      link.removeAttribute('aria-current');
    });
    if (this.currentPage > 0 && this.currentPage <= this.sliderControlButtons.length) {
      this.sliderControlButtons[this.currentPage - 1].classList.add('slider-counter__link--active');
      this.sliderControlButtons[this.currentPage - 1].setAttribute('aria-current', true);
    }
  }

  autoPlayToggle() {
    this.togglePlayButtonState(this.autoplayButtonIsSetToPlay);
    this.autoplayButtonIsSetToPlay ? this.pause() : this.play();
    this.autoplayButtonIsSetToPlay = !this.autoplayButtonIsSetToPlay;
  }

  focusOutHandling(event) {
    const focusedOnAutoplayButton = event.target === this.sliderAutoplayButton || this.sliderAutoplayButton.contains(event.target);
    if (!this.autoplayButtonIsSetToPlay || focusedOnAutoplayButton) return;
    this.play();
  }

  focusInHandling(event) {
    const focusedOnAutoplayButton = event.target === this.sliderAutoplayButton || this.sliderAutoplayButton.contains(event.target);
    if (focusedOnAutoplayButton && this.autoplayButtonIsSetToPlay) {
      this.play();
    } else if (this.autoplayButtonIsSetToPlay) {
      this.pause();
    }
  }

  play() {
    if (this.slider) {
      this.slider.setAttribute('aria-live', 'off');
      clearInterval(this.autoplay);
      this.autoplay = setInterval(this.autoRotateSlides.bind(this), this.autoplaySpeed);
    }
  }

  pause() {
    if (this.slider) {
      this.slider.setAttribute('aria-live', 'polite');
      clearInterval(this.autoplay);
    }
  }

  togglePlayButtonState(pauseAutoplay) {
    if (this.sliderAutoplayButton) {
      if (pauseAutoplay) {
        this.sliderAutoplayButton.classList.add('slideshow__autoplay--paused');
        this.sliderAutoplayButton.setAttribute('aria-label', window.accessibilityStrings.playSlideshow);
      } else {
        this.sliderAutoplayButton.classList.remove('slideshow__autoplay--paused');
        this.sliderAutoplayButton.setAttribute('aria-label', window.accessibilityStrings.pauseSlideshow);
      }
    }
  }

  autoRotateSlides() {
    // custom code
    const slideScrollPosition = (this.currentPage + this.extraVisibleElement) === this.sliderItems.length ? 0 : this.slider.scrollLeft + this.slider.querySelector('.slideshow__slide').clientWidth;
    this.slider.scrollTo({
      left: slideScrollPosition
    });
  }

  setSlideVisibility() {
    if (!this.slider) return;
    
    this.sliderItemsToShow.forEach((item, index) => {
      const linkElements = item.querySelectorAll('a');

      if (index === this.currentPage - 1) {
        if (linkElements.length) linkElements.forEach(button => {
          button.removeAttribute('tabindex');
        });
        item.setAttribute('aria-hidden', 'false');
        item.removeAttribute('tabindex');
      } else {
        if (linkElements.length) linkElements.forEach(button => {
          button.setAttribute('tabindex', '-1');
        });
        item.setAttribute('aria-hidden', 'true');
        item.setAttribute('tabindex', '-1');
      }
    });
  }

  linkToSlide(event) {
    event.preventDefault();
    const slideScrollPosition = this.slider.scrollLeft + this.sliderFirstItemNode.clientWidth * (this.sliderControlLinksArray.indexOf(event.currentTarget) + 1 - this.currentPage);
    this.slider.scrollTo({
      left: slideScrollPosition
    });
  }
}

customElements.define('slideshow-component', SlideshowComponent);


class VariantSelects extends HTMLElement {
  constructor() {
    super();
    //this.addEventListener('change', this.onVariantChange);
  }

  connectedCallback() {
    this.addEventListener('change', (event) => {
      const target = this.getInputForEventTarget(event.target);
      this.updateSelectionMetadata(event);
      
      publish(PUB_SUB_EVENTS.optionValueSelectionChange, {
        data: {
          event,
          target,
          selectedOptionValues: this.selectedOptionValues,
        },
      });
    });
  }

  /*
  onVariantChange(event) {
    this.updateOptions();
    this.updateMasterId();
    this.updateSelectedSwatchValue(event);
    this.toggleAddButton(true, '', false);
    this.updatePickupAvailability();
    this.removeErrorMessage();
    this.updateVariantStatuses();
    this.updateVariantValue();

    if (!this.currentVariant) {
      this.toggleAddButton(true, '', true);
      this.setUnavailable();
    } else {
      if (this.dataset.layout == 'card') {
        this.updateMedia();
      }
      this.updateURL();
      this.updateVariantInput();
      this.renderProductInfo();
      this.updateShareUrl();
      this.updateCardURL();
      this.updateStockCountdown();
    }
  }
  updateVariantValue() {
    if (this.dataset.layout == 'button') {
      event.target.closest('fieldset').querySelector('legend span').innerHTML = event.target.value
    }
    if (this.dataset.layout == 'dropdown' || this.dataset.layout == 'card') {
      const legendSpan = event.target.closest('.product_form_input').querySelector('legend span');
      if (legendSpan) {
        legendSpan.innerHTML = event.target.value;
      }
    }
  }
  updateOptions() {
    this.options = Array.from(this.querySelectorAll('select, fieldset'), (element) => {
      if (element.tagName === 'SELECT') {
        return element.value;
      }
      if (element.tagName === 'FIELDSET') {
        return Array.from(element.querySelectorAll('input')).find((radio) => radio.checked)?.value;
      }
    });
  }

  updateMasterId() {
    this.currentVariant = this.getVariantData().find((variant) => {
      return !variant.options
        .map((option, index) => {
          return this.options[index] === option;
        })
        .includes(false);
    });
  }

  updateSelectedSwatchValue({ target }) {
    const { name, value, tagName } = target;

    if (tagName === 'SELECT' && target.selectedOptions.length) {
      const swatchValue = target.selectedOptions[0].dataset.optionSwatchValue;
      const selectedDropdownSwatchValue = this.querySelector(`[data-selected-dropdown-swatch="${name}"] > .swatch`);
      if (!selectedDropdownSwatchValue) return;
      if (swatchValue) {
        selectedDropdownSwatchValue.style.setProperty('--swatch--background', swatchValue);
        selectedDropdownSwatchValue.classList.remove('swatch--unavailable');
      } else {
        selectedDropdownSwatchValue.style.setProperty('--swatch--background', 'unset');
        selectedDropdownSwatchValue.classList.add('swatch--unavailable');
      }

      selectedDropdownSwatchValue.style.setProperty(
        '--swatch-focal-point',
        target.selectedOptions[0].dataset.optionSwatchFocalPoint || 'unset'
      );
    } else if (tagName === 'INPUT' && target.type === 'radio') {
      const selectedSwatchValue = this.querySelector(`[data-selected-swatch-value="${name}"]`);
      if (selectedSwatchValue) selectedSwatchValue.innerHTML = value;
    }
  }

  updateMedia(html) {
    if (!this.currentVariant) return;
    if (!this.currentVariant.featured_media) return;

    if (this.dataset.layout == 'card') {
      const card = this.closest('.card');
      const newMedia = card.querySelector(
          `[data-media-id="${this.dataset.section}-${this.dataset.product}-${this.currentVariant.featured_media.id}"]`
      );
      if (!newMedia) return;
      const modalContent = card.querySelector('.card__media');
      const newMediaModal = modalContent.querySelector( `[data-media-id="${this.currentVariant.featured_media.id}"]`);
      const parent = newMedia.parentElement;
      if (parent.firstChild == newMedia) return;
      parent.prepend(newMedia);


    } else {


      const mediaGallerySource = document.querySelector(`[id^="MediaGallery-${this.dataset.section}"] ul`);
      const mediaGalleryDestination = html.querySelector(`[id^="MediaGallery-${this.dataset.section}"] ul`);

      const refreshSourceData = () => {
        const mediaGallerySourceItems = Array.from(mediaGallerySource.querySelectorAll('li[data-media-id]'));
        const sourceSet = new Set(mediaGallerySourceItems.map((item) => item.dataset.mediaId));
        const sourceMap = new Map(mediaGallerySourceItems.map((item, index) => [item.dataset.mediaId, { item, index }]));
        return [mediaGallerySourceItems, sourceSet, sourceMap];
      };

      if (mediaGallerySource && mediaGalleryDestination) {
        let [mediaGallerySourceItems, sourceSet, sourceMap] = refreshSourceData();
        const mediaGalleryDestinationItems = Array.from(mediaGalleryDestination.querySelectorAll('li[data-media-id]'));
        const destinationSet = new Set(mediaGalleryDestinationItems.map(({ dataset }) => dataset.mediaId));
        let shouldRefresh = false;

        // add items from new data not present in DOM
        for (let i = mediaGalleryDestinationItems.length - 1; i >= 0; i--) {
          if (!sourceSet.has(mediaGalleryDestinationItems[i].dataset.mediaId)) {
            mediaGallerySource.prepend(mediaGalleryDestinationItems[i]);
            shouldRefresh = true;
          }
        }

        // remove items from DOM not present in new data
        for (let i = 0; i < mediaGallerySourceItems.length; i++) {
          if (!destinationSet.has(mediaGallerySourceItems[i].dataset.mediaId)) {
            mediaGallerySourceItems[i].remove();
            shouldRefresh = true;
          }
        }

        // refresh
        if (shouldRefresh) [mediaGallerySourceItems, sourceSet, sourceMap] = refreshSourceData();

        // if media galleries don't match, sort to match new data order
        mediaGalleryDestinationItems.forEach((destinationItem, destinationIndex) => {
          const sourceData = sourceMap.get(destinationItem.dataset.mediaId);

          if (sourceData && sourceData.index !== destinationIndex) {
            mediaGallerySource.insertBefore(
              sourceData.item,
              mediaGallerySource.querySelector(`li:nth-of-type(${destinationIndex + 1})`)
            );

            // refresh source now that it has been modified
            [mediaGallerySourceItems, sourceSet, sourceMap] = refreshSourceData();
          }
        });
      }

      if (this.currentVariant.featured_media) {
      document
        .querySelector(`[id^="MediaGallery-${this.dataset.section}"]`)
        ?.setActiveMedia?.(`${this.dataset.section}-${this.currentVariant.featured_media.id}`);
      }

      // update media modal
      const modalContent = document.querySelector(`#ProductModal-${this.dataset.section} .product-media-modal__content`);
      const newModalContent = html.querySelector(`product-modal`);
      if (modalContent && newModalContent) modalContent.innerHTML = newModalContent.innerHTML;
    }
  }

  updateCardURL() {
    if (this.dataset.layout == 'card') {
      const card = this.closest('.card');
      const modalContent = card.querySelector('.card__media');
      const productAnchor = modalContent.querySelector('a');
      const productTitle = card.querySelector('.card__heading');
      const productTitleAnchor = productTitle.querySelector('a');
      const productQuickview = card.querySelector('.js-wbquickview-link');
      let productURL = this.updateURLParameter(this.dataset.url, 'variant', this.currentVariant.id);
      productAnchor.setAttribute('href', productURL);
      productTitleAnchor.setAttribute('href', productURL);
      if (productQuickview) {
        productQuickview.setAttribute('variant-id', this.currentVariant.id);
      }
    }
  }
  updateStockCountdown() {
        if (!this.currentVariant) return;
        let productMain = this.closest('.product');
        if (productMain && productMain.querySelector('.wbstockcount') != null) {
          let variantsData = JSON.parse(productMain.querySelector('#product-variants').innerHTML);
          let stockCountdownConfig = JSON.parse(productMain.querySelector('#product-stock-countdown-config').innerHTML);
          let variant = this.currentVariant;
          let countdownWrapper = productMain.querySelector('.wbstockcount');
          if (variantsData[variant.id]['q'] > 0 && variant.inventory_management == 'shopify') {
            productMain.querySelector('.wbstockcount').classList.remove('hidden');
            productMain.querySelector('.wbstockinfo-bar').classList.remove('hidden');
            if (variantsData[variant.id]['q'] > stockCountdownConfig.limited_stock_cut_off) { // High Stock
              countdownWrapper.querySelector('.wbstockinfo').classList.remove('wbstockinfo_low', 'wbstockinfo_soon');
              countdownWrapper.querySelector('.wbstockinfo').classList.add('wbstockinfo_high');
              countdownWrapper.querySelector('.wbstockinfo').innerHTML = stockCountdownConfig.instock_message.replace('{stock_number}', variantsData[variant.id]['q']);
              countdownWrapper.querySelector('.wbstockinfo-probar').style.width = ((variantsData[variant.id]['q'] * 100) / stockCountdownConfig.max_stock) + '%';
            } else { // Low Stock
              countdownWrapper.querySelector('.wbstockinfo').classList.replace('wbstockinfo_soon', 'wbstockinfo_low');
              countdownWrapper.querySelector('.wbstockinfo').classList.add('wbstockinfo_low');
              countdownWrapper.querySelector('.wbstockinfo').innerHTML = stockCountdownConfig.limited_stock_message.replace('{stock_number}', variantsData[variant.id]['q']);
              countdownWrapper.querySelector('.wbstockinfo-probar').style.width = ((variantsData[variant.id]['q'] * 100) / stockCountdownConfig.max_stock) + '%';
            }
          } 
          else if (variantsData[variant.id]['p'] == "continue") {
            productMain.querySelector('.wbstockcount').classList.remove('hidden');
            productMain.querySelector('.wbstockinfo-bar').classList.add('hidden');
            countdownWrapper.querySelector('.wbstockinfo').classList.remove('wbstockinfo_low', 'wbstockinfo_high');
            countdownWrapper.querySelector('.wbstockinfo').classList.add('wbstockinfo_soon');
            countdownWrapper.querySelector('.wbstockinfo').innerHTML = stockCountdownConfig.continue_selling_message.replace();
          }
          else {
            productMain.querySelector('.wbstockcount').classList.add('hidden');
          }
        }
      }
  updateURLParameter(url, param, paramVal){
    var newAdditionalURL = "";
    var tempArray = url.split("?");
    var baseURL = tempArray[0];
    var additionalURL = tempArray[1];
    var temp = "";
    if (additionalURL) {
      tempArray = additionalURL.split("&");
      for (var i=0; i<tempArray.length; i++){
        if(tempArray[i].split('=')[0] != param){
          newAdditionalURL += temp + tempArray[i];
          temp = "&";
        }
      }
    }
    var rows_txt = temp + "" + param + "=" + paramVal;
    return baseURL + "?" + newAdditionalURL + rows_txt;
  }


  updateURL() {
    if (!this.currentVariant || this.dataset.updateUrl === 'false') return;
    window.history.replaceState({}, '', `${this.dataset.url}?variant=${this.currentVariant.id}`);
  }

  updateShareUrl() {
    const shareButton = document.getElementById(`Share-${this.dataset.section}`);
    if (!shareButton || !shareButton.updateUrl) return;
    shareButton.updateUrl(`${window.shopUrl}${this.dataset.url}?variant=${this.currentVariant.id}`);
  }

  updateVariantInput() {

    // Variant in Product Card
    if (this.dataset.layout == 'card') {
      const card = this.closest('.card');
      const productForms = card.querySelectorAll(`#ProductInfo-${this.dataset.section}-${this.dataset.product}`);
      productForms.forEach((productForm) => {
        const input = productForm.querySelectorAll('input[name="id"]');
        Array.from(input).forEach((element,index) =>
        {
          element.value = this.currentVariant.id;
        });
        const select = productForm.querySelectorAll('select[name="id"]');
        Array.from(select).forEach((element,index) =>
        {
          element.value = this.currentVariant.id;
        });

        const fieldsets = Array.from(this.querySelectorAll('fieldset'));
        fieldsets.forEach(function(option) {
          Array.from(option.querySelectorAll('label')).find((element) => element.classList.remove('active'));
        });
        const optionData = this.closest('.grid__item').querySelectorAll('select option');
        const regularPrice = this.closest('.grid__item').querySelector('.price .price__container .price__regular .price-item--regular');
        const saleRegularPrice = this.closest('.grid__item').querySelector('.price .price__container .price__sale .price-item--sale');
        const salePrice = this.closest('.grid__item').querySelector('.price .price__container .price__sale .price-item--regular');
        const wbunitPrice = this.closest('.grid__item').querySelector('.price .price__container .unit-price .cardunitp');
        const wbunitValue = this.closest('.grid__item').querySelector('.price .price__container .unit-price .cardunitv');
          
        const wbPercentBadge = this.closest('.grid__item').querySelector('.card__badge .percent__badge-sale');
        const wbAmountBadge = this.closest('.grid__item').querySelector('.card__badge .amount__badge-sale');
        
        optionData.forEach((data) => {
          if(data.value == this.currentVariant.id) {
            if(data.dataset.cprice != '' &&  data.dataset.price != data.dataset.cprice) {
              saleRegularPrice.innerHTML = data.dataset.price;
              salePrice.innerHTML = data.dataset.cprice;
              if(data.dataset.damount != '') {
                wbAmountBadge.innerHTML = data.dataset.damount;
                wbAmountBadge.classList.remove('hidden');
              }
              if(data.dataset.percent != '') {
                wbPercentBadge.innerHTML = data.dataset.percent;
                wbPercentBadge.classList.remove('hidden');
              }
              this.closest('.grid__item').querySelector('.price').classList.add("price--on-sale");
            }
            else {
              regularPrice.innerHTML = data.dataset.price;
              if(wbPercentBadge){
                wbPercentBadge.classList.add('hidden');
              }
              if(wbAmountBadge){
                wbAmountBadge.classList.add('hidden');
              }
              this.closest('.grid__item').querySelector('.price').classList.remove("price--on-sale");
            }
            if(data.dataset.unitprice) {
              wbunitPrice.innerHTML = data.dataset.unitprice;
              this.closest('.grid__item').querySelector('.price').classList.add("price--on-sale");
            }
            if(data.dataset.unitvalue) {
              wbunitValue.innerHTML = data.dataset.unitvalue;
              this.closest('.grid__item').querySelector('.price').classList.add("price--on-sale");
            }
          }
        });
      });
      return;
    }


    const productForms = document.querySelectorAll(
      `#product-form-${this.dataset.section}, #product-form-installment-${this.dataset.section}`
    );
    productForms.forEach((productForm) => {
      const input = productForm.querySelector('input[name="id"]');
      input.value = this.currentVariant.id;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  updateVariantStatuses() {
    const selectedOptionOneVariants = this.variantData.filter(
      (variant) => this.querySelector(':checked').value === variant.option1
    );
    const inputWrappers = [...this.querySelectorAll('.product-form__input')];
    inputWrappers.forEach((option, index) => {
      if (index === 0) return;
      const optionInputs = [...option.querySelectorAll('input[type="radio"], option')];
      const previousOptionSelected = inputWrappers[index - 1].querySelector(':checked').value;
      const availableOptionInputsValue = selectedOptionOneVariants
        .filter((variant) => variant.available && variant[`option${index}`] === previousOptionSelected)
        .map((variantOption) => variantOption[`option${index + 1}`]);
      this.setInputAvailability(optionInputs, availableOptionInputsValue);
    });
  }

  setInputAvailability(listOfOptions, listOfAvailableOptions) {
    
    listOfOptions.forEach((input) => {
      if (listOfAvailableOptions.includes(input.getAttribute('value'))) {
        input.innerText = input.getAttribute('value');
        input.classList.remove('disabled');
      } else {
        input.classList.add('disabled');
        input.innerText = window.variantStrings.unavailable_with_option.replace('[value]', input.getAttribute('value'));
      }
    });
  }

  updatePickupAvailability() {
    const pickUpAvailability = document.querySelector('pickup-availability');
    if (!pickUpAvailability) return;

    if (this.currentVariant && this.currentVariant.available) {
      pickUpAvailability.fetchAvailability(this.currentVariant.id);
    } else {
      pickUpAvailability.removeAttribute('available');
      pickUpAvailability.innerHTML = '';
    }
  }

  removeErrorMessage() {
    const section = this.closest('section');
    if (!section) return;

    const productForm = section.querySelector('product-form');
    if (productForm) productForm.handleErrorMessage();
  }

  renderProductInfo() {
    const requestedVariantId = this.currentVariant.id;
    let sectionId = this.dataset.originalSection ? this.dataset.originalSection : this.dataset.section;

    if (this.dataset.layout == 'card') {
      fetch(`${this.dataset.url}?variant=${requestedVariantId}&section_id=${this.dataset.originalSection ? this.dataset.originalSection : this.dataset.section}`)
        .then((response) => response.text())
        .then((responseText) => {
          if (this.currentVariant.id !== requestedVariantId) return;
          this.toggleAddButton(!this.currentVariant.available, window.variantStrings.soldOut);
          const html = new DOMParser().parseFromString(responseText, 'text/html');
          sectionId = `${sectionId}-${this.dataset.product}`;
          publish(PUB_SUB_EVENTS.variantChange, {data: {
              sectionId,
              html,
              variant: this.currentVariant
            }});

        })
      // this.toggleAddButton(!this.currentVariant.available, window.variantStrings.soldOut);
      return;
    }

    fetch(`${this.dataset.url}?variant=${requestedVariantId}&section_id=${this.dataset.originalSection ? this.dataset.originalSection : this.dataset.section}`)
        .then((response) => response.text())
        .then((responseText) => {
          // prevent unnecessary ui changes from abandoned selections
          if (this.currentVariant.id !== requestedVariantId) return;

          const html = new DOMParser().parseFromString(responseText, 'text/html')
          const destinations = document.querySelectorAll(`#price-${this.dataset.section}`);
          const sources = html.querySelectorAll(`#price-${this.dataset.originalSection ? this.dataset.originalSection : this.dataset.section}`);
          const skuSource = html.getElementById(`Sku-${this.dataset.originalSection ? this.dataset.originalSection : this.dataset.section}`);
          const skuDestination = document.getElementById(`Sku-${this.dataset.section}`);
          const inventorySource = html.getElementById(`Inventory-${this.dataset.originalSection ? this.dataset.originalSection : this.dataset.section}`);
          const inventoryDestination = document.getElementById(`Inventory-${this.dataset.section}`);
          const volumePricingSource = html.getElementById(
            `Volume-${this.dataset.originalSection ? this.dataset.originalSection : this.dataset.section}`
          );

          
          if (this.dataset.layout != 'card') {
            this.updateMedia(html);
          }
          const pricePerItemDestination = document.getElementById(`Price-Per-Item-${this.dataset.section}`);
          const pricePerItemSource = html.getElementById(`Price-Per-Item-${this.dataset.originalSection ? this.dataset.originalSection : this.dataset.section}`);

          const volumePricingDestination = document.getElementById(`Volume-${this.dataset.section}`);
          const qtyRules = document.getElementById(`Quantity-Rules-${this.dataset.section}`);
          const volumeNote = document.getElementById(`Volume-Note-${this.dataset.section}`);

          if (volumeNote) volumeNote.classList.remove('hidden');
          if (volumePricingDestination) volumePricingDestination.classList.remove('hidden');
          if (qtyRules) qtyRules.classList.remove('hidden');

          if (sources.length == destinations.length && sources.length != 0){
            let idx = 0;
            for(let source of sources){
              destinations[idx].innerHTML = source.innerHTML;
              idx++;
            }
          }
          if (inventorySource && inventoryDestination) inventoryDestination.innerHTML = inventorySource.innerHTML;
          if (skuSource && skuDestination) {
            skuDestination.innerHTML = skuSource.innerHTML;
            skuDestination.classList.toggle('visibility-hidden', skuSource.classList.contains('visibility-hidden'));
          }

          if (volumePricingSource && volumePricingDestination) {
            volumePricingDestination.innerHTML = volumePricingSource.innerHTML;
          }

          if (pricePerItemSource && pricePerItemDestination) {
            pricePerItemDestination.innerHTML = pricePerItemSource.innerHTML;
            pricePerItemDestination.classList.toggle('visibility-hidden', pricePerItemSource.classList.contains('visibility-hidden'));
          }

          const price = document.getElementById(`price-${this.dataset.section}`);

          if (price) price.classList.remove('hidden');

          if (inventoryDestination) inventoryDestination.classList.toggle('visibility-hidden', inventorySource.innerText === '');

          const addButtonUpdated = html.getElementById(`ProductSubmitButton-${sectionId}`);
          this.toggleAddButton(addButtonUpdated ? addButtonUpdated.hasAttribute('disabled') : true, window.variantStrings.soldOut);

          publish(PUB_SUB_EVENTS.variantChange, {data: {
              sectionId,
              html,
              variant: this.currentVariant
            }});
        });
  }

  toggleAddButton(disable = true, text, modifyClass = true) {
    // Variant in Product Card
    var selector = `product-form-${this.dataset.section}`;
    if (this.dataset.layout == 'card') {
      selector = `product-form-${this.dataset.section}-${this.dataset.product}`;
    }
    const productForm = document.getElementById(selector);

    if (!productForm) return;
    const addButton = productForm.querySelector('[name="add"]');
    const addButtonText = productForm.querySelector('[name="add"] > span');
    if (!addButton) return;

    if (disable) {
      addButton.setAttribute('disabled', 'disabled');
      if (text) addButtonText.textContent = text;
    } else {
      addButton.removeAttribute('disabled');
      addButtonText.textContent = window.variantStrings.addToCart;
    }

    if (!modifyClass) return;
  }

  setUnavailable() {

    // Variant in Product Card
    var selector = `product-form-${this.dataset.section}`;
    var priceSelector = `price-${this.dataset.section}`;
    var button = document.getElementById(`product-form-${this.dataset.section}`);
    if (this.dataset.layout == 'card') {
      selector = `product-form-${this.dataset.section}-${this.dataset.product}`;
      priceSelector = `price-${this.dataset.section}-${this.dataset.product}`;
      button = document.getElementById(`product-form-${this.dataset.section}-${this.dataset.product}`);
    }

    const addButton = button.querySelector('[name="add"]');
    const addButtonText = button.querySelector('[name="add"] > span');
    const price = document.getElementById(`price-${this.dataset.section}`);
    const inventory = document.getElementById(`Inventory-${this.dataset.section}`);
    const sku = document.getElementById(`Sku-${this.dataset.section}`);
    const pricePerItem = document.getElementById(`Price-Per-Item-${this.dataset.section}`);
    const volumeNote = document.getElementById(`Volume-Note-${this.dataset.section}`);
    const volumeTable = document.getElementById(`Volume-${this.dataset.section}`);
    const qtyRules = document.getElementById(`Quantity-Rules-${this.dataset.section}`);

    if (!addButton) return;
    addButtonText.textContent = window.variantStrings.unavailable;
    // if (price) price.classList.add('hidden');
    if (inventory) inventory.classList.add('hidden');
    if (sku) sku.classList.add('hidden');
    if (pricePerItem) pricePerItem.classList.add('hidden');
    if (volumeNote) volumeNote.classList.add('hidden');
    if (volumeTable) volumeTable.classList.add('hidden');
    if (qtyRules) qtyRules.classList.add('hidden');
  }*/

  /*
  getVariantData() {
    this.variantData = this.variantData || JSON.parse(this.querySelector('[type="application/json"]').textContent);
    return this.variantData;
  }*/

  updateSelectionMetadata({ target }) {
    const { value, tagName } = target;

    if (tagName === 'SELECT' && target.selectedOptions.length) {
      Array.from(target.options)
        .find((option) => option.getAttribute('selected'))
        .removeAttribute('selected');
      target.selectedOptions[0].setAttribute('selected', 'selected');

      const swatchValue = target.selectedOptions[0].dataset.optionSwatchValue;
      const selectedDropdownSwatchValue = target
        .closest('.product-form__input')
        ?.querySelector('[data-selected-value] > .swatch');
      if (!selectedDropdownSwatchValue) return;
      if (swatchValue) {
        selectedDropdownSwatchValue.style.setProperty('--swatch--background', swatchValue);
        selectedDropdownSwatchValue.classList.remove('swatch--unavailable');
      } else {
        selectedDropdownSwatchValue.style.setProperty('--swatch--background', 'unset');
        selectedDropdownSwatchValue.classList.add('swatch--unavailable');
      }

      selectedDropdownSwatchValue.style.setProperty(
        '--swatch-focal-point',
        target.selectedOptions[0].dataset.optionSwatchFocalPoint || 'unset'
      );
    } else if (tagName === 'INPUT' && target.type === 'radio') {
      const selectedSwatchValue = target.closest(`.product-form__input`)?.querySelector('[data-selected-value]');
      if (selectedSwatchValue) selectedSwatchValue.innerHTML = value;

      const selectedOptionGroup = target.closest(`.product-form__input`);
      if (selectedOptionGroup) {
        selectedOptionGroup?.querySelectorAll('label')?.forEach((option) => option.classList.remove('selected'));
        target.closest('label')?.classList.add('selected');
      }
    }
  }

  getInputForEventTarget(target) {
    return target.tagName === 'SELECT' ? target.selectedOptions[0] : target;
  }
  
  get selectedOptionValues() {
    return Array.from(this.querySelectorAll('select option[selected], fieldset input:checked')).map(
      ({ dataset }) => dataset.optionValueId
    );
  }
}

customElements.define('variant-selects', VariantSelects);

/*
class VariantRadios extends VariantSelects {
  constructor() {
    super();
  }

  setInputAvailability(listOfOptions, listOfAvailableOptions) {
    listOfOptions.forEach((input) => {
      if (listOfAvailableOptions.includes(input.getAttribute('value'))) {
        input.classList.remove('disabled');
      } else {
        input.classList.add('disabled');
      }
    });
  }

  updateOptions() {
    const fieldsets = Array.from(this.querySelectorAll('fieldset'));
    this.options = fieldsets.map((fieldset) => {
      return Array.from(fieldset.querySelectorAll('input')).find((radio) => radio.checked).value;
    });
  }
}

customElements.define('variant-radios', VariantRadios);*/


class ProductRecommendations extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    const handleIntersection = (entries, observer) => {
      if (!entries[0].isIntersecting) return;
      observer.unobserve(this);

      fetch(this.dataset.url)
          .then(response => response.text())
          .then(text => {
            const html = document.createElement('div');
            html.innerHTML = text;
            const recommendations = html.querySelector('product-recommendations');

            if (recommendations && recommendations.innerHTML.trim().length) {
              this.innerHTML = recommendations.innerHTML;
            }

            if (!this.querySelector('slider-component') && this.classList.contains('complementary-products')) {
              this.remove();
            }

            if (html.querySelector('.grid__item')) {
              this.classList.add('product-recommendations--loaded');
            }
          })
          .catch(e => {
            console.error(e);
          });
    }

    new IntersectionObserver(handleIntersection.bind(this), {rootMargin: '0px 0px 400px 0px'}).observe(this);
  }
}

customElements.define('product-recommendations', ProductRecommendations);

class AccountIcon extends HTMLElement {
  constructor() {
    super();

    this.icon = this.querySelector('.icon');
  }

  connectedCallback() {
    document.addEventListener('storefront:signincompleted', this.handleStorefrontSignInCompleted.bind(this));
  }

  handleStorefrontSignInCompleted(event) {
    if (event?.detail?.avatar) {
      this.icon?.replaceWith(event.detail.avatar.cloneNode());
    }
  }
}

customElements.define('account-icon', AccountIcon);

// Webi collaps
class WebiCollapse extends HTMLElement {
  constructor() {
    super();
    var col = this.getElementsByClassName("toggle");
    Array.from(col).forEach((ele) => {
      ele.setAttribute('tabindex', '0');
      var content = ele.nextElementSibling;
      var defaultOpen = ele.classList.contains("active");
      if (content && !defaultOpen) {
        content.style.height = '0px';
        content.setAttribute('data-collapsed', 'true');
      }
      ele.addEventListener("click", this.onSectionClick.bind(this));
      ele.addEventListener('keydown', this.handleKeyDown.bind(this));
    });
    
  }

  handleKeyDown(event){
    if (event.keyCode === 13) {
      this.onSectionClick(event);
    }
  }

  onSectionClick(event) {
    event.currentTarget.classList.toggle("active");
    var content = event.currentTarget.nextElementSibling;
    var isCollapsed = content.getAttribute('data-collapsed') === 'true';
    if (isCollapsed) {
      this.expandSection(content);
      content.setAttribute('data-collapsed', 'false');
    } else {
      this.collapseSection(content);
    }
  }

  expandSection(element) {
    var sectionHeight = element.scrollHeight;
    element.style.height = sectionHeight + 'px';
    element.style.visibility = 'visible';
    element.addEventListener('transitionend', () => {
      element.removeEventListener('transitionend', this.expandSection);
      element.style.height = null;
      element.style.visibility = 'visible';
    });
    element.setAttribute('data-collapsed', 'false');
  }

  collapseSection(element) {
    var sectionHeight = element.scrollHeight;
    element.style.height = sectionHeight + 'px';
    element.offsetHeight;
  
    element.style.transition = 'height 0.3s ease';
    element.style.height = '0px';
    
    element.addEventListener('transitionend', () => {
      element.removeEventListener('transitionend', this.collapseSection);
      element.style.transition = '';
      element.style.height = '0px';
      element.style.visibility = 'hidden';
    });
  
    element.setAttribute('data-collapsed', 'true');
  }
}

customElements.define('webi-collapse', WebiCollapse);


// User js
class UserPopup extends HTMLElement {
  constructor() {
    super();
    this.addEventListener('click', this.popUpClick.bind(this));
    document.addEventListener('click', this.closePopup.bind(this));
  }

  popUpClick(event) {
    event.stopPropagation();
    this.querySelector("#userdrop").classList.toggle("hidden");
  }

  closePopup(event) {
    const userPopup = this.querySelector("#userdrop");
    if (!userPopup.contains(event.target)) {
      userPopup.classList.add("hidden");
    }
  }
}

customElements.define('user-popup', UserPopup);

// Cart dropdown
class CartDrop extends HTMLElement {
  constructor() {
    super();
    this.addEventListener('click', this.popUpClick.bind(this));
    document.addEventListener('click', this.closePopup.bind(this));
  }
  popUpClick(event) {
    event.stopPropagation();
    let userPopup = this.querySelector("#cartdrop");
    if (!userPopup.contains(event.target)) {
      this.querySelector("#cartdrop").classList.toggle("hidden");
    }
  }
  closePopup(event) {
    let userPopup = this.querySelector("#cartdrop");
    if (!userPopup.contains(event.target)) {
      userPopup.classList.add("hidden");
    }
  }
}
customElements.define('cart-drop', CartDrop);


// Collection page load more
// class LoadMore extends HTMLElement {
//   constructor() {
//     super();
//     this.addEventListener('click', this.loadMoreProducts.bind(this));
//     this.next_url = document.getElementById('product-grid').dataset.nextUrl;
//     this.loadMoreBtn = this.querySelector('.button');
//   }
//   async getNextPage() {
//     try {
//       let res = await fetch(this.next_url);
//       return await res.text();
//     } catch (error) {
//       console.log(error);
//     }
//   }
//   async loadMoreProducts() {
//     const load_more_spinner = this.getElementsByClassName('load-more_spinner')[0];
//     if (this.loadMoreBtn) this.loadMoreBtn.style.display = 'none';
//     // this.style.display = 'none';
//     load_more_spinner.style.display = 'block';
//     let nextPage = await this.getNextPage();
//     const parser = new DOMParser();
//     const nextPageDoc = parser.parseFromString(nextPage, 'text/html');
//     load_more_spinner.style.display = 'none';
//     const productgrid = nextPageDoc.getElementById('product-grid');
//     const new_products = productgrid.getElementsByClassName('grid__item');
//     const new_url = productgrid.dataset.nextUrl;
//     if (new_url) {
//       if (this.loadMoreBtn) this.loadMoreBtn.style.display = 'inline-flex';
//     }
//     this.next_url = new_url;
//     for (let i = 0; i < new_products.length; i++) {
//       document.getElementById('product-grid').appendChild(new_products[i]);
//     }
//   }
// }
// customElements.define('load-more', LoadMore);

class LoadMore extends HTMLElement {
  constructor() {
    super();
    this.addEventListener('click', this.loadMoreProducts.bind(this));
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.addEventListener('keydown', this.handleKeyDown);
    this.next_url = document.getElementById('product-grid').dataset.nextUrl;
    this.loadMoreBtn = this.querySelector('.button');
  }
  handleKeyDown(e) {
    if (e.key === 'Enter' || e.keyCode === 13) {
      e.preventDefault();
      this.loadMoreProducts();
    }
  }
  async getNextPage() {
    try {
      let res = await fetch(this.next_url);
      return await res.text();
    } catch (error) {
      console.log(error);
    } 
  }
  async loadMoreProducts() {
    const load_more_spinner = this.getElementsByClassName('load-more_spinner')[0];
    if (this.loadMoreBtn) this.loadMoreBtn.style.display = 'none';
    load_more_spinner.style.display = 'block';
    let nextPage = await this.getNextPage();
    const parser = new DOMParser();
    const nextPageDoc = parser.parseFromString(nextPage, 'text/html');
    load_more_spinner.style.display = 'none';
    const productgrid = nextPageDoc.getElementById('product-grid');
    const new_products = productgrid.getElementsByClassName('grid__item');
    const temp = new_products;
    const new_url = productgrid.dataset.nextUrl;
    if (new_url) {
      if (this.loadMoreBtn) this.loadMoreBtn.style.display = 'inline-flex';
    }
    this.next_url = new_url;
    let currentIndex = 0;
    while (new_products.length > currentIndex) {
      let product = new_products[currentIndex];
      if(product.classList.contains('wbimgbnrblock')) {
        currentIndex++;
        continue;
      };
      document.getElementById('product-grid').appendChild(product);
    } 
  }
}
customElements.define('load-more', LoadMore);

// on click remove content on video
document.querySelectorAll('.banner-content-remove').forEach((close) => {
  close.addEventListener('click', (event) => {
    const parentElement = event.currentTarget.closest('.video_banner_box');
    if (parentElement) {
      parentElement.remove();
    }
  });
});

// Variant hover
class variantHover extends VariantSelects {
  constructor() { 
    super();
    /*const fieldsets = Array.from(this.querySelectorAll('fieldset label'));
    this.querySelectorAll('fieldset label').forEach((ele)=>{
      ele.addEventListener('mouseenter', this.onVariantChangeHover.bind(this));
      ele.addEventListener('click', this.onLabelClick.bind(this));
    })*/
  }

  connectedCallback() {
    this.querySelectorAll('fieldset label').forEach((ele)=> {
      ele.addEventListener('mouseenter', (event) => {
        const options = event.target.closest('fieldset');
        options.querySelectorAll('label').forEach((option) => option.classList.remove('active'));
        event.target.classList.add('active');
        const swatchInput = event.target.querySelector('input');
        swatchInput.checked = true;
        swatchInput.dispatchEvent(new Event('change', { bubbles: true }));
      });
      
      ele.addEventListener('click', (event) => {
        if (event.target.dataset.href) {
          const productInfoNode = this.closest('product-info');
          const currentVariantId = productInfoNode.productForm?.variantIdInput?.value;
          window.location.href = `${event.target.dataset.href}?variant=${currentVariantId}`;
        }
      });
    });

    this.addEventListener('change', (event) => {
      const target = this.getInputForEventTarget(event.target);
      this.updateSelectionMetadata(event);
      
      publish(PUB_SUB_EVENTS.optionValueSelectionChange, {
        data: {
          event,
          target,
          selectedOptionValues: this.selectedOptionValues,
        },
      });
    });
  }

  /*
  onLabelClick(event){
    if(event.target.dataset.href){
      window.location.href = event.target.dataset.href;
    }
  }
  setInputAvailability(listOfOptions, listOfAvailableOptions) {
    listOfOptions.forEach(input => {
      if (listOfAvailableOptions.includes(input.getAttribute('value'))) {
        input.classList.remove('disabled');
      } else {
        input.classList.add('disabled');
      }
    });
  }
  updateOptions(ele) {
    if(ele.attributes.for && this.querySelector('#'+ele.attributes.for.value)){
      this.querySelector('#'+ele.attributes.for.value).checked = true;
    }
    const fieldsets = Array.from(this.querySelectorAll('fieldset'));
    this.options = fieldsets.map((fieldset) => {
      return Array.from(fieldset.querySelectorAll('input')).find((radio) => radio.checked).value;
    });
  }
  updatelabelDataset(ele){
    let href = ele.dataset.href
    if(href.indexOf('?variant=') > -1){
      href = (href.substring(0, href.indexOf('?variant=')+9) + this.currentVariant.id)
    }else{
      href += ("?variant="+ this.currentVariant.id)
    }
    ele.dataset.href = href; 
  }
  onVariantChangeHover(event){
    //this.updateOptions(event.target);
    //this.updateMasterId();
    this.updatelabelDataset(event.target);
    this.updateMedia();
  }
  onVariantChange(){
  }*/
}
customElements.define('variant-hover', variantHover);

class ColorSwatch extends HTMLElement {
  constructor() { 
    super();
    const fieldsets = Array.from(this.querySelectorAll('fieldset label'));
    this.querySelectorAll('fieldset label').forEach((ele)=>{
      ele.addEventListener('mouseenter', this.onVariantChangeHover.bind(this));
      ele.addEventListener('click', this.onLabelClick.bind(this));
    });
  }

  onLabelClick(event){
    if (event.target.dataset.href) {
      window.location.href = this.buildRedirectUrlWithParams(event.target.dataset.href, this.currentVariant.id);
    }
  }

  buildRedirectUrlWithParams(url, variantId) {
    const params = [];

    url = url.split('?')[0];

    if (variantId) {
      params.push(`variant=${variantId}`);
    }

    return `${url}?${params.join('&')}`;
  }

  updateOptions() {
    this.options = Array.from(this.querySelectorAll('fieldset'), (element) => {
      return Array.from(element.querySelectorAll('input')).find((radio) => radio.checked)?.value;
    });
  }

  // onVariantChangeHover(event) {
  //   const currentSelectColor = event.target;
  //   const fieldsetGroup = currentSelectColor.closest("fieldset");
  //   fieldsetGroup.querySelectorAll("label").forEach(el => el.classList.remove('active'));
  //   currentSelectColor.classList.add("active");
  //   currentSelectColor.querySelector("input").checked = true;
    
  //   this.updateOptions();
  //   this.updateMasterId();
  //   this.updateVariantInput();
  //   this.updateMedia();
  // }
  onVariantChangeHover(event) {
  const currentSelectColor = event.target.closest("label");
  if (!currentSelectColor) return;
  const fieldsetGroup = currentSelectColor.closest("fieldset");
  if (!fieldsetGroup) return;
  fieldsetGroup.querySelectorAll("label").forEach(el => el.classList.remove("active"));
  currentSelectColor.classList.add("active");
  const inputEl = currentSelectColor.querySelector("input");
  if (inputEl) {
    inputEl.checked = true;
  }
  this.updateOptions?.();
  this.updateMasterId?.();
  this.updateVariantInput?.();
  this.updateMedia?.();
}


  updateVariantInput() {
    const card = this.closest('.card');
    const productForms = card.querySelectorAll(`#ProductInfo-${this.dataset.section}-${this.dataset.product}`);
    productForms.forEach((productForm) => {
      const input = productForm.querySelectorAll('input[name="id"]');
      Array.from(input).forEach((element, index) => {
        element.value = this.currentVariant?.id;
      });

      const select = productForm.querySelectorAll('select[name="id"]');
      Array.from(select).forEach((element, index) => {
        element.value = this.currentVariant.id;
      });
    });

    const optionData = this.closest('.grid__item').querySelectorAll('select option');
    const regularPrice = this.closest('.grid__item').querySelector('.price .price__container .price__regular .price-item--regular');
    const saleRegularPrice = this.closest('.grid__item').querySelector('.price .price__container .price__sale .price-item--sale');
    const salePrice = this.closest('.grid__item').querySelector('.price .price__container .price__sale .price-item--regular');
    const wbunitPrice = this.closest('.grid__item').querySelector('.price .price__container .unit-price .cardunitp');
    const wbunitValue = this.closest('.grid__item').querySelector('.price .price__container .unit-price .cardunitv');
    const wbPercentBadge = this.closest('.grid__item').querySelector('.card__badge .percent__badge-sale');
    const wbAmountBadge = this.closest('.grid__item').querySelector('.card__badge .amount__badge-sale');

    const _ = this;
    optionData.forEach((data) => {
      if (data.value == this.currentVariant.id) {
        if(data.dataset.cprice != '' &&  data.dataset.price != data.dataset.cprice) {
          saleRegularPrice.innerHTML = data.dataset.price;
          salePrice.innerHTML = data.dataset.cprice;
          if(data.dataset.damount != '' && wbAmountBadge) {
            wbAmountBadge.innerHTML = data.dataset.damount;
            wbAmountBadge.classList.remove('hidden');
          }
          if(data.dataset.percent != '' && wbPercentBadge) {
            wbPercentBadge.innerHTML = data.dataset.percent;
            wbPercentBadge.classList.remove('hidden');
          }
          if (_.closest('.grid__item').querySelector('.price').dataset.quantityPriceBreakConfig == "true") {
            _.closest('.grid__item').querySelector('.price').classList.add("price--on-sale");
          }
        } else {
          regularPrice.innerHTML = data.dataset.price;
          if(wbPercentBadge){
            wbPercentBadge.classList.add('hidden');
          }
          if(wbAmountBadge){
            wbAmountBadge.classList.add('hidden');
          }
          _.closest('.grid__item').querySelector('.price').classList.remove("price--on-sale");
        }
        if(data.dataset.unitprice && wbunitPrice) {
          wbunitPrice.innerHTML = data.dataset.unitprice;
          _.closest('.grid__item').querySelector('.price').classList.add("price--on-sale");
        }
        if(data.dataset.unitvalue && wbunitValue) {
          wbunitValue.innerHTML = data.dataset.unitvalue;
          _.closest('.grid__item').querySelector('.price').classList.add("price--on-sale");
        }
      }
    });
  }

  updateMedia() {
    if (!this.currentVariant || !this.currentVariant.featured_media) return;
    const card = this.closest('.card');
    const newMedia = card.querySelector(
        `[data-media-id="${this.dataset.section}-${this.dataset.product}-${this.currentVariant.featured_media.id}"]`
    );
    if (!newMedia) return;
    const parent = newMedia.parentElement;
    if (parent.firstChild == newMedia) return;
    parent.prepend(newMedia);
  }

  updateMasterId() {
    this.currentVariant = this.getVariantData().find((variant) => {
      return !variant.options
        .map((option, index) => {
          return this.options[index] === option;
        })
        .includes(false);
    });
  }

  getVariantData() {
    this.variantData = this.variantData || JSON.parse(this.querySelector('[type="application/json"]').textContent);
    return this.variantData;
  }
}
customElements.define('color-swatch', ColorSwatch);


// Lookbook Active outside
class LookBook extends HTMLElement {
  constructor() {
    super();
    this.querySelectorAll('div.wblookbook .wblookbtn').forEach((lookbookpoint) => {
      lookbookpoint.addEventListener('click', this.onButtonClick.bind(this));
    });
  }
  onButtonClick(blockId) {
    var blockId = event.currentTarget.dataset.blobkid;
    this.querySelectorAll('li').forEach((lookbookproduct) => {
      if(lookbookproduct.getAttribute('data-blobkid') == blockId)
        lookbookproduct.classList.add('active');
      else
        lookbookproduct.classList.remove('active');
    });
    this.querySelectorAll('div.wblookbook .wblookbtn').forEach((lookbookpoint) => {
      if(lookbookpoint.getAttribute('data-blobkid') == blockId)
         lookbookpoint.classList.add('active');
      else
         lookbookpoint.classList.remove('active');
    });
  }
}
customElements.define('look-book', LookBook);


// lookbook grid slider

document.addEventListener("DOMContentLoaded", function() {
  const lookbookComponents = document.querySelectorAll('look-book');

  lookbookComponents.forEach(function(component) {
      const lookbookButtons = component.querySelectorAll('.wblookbook');

      lookbookButtons.forEach(function(button) {
          button.addEventListener('click', function() {
              const buttonId = this.getAttribute('data-id');
              const correspondingTarget = component.querySelector(`.slider-counter__link[data-id='${buttonId}']`);

              if (correspondingTarget) {
                  correspondingTarget.click();
              }
          });
      });
  });
});

document.addEventListener('DOMContentLoaded', function() {
  function triggerSlideshowPrevButton() {
    const customPrevButton = document.querySelector('.custom__button .slider-button--prev');
    const slideshowPrevButtons = document.querySelectorAll('.slide-trigger .slider-button--prev');
    if (customPrevButton && slideshowPrevButtons.length > 0) {
      customPrevButton.addEventListener('click', function() {
        slideshowPrevButtons.forEach(button => button.click());
      });
    }
  }
  function triggerSlideshowNextButton() {
    const customNextButton = document.querySelector('.custom__button .slider-button--next');
    const slideshowNextButtons = document.querySelectorAll('.slide-trigger .slider-button--next');
    if (customNextButton && slideshowNextButtons.length > 0) {
      customNextButton.addEventListener('click', function() {
        slideshowNextButtons.forEach(button => button.click());
      });
    }
  }
  triggerSlideshowPrevButton();
  triggerSlideshowNextButton();
});

// Remove blank div js
let blankContainer = document.querySelectorAll(".header__submenu .container:not(:empty):not(:has(*)), .header__submenu .container:first-child:not(:has(.wbmenuinner))");
blankContainer.forEach(container => {
  container.remove();
});

// page scrollbar width
function updateScrollbarWidth() {
  const scrollbar = window.innerWidth - document.documentElement.clientWidth;
  document.documentElement.style.setProperty('--scrollbar-width', `${scrollbar}px`);
}
document.addEventListener('DOMContentLoaded', updateScrollbarWidth);
window.addEventListener('resize', updateScrollbarWidth);

class YouTubeVideo extends HTMLElement {
  constructor() {
    super();
    this.template = this.querySelector('template');
    this.iframeLoaded = false;

    this.observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting && !this.iframeLoaded) {
            this.loadIframe();
          }
        });
      },
      { rootMargin: '200px', threshold: 0.25 }
    );
  }

  connectedCallback() {
    this.observer.observe(this);
  }

  disconnectedCallback() {
    this.observer.disconnect();
  }

  loadIframe() {
    if (!this.template) return;

    const iframe = this.template.content.firstElementChild.cloneNode(true);
    iframe.src = iframe.dataset.src;
    iframe.setAttribute('loading', 'lazy');

    this.appendChild(iframe);
    this.iframeLoaded = true;
  }
}

customElements.define('youtube-video', YouTubeVideo);