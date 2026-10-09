if (!customElements.get('my-scan-page')) {
  customElements.define(
    'my-scan-page',
    class MyScanPage extends HTMLElement {
      constructor() {
        super();
        this.apiEndpoint = this.dataset.apiEndpoint || '';
        this.scannerInstance = null;
        this.isScanning = false;
        this.mediaStream = null;
        this.scanLoopId = null;
      }

      connectedCallback() {
        this.productId = this.getProductIdFromUrl();
        this.initLanding();
        this.initQrScanner();
        this.initBuyerForm();
        this.initCertificate();

        if (this.productId) {
          this.showLoadingState();
          this.initMiniQr();
          this.fetchProductData(this.productId);
        } else {
          this.showLandingView();
        }
      }

      transformBackendResponse(rawData, serialNumber) {
        const d = rawData || {};
        return {
          code: serialNumber || d.product_id || '',
          description_en: d.gold_name || d.product_name || '',
          description_ar: d.gold_name || d.product_name_ar || '',
          gold_type_en: d.gold_karat ? `${d.gold_karat}K` : d.product_carat || '',
          gold_type_ar: d.gold_karat
            ? `\u0630\u0647\u0628 \u0639\u064a\u0627\u0631 ${d.gold_karat} \u0642\u0631\u0627\u0637`
            : d.product_carat_ar || '',
          weight_en: d.gold_weight ? `${d.gold_weight} gm.` : d.product_weight || '',
          weight_ar: d.gold_weight ? `${d.gold_weight} \u062c\u0631\u0627\u0645` : d.product_weight_ar || '',
          product_id: serialNumber || d.product_id || '',
          product_id_ar: serialNumber || '',
          product_name: d.gold_name || d.product_name || '',
          product_name_ar: d.gold_name || d.product_name_ar || '',
          product_weight: d.gold_weight ? `${d.gold_weight}g` : d.product_weight || '',
          product_weight_ar: d.gold_weight ? `${d.gold_weight} \u062c\u0631\u0627\u0645` : d.product_weight_ar || '',
          product_carat: d.gold_karat ? `${d.gold_karat}K` : d.product_carat || '',
          product_carat_ar: d.gold_karat
            ? `\u0630\u0647\u0628 \u0639\u064a\u0627\u0631 ${d.gold_karat} \u0642\u0631\u0627\u0637`
            : d.product_carat_ar || '',
          category_label: d.gold_category || d.category_label || 'GOLD BAR',
          badge_text: 'Au',
          header_title: d.gold_category || 'Category details',
          header_subtitle: d.gold_name || 'Category details and information',
          gold_type: d.gold_category || d.gold_type || '',
          gold_name: d.gold_name || '',
        };
      }

      initLanding() {
        const form = this.querySelector('[data-landing-form]');
        const input = this.querySelector('[data-landing-input]');

        if (form && input) {
          form.addEventListener('submit', (e) => {
            e.preventDefault();
            const value = input.value.trim();
            if (value) {
              window.location.href = `/pages/my-scan?id=${encodeURIComponent(value)}`;
            }
          });
        }
      }

      initQrScanner() {
        const scanBtn = this.querySelector('[data-landing-scan]');
        const scannerModal = this.querySelector('[data-scanner-modal]');
        const scannerClose = this.querySelector('[data-scanner-close]');

        if (!scanBtn || !scannerModal) return;

        scanBtn.addEventListener('click', () => {
          scannerModal.classList.remove('hidden');
          document.body.style.overflow = 'hidden';
          setTimeout(() => {
            this.startScanner();
          }, 400);
        });

        if (scannerClose) {
          scannerClose.addEventListener('click', () => {
            this.closeScanner();
          });
        }

        scannerModal.addEventListener('click', (e) => {
          if (e.target === scannerModal) {
            this.closeScanner();
          }
        });

        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape' && !scannerModal.classList.contains('hidden')) {
            this.closeScanner();
          }
        });
      }

      startScanner() {
        const scannerEl = this.querySelector('[data-scanner-modal]');
        const scannerResult = this.querySelector('[data-scanner-modal] .my-scan-scanner__result');
        const videoEl = scannerEl ? scannerEl.querySelector('video') : null;
        const canvasEl = scannerEl ? scannerEl.querySelector('canvas') : null;

        if (!scannerEl || !videoEl || !canvasEl || typeof jsQR === 'undefined') return;

        if (scannerResult) {
          scannerResult.textContent = '';
          scannerResult.classList.add('hidden');
        }

        if (this.scanLoopId) {
          cancelAnimationFrame(this.scanLoopId);
          this.scanLoopId = null;
        }

        if (this.mediaStream) {
          this.mediaStream.getTracks().forEach((track) => track.stop());
          this.mediaStream = null;
        }

        videoEl.style.display = 'block';

        const constraints = {
          video: {
            facingMode: { ideal: 'environment' },
            width: { min: 640, ideal: 1280 },
            height: { min: 480, ideal: 720 },
          },
          audio: false,
        };

        navigator.mediaDevices
          .getUserMedia(constraints)
          .then((stream) => {
            this.mediaStream = stream;
            videoEl.srcObject = stream;
            videoEl.play();

            const [track] = stream.getVideoTracks();
            if (track.getCapabilities().zoom) {
              try {
                track.applyConstraints({ advanced: [{ zoom: 2 }] });
              } catch (e) {}
            }

            this.isScanning = true;

            const scanCanvas = document.createElement('canvas');
            const scanCtx = scanCanvas.getContext('2d');
            const MAX_SCAN_WIDTH = 720;

            const scanFrame = () => {
              if (!this.isScanning) return;

              if (videoEl.readyState >= videoEl.HAVE_ENOUGH_DATA) {
                const vw = videoEl.videoWidth;
                const vh = videoEl.videoHeight;

                if (vw > 0 && vh > 0) {
                  const scale = Math.min(1, MAX_SCAN_WIDTH / vw);
                  const sw = Math.floor(vw * scale);
                  const sh = Math.floor(vh * scale);
                  scanCanvas.width = sw;
                  scanCanvas.height = sh;
                  scanCtx.drawImage(videoEl, 0, 0, sw, sh);

                  const imageData = scanCtx.getImageData(0, 0, sw, sh);
                  const code = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: 'attemptBoth',
                  });

                  if (code) {
                    if (scannerResult) {
                      scannerResult.textContent = code.data;
                      scannerResult.classList.remove('hidden');
                    }

                    const id = this.extractIdFromScan(code.data);
                    if (id) {
                      setTimeout(() => {
                        this.closeScanner();
                        window.location.href = `/pages/my-scan?id=${encodeURIComponent(id)}`;
                      }, 800);
                    } else {
                      setTimeout(() => this.closeScanner(), 1500);
                    }
                    return;
                  }
                }
              }

              this.scanLoopId = requestAnimationFrame(scanFrame);
            };

            scanFrame();
          })
          .catch((err) => {
            console.error('Camera access failed:', err);
            videoEl.style.display = 'none';
            if (scannerResult) {
              scannerResult.textContent = 'Unable to access camera. Please check permissions.';
              scannerResult.classList.remove('hidden');
            }
          });
      }

      closeScanner() {
        const scannerModal = this.querySelector('[data-scanner-modal]');
        if (scannerModal) scannerModal.classList.add('hidden');
        document.body.style.overflow = '';

        this.isScanning = false;

        if (this.scanLoopId) {
          cancelAnimationFrame(this.scanLoopId);
          this.scanLoopId = null;
        }

        if (this.mediaStream) {
          this.mediaStream.getTracks().forEach((track) => track.stop());
          this.mediaStream = null;
        }
      }

      extractIdFromScan(decodedText) {
        if (!decodedText) return '';
        try {
          const url = new URL(decodedText);
          const pathMatch = url.pathname.match(/\/my-scan\/([^/?]+)/);
          if (pathMatch) return decodeURIComponent(pathMatch[1]);
          return url.searchParams.get('id') || '';
        } catch {
          const pathMatch = decodedText.match(/\/my-scan\/([^/?]+)/);
          if (pathMatch) return pathMatch[1];
          return decodedText.trim();
        }
      }

      disconnectedCallback() {
        this.closeScanner();
      }

      showLandingView() {
        const landing = this.querySelector('[data-landing]');
        const productView = this.querySelector('[data-product-view]');
        const loading = this.querySelector('[data-loading]');
        const invalid = this.querySelector('[data-invalid-view]');
        if (landing) landing.classList.remove('hidden');
        if (productView) productView.classList.add('hidden');
        if (loading) loading.classList.add('hidden');
        if (invalid) invalid.classList.add('hidden');
      }

      showLoadingState() {
        const landing = this.querySelector('[data-landing]');
        const productView = this.querySelector('[data-product-view]');
        const loading = this.querySelector('[data-loading]');
        const invalid = this.querySelector('[data-invalid-view]');
        if (landing) landing.classList.add('hidden');
        if (productView) productView.classList.add('hidden');
        if (loading) loading.classList.remove('hidden');
        if (invalid) invalid.classList.add('hidden');
      }

      showProductView() {
        const landing = this.querySelector('[data-landing]');
        const productView = this.querySelector('[data-product-view]');
        const loading = this.querySelector('[data-loading]');
        const invalid = this.querySelector('[data-invalid-view]');
        if (landing) landing.classList.add('hidden');
        if (productView) productView.classList.remove('hidden');
        if (loading) loading.classList.add('hidden');
        if (invalid) invalid.classList.add('hidden');
      }

      showInvalidView() {
        const landing = this.querySelector('[data-landing]');
        const productView = this.querySelector('[data-product-view]');
        const loading = this.querySelector('[data-loading]');
        const invalid = this.querySelector('[data-invalid-view]');
        if (landing) landing.classList.add('hidden');
        if (productView) productView.classList.add('hidden');
        if (loading) loading.classList.add('hidden');
        if (invalid) invalid.classList.remove('hidden');
      }

      getProductIdFromUrl() {
        const path = window.location.pathname;
        const match = path.match(/\/pages\/my-scan\/([^/?]+)/);
        if (match) return decodeURIComponent(match[1]);
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('id') || '';
      }

      async fetchProductData(id) {
        if (!id) return;

        const BASE = 'https://halimjewelry.e-jewelry-softwarehouse.com/Sup/Get_Gold_Details';
        const urls = [
          `${BASE}?sco_mco=${encodeURIComponent(id)}`,
          `${BASE}?mco=${encodeURIComponent(id)}`
        ];

        const loadingEl = this.querySelector('.my-scan__loading');
        const errorEl = this.querySelector('.my-scan__error');

        if (loadingEl) loadingEl.classList.remove('hidden');
        if (errorEl) errorEl.classList.add('hidden');

        for (const url of urls) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            const response = await fetch(url, {
              method: 'GET',
              mode: 'cors',
              cache: 'no-cache',
              headers: { 'Accept': 'application/json' },
              signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) continue;

            const data = await response.json();

            if (data && data.success === true) {
              const transformed = this.transformBackendResponse(data, id);
              this.populateData(transformed);
              this.showProductView();
              if (loadingEl) loadingEl.classList.add('hidden');
              return;
            }
          } catch (err) {
            continue;
          }
        }

        console.error('Failed to fetch product data: both endpoints failed');
        if (loadingEl) loadingEl.classList.add('hidden');
        this.showInvalidView();
      }

      populateData(data) {
        const productMappings = {
          'data-badge-text': 'badge_text',
          'data-category-label': 'category_label',
          'data-product-name': 'product_name',
          'data-arabic-text': 'arabic_text',
          'data-product-id': 'product_id',
          'data-header-title': 'header_title',
          'data-header-subtitle': 'header_subtitle',
          'data-product-weight': 'product_weight',
          'data-product-carat': 'product_carat',
          'data-gold-type': 'gold_type',
          'data-gold-name': 'gold_name',
        };

        const arMappings = {
          'data-product-id-ar': 'product_id_ar',
          'data-product-name-ar': 'product_name_ar',
          'data-product-carat-ar': 'product_carat_ar',
          'data-product-weight-ar': 'product_weight_ar',
        };

        for (const [attr, key] of Object.entries(productMappings)) {
          this.querySelectorAll(`[${attr}]`).forEach((el) => {
            if (el && data[key] !== undefined) {
              el.textContent = data[key];
            }
          });
        }

        for (const [attr, key] of Object.entries(arMappings)) {
          this.querySelectorAll(`[${attr}]`).forEach((el) => {
            if (el && data[key] !== undefined) {
              el.textContent = data[key];
            }
          });
        }

        this.querySelectorAll('[data-cert-code]').forEach((el) => {
          el.textContent = data.code || data.product_id || '';
        });
        this.querySelectorAll('[data-cert-desc-en]').forEach((el) => {
          el.textContent = data.description_en || data.product_name || '';
        });
        this.querySelectorAll('[data-cert-desc-ar]').forEach((el) => {
          el.textContent = data.description_ar || data.product_name_ar || '';
        });
        this.querySelectorAll('[data-cert-gold-en]').forEach((el) => {
          el.textContent = data.gold_type_en || data.product_carat || '';
        });
        this.querySelectorAll('[data-cert-gold-ar]').forEach((el) => {
          el.textContent = data.gold_type_ar || data.product_carat_ar || '';
        });
        this.querySelectorAll('[data-cert-weight-en]').forEach((el) => {
          el.textContent = data.weight_en || data.product_weight || '';
        });
        this.querySelectorAll('[data-cert-weight-ar]').forEach((el) => {
          el.textContent = data.weight_ar || data.product_weight_ar || '';
        });

        this.productId = data.product_id || data.id || this.productId;
        if (!this.querySelector('[data-cert-qr-mini] canvas')) {
          this.initMiniQr();
        }
      }

      buildVerifyUrl() {
        const code = this.productId || '';
        return `${window.location.origin}/pages/my-scan?id=${encodeURIComponent(code)}`;
      }

      initBuyerForm() {
        const form = this.querySelector('[data-buyer-form]');
        if (!form) return;

        const fileInput = this.querySelector('[data-file-input]');
        const fileText = this.querySelector('[data-file-text]');
        const dropArea = this.querySelector('[data-file-drop]');

        form.addEventListener('submit', (e) => {
          e.preventDefault();
          const name = form.querySelector('#buyer-name').value.trim();
          const email = form.querySelector('#buyer-email').value.trim();
          const phone = form.querySelector('#buyer-phone').value.trim();
          const file = fileInput ? fileInput.files[0] : null;

          if (!name || !email || !phone) return;

          const submitBtn = form.querySelector('.my-scan-buyer-info__submit');
          submitBtn.disabled = true;
          submitBtn.textContent = 'Submitting...';

          console.log('Buyer form submitted:', { name, email, phone, file });

          setTimeout(() => {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit';
          }, 1500);
        });

        if (fileInput && fileText) {
          fileInput.addEventListener('change', () => {
            if (fileInput.files.length) {
              fileText.textContent = fileInput.files[0].name;
            } else {
              fileText.textContent = 'Drag & drop or click to upload';
            }
          });
        }

        if (dropArea) {
          ['dragenter', 'dragover'].forEach(evt => {
            dropArea.addEventListener(evt, (e) => {
              e.preventDefault();
              dropArea.classList.add('dragover');
            });
          });
          ['dragleave', 'drop'].forEach(evt => {
            dropArea.addEventListener(evt, (e) => {
              e.preventDefault();
              dropArea.classList.remove('dragover');
            });
          });
          dropArea.addEventListener('drop', (e) => {
            if (fileInput && e.dataTransfer.files.length) {
              fileInput.files = e.dataTransfer.files;
              if (fileText) fileText.textContent = e.dataTransfer.files[0].name;
            }
          });
        }
      }

      initMiniQr() {
        const qrContainer = this.querySelector('[data-cert-qr-mini]');
        if (!qrContainer) return;

        const qrUrl = this.buildVerifyUrl();
        qrContainer.innerHTML = '';
        if (typeof QRCode !== 'undefined') {
          new QRCode(qrContainer, {
            text: qrUrl,
            width: 280,
            height: 280,
            colorDark: '#1a1814',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.M,
          });
        }
      }

      initCertificate() {
        const btn = this.querySelector('[data-cert-download]');
        if (!btn) return;

        btn.addEventListener('click', () => {
          const cert = this.querySelector('.cert');
          if (!cert) return;

          const certStyleTag = document.querySelector('style[data-cert-styles]');
          const certCSS = certStyleTag ? certStyleTag.textContent : '';

          const clone = cert.cloneNode(true);
          const qrCanvas = cert.querySelector('.qr canvas');
          const qrCloneCanvas = clone.querySelector('.qr canvas');
          if (qrCanvas && qrCloneCanvas) {
            const img = document.createElement('img');
            img.src = qrCanvas.toDataURL('image/png');
            img.style.cssText = 'width:100%!important;height:100%!important;display:block';
            img.alt = 'QR';
            qrCloneCanvas.replaceWith(img);
          }
          const extraImg = clone.querySelector('.qr img:not([alt="QR"])');
          if (extraImg) extraImg.remove();

          const pw = window.open('', '_blank');
          if (!pw) { alert('Please allow popups to download the certificate.'); return; }

          const doc = pw.document;
          doc.open();
          doc.write([
            '<!DOCTYPE html><html><head>',
            '<meta charset="UTF-8">',
            '<meta name="viewport" content="width=794">',
            '<title>MB Gold — Certificate of Authenticity</title>',
            '<link href="https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400;1,700&family=Noto+Naskh+Arabic:wght@400;700&family=PT+Serif:wght@400;700&family=Playfair+Display:wght@700;900&subset=arabic&display=swap" rel="stylesheet">',
            '<style>',
            '@page { size: A4 portrait; margin: 0; }',
            'html, body { margin: 0; padding: 0; background: #c9c2af; -webkit-print-color-adjust: exact; print-color-adjust: exact; }',
            '.cert-wrapper { background: #c9c2af; }',
            '.cert { width: 210mm !important; height: 297mm !important; max-width: none !important; margin: 0 auto !important; box-shadow: none !important; overflow: hidden !important; }',
            '.cert .cert-bg { width: 210mm !important; height: 297mm !important; object-fit: cover !important; }',
            certCSS,
            '</style>',
            '</head><body>',
            '<div class="cert-wrapper">',
            clone.outerHTML,
            '</div>',
            '</body></html>'
          ].join(''));
          doc.close();

          pw.onload = () => {
            setTimeout(() => {
              const content = pw.document.querySelector('.cert-content');
              if (content) {
                const targetH = 1110;
                const naturalH = content.getBoundingClientRect().height;
                if (naturalH > 0 && naturalH < targetH) {
                  const scale = targetH / naturalH;
                  content.style.transformOrigin = 'top center';
                  content.style.transform = 'scale(' + scale.toFixed(4) + ')';
                  content.style.width = (100 / scale).toFixed(2) + '%';
                  content.style.marginLeft = ((1 - 1 / scale) * 50).toFixed(2) + '%';
                }
              }
              pw.print();
              pw.close();
            }, 800);
          };
        });
      }
    }
  );
}