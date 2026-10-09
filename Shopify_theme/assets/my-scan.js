if (!customElements.get('my-scan-page')) {
  customElements.define(
    'my-scan-page',
    class MyScanPage extends HTMLElement {
      constructor() {
        super();
        this.apiEndpoint = this.dataset.apiEndpoint || '';
        this.apiEndpointFallback = this.dataset.apiEndpointFallback || '';
        this.scannerInstance = null;
        this.isScanning = false;
        this.mediaStream = null;
        this.scanLoopId = null;
        
        // Supabase Configuration
        this.supabaseUrl = 'https://sdwtcrhofxkmlakegjrx.supabase.co';
        this.supabaseKey = 'sb_publishable_YSdb-XeV2b5LqHp4GODWaA_dWM4SHeN';
        this.supabaseTable = 'old_qr_submissions';
        this.supabase = null;
      }

      connectedCallback() {
        const qrParam = this.getQrParamFromUrl();
        if (qrParam) {
          this.showOldQrForm();
          return;
        }

        this.productId = this.getProductIdFromUrl();
        this.initLanding();
        this.initQrScanner();
        this.initBuyerForm();
        this.initOldQrForm();
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

        this.querySelector('[data-verify-old-qr]')?.addEventListener('click', () => {
          this.showOldQrForm();
        });
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
        this.schedulePdfPregeneration();
      }

      showInvalidView() {
        const landing = this.querySelector('[data-landing]');
        const productView = this.querySelector('[data-product-view]');
        const oldQrForm = this.querySelector('[data-old-qr-view]');
        const loading = this.querySelector('[data-loading]');
        const invalid = this.querySelector('[data-invalid-view]');
        if (landing) landing.classList.add('hidden');
        if (productView) productView.classList.add('hidden');
        if (oldQrForm) oldQrForm.classList.add('hidden');
        if (loading) loading.classList.add('hidden');
        if (invalid) invalid.classList.remove('hidden');
      }

      showOldQrForm() {
        const landing = this.querySelector('[data-landing]');
        const productView = this.querySelector('[data-product-view]');
        const oldQrForm = this.querySelector('[data-old-qr-view]');
        const loading = this.querySelector('[data-loading]');
        const invalid = this.querySelector('[data-invalid-view]');
        if (landing) landing.classList.add('hidden');
        if (productView) productView.classList.add('hidden');
        if (oldQrForm) oldQrForm.classList.remove('hidden');
        if (loading) loading.classList.add('hidden');
        if (invalid) invalid.classList.add('hidden');
      }

      getProductIdFromUrl() {
        const path = window.location.pathname;
        const match = path.match(/\/pages\/my-scan\/([^/?]+)/);
        if (match) return decodeURIComponent(match[1]);
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('id') || '';
      }

      getQrParamFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('qr') || '';
      }

      async initSupabase() {
        if (!this.supabaseUrl || !this.supabaseKey) return;
        
        try {
          const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
          this.supabase = createClient(this.supabaseUrl, this.supabaseKey);
        } catch (err) {
          console.error('Failed to initialize Supabase:', err);
        }
      }

      async fetchProductData(id) {
        if (!id) return;

        const endpoints = [this.apiEndpoint, this.apiEndpointFallback].filter(Boolean);
        if (!endpoints.length) return;

        const loadingEl = this.querySelector('.my-scan__loading');
        const errorEl = this.querySelector('.my-scan__error');

        if (loadingEl) loadingEl.classList.remove('hidden');
        if (errorEl) errorEl.classList.add('hidden');

        for (const endpoint of endpoints) {
          try {
            const url = endpoint.replace('{id}', encodeURIComponent(id));
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
            console.warn(`Endpoint failed: ${endpoint}`, err);
            continue;
          }
        }

        console.error('Failed to fetch product data: all endpoints failed');
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

        const fileInput = form.querySelector('[data-file-input]');
        const fileText = form.querySelector('[data-file-text]');
        const dropArea = form.querySelector('[data-file-drop]');
        const fileEmpty = dropArea ? dropArea.querySelector('.my-scan-buyer-info__file-empty') : null;
        const fileSelected = dropArea ? dropArea.querySelector('.my-scan-buyer-info__file-selected') : null;
        const submitBtn = form.querySelector('.my-scan-buyer-info__submit');
        const errorMsg = this.querySelector('[data-buyer-error]');
        const badge = form.closest('.my-scan-buyer-info').querySelector('.my-scan-buyer-info__invoice-badge');
        const fileRemove = form.querySelector('[data-file-remove]');

        const updateSubmitState = (hasFile) => {
          if (submitBtn) {
            submitBtn.disabled = !hasFile;
          }
          if (errorMsg) {
            errorMsg.classList.toggle('hidden', hasFile);
          }
          if (dropArea) {
            dropArea.classList.toggle('my-scan-buyer-info__file-area--uploaded', hasFile);
          }
          if (fileEmpty) {
            fileEmpty.style.display = hasFile ? 'none' : '';
          }
          if (fileSelected) {
            fileSelected.style.display = hasFile ? 'flex' : 'none';
          }
        };

        const clearFile = () => {
          if (fileInput) fileInput.value = '';
          if (fileText) fileText.textContent = '';
          updateSubmitState(false);
        };

        const resetForm = () => {
          form.reset();
          clearFile();
          if (errorMsg) errorMsg.classList.add('hidden');
          if (badge) {
            badge.textContent = 'Invoice required to submit buyer information';
            badge.style.color = '';
          }
          updateSubmitState(false);
        };

        form.addEventListener('submit', (e) => {
          e.preventDefault();
          const name = form.querySelector('#buyer-name').value.trim();
          const email = form.querySelector('#buyer-email').value.trim();
          const phone = form.querySelector('#buyer-phone').value.trim();
          const file = fileInput ? fileInput.files[0] : null;

          if (!name || !email || !phone) return;
          if (!file) {
            if (errorMsg) {
              errorMsg.classList.remove('hidden');
            }
            return;
          }

          submitBtn.disabled = true;
          submitBtn.textContent = 'Submitting...';

          if (badge) {
            badge.textContent = 'Invoice uploaded ✓';
            badge.style.color = '#10b981';
          }

          console.log('Buyer form submitted:', { name, email, phone, file });

          setTimeout(() => {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit';
            resetForm();
          }, 1500);
        });

        if (fileRemove) {
          fileRemove.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            clearFile();
          });
        }

        if (fileInput && fileText) {
          fileInput.addEventListener('change', () => {
            if (fileInput.files.length) {
              fileText.textContent = fileInput.files[0].name;
              updateSubmitState(true);
            } else {
              fileText.textContent = '';
              updateSubmitState(false);
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
              updateSubmitState(true);
            }
          });
        }

        updateSubmitState(false);
      }

      initOldQrForm() {
        const form = this.querySelector('[data-old-qr-form]');
        if (!form) return;

        const serialInput = this.querySelector('[data-old-qr-serial]');
        const nameInput = this.querySelector('[data-old-qr-name]');
        const emailInput = this.querySelector('[data-old-qr-email]');
        const phoneInput = this.querySelector('[data-old-qr-phone]');
        const photoInput = this.querySelector('[data-old-qr-photo]');
        const fileText = this.querySelector('[data-file-text]');
        const dropArea = this.querySelector('[data-file-drop]');

        if (photoInput && fileText) {
          photoInput.addEventListener('change', () => {
            if (photoInput.files.length) {
              fileText.textContent = photoInput.files[0].name;
            } else {
              fileText.textContent = 'Tap to upload photo';
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
            if (photoInput && e.dataTransfer.files.length) {
              photoInput.files = e.dataTransfer.files;
              if (fileText) fileText.textContent = e.dataTransfer.files[0].name;
            }
          });
        }

        this.querySelector('[data-old-qr-submit]')?.addEventListener('click', async (e) => {
          e.preventDefault();

          const serial = serialInput ? serialInput.value.trim() : '';
          const name = nameInput ? nameInput.value.trim() : '';
          const email = emailInput ? emailInput.value.trim() : '';
          const phone = phoneInput ? phoneInput.value.trim() : '';
          const photoFile = photoInput ? photoInput.files[0] : null;

          if (!serial || !name || !email || !phone) {
            alert('Please fill in all required fields');
            return;
          }

          const submitBtn = this.querySelector('[data-old-qr-submit]');
          submitBtn.disabled = true;
          submitBtn.textContent = 'Submitting...';

          try {
            await this.initSupabase();

            if (this.supabase) {
              let photoUrl = null;

              if (photoFile) {
                const fileExt = photoFile.name.split('.').pop();
                const fileName = `${serial}_${Date.now()}.${fileExt}`;
                const { data: uploadData, error: uploadError } = await this.supabase
                  .storage
                  .from('old_qr_photos')
                  .upload(fileName, photoFile, {
                    cacheControl: '3600',
                    upsert: false
                  });

                if (uploadError) throw uploadError;

                const { data: urlData } = this.supabase
                  .storage
                  .from('old_qr_photos')
                  .getPublicUrl(fileName);

                photoUrl = urlData.publicUrl;
              }

              const { data, error } = await this.supabase
                .from(this.supabaseTable)
                .insert([{
                  serial_number: serial,
                  customer_name: name,
                  customer_email: email,
                  customer_phone: phone,
                  photo_url: photoUrl,
                  submitted_at: new Date().toISOString()
                }]);

              if (error) throw error;

              alert('Form submitted successfully!');

              if (serialInput) serialInput.value = '';
              if (nameInput) nameInput.value = '';
              if (emailInput) emailInput.value = '';
              if (phoneInput) phoneInput.value = '';
              if (photoInput) photoInput.value = '';
              if (fileText) fileText.textContent = 'Tap to upload photo';
            } else {
              console.log('Supabase not available. Data would be submitted:', { serial, name, email, phone });
              alert('Form submitted! (Preview mode - Supabase not configured)');
            }
          } catch (err) {
            console.error('Failed to submit:', err);
            alert('Failed to submit form. Please try again.');
          } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit';
          }
        });
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

      imgToDataUrl(src) {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = img.naturalWidth;
              canvas.height = img.naturalHeight;
              canvas.getContext('2d').drawImage(img, 0, 0);
              resolve(canvas.toDataURL('image/png'));
            } catch (e) {
              reject(e);
            }
          };
          img.onerror = () => reject(new Error('Failed to load: ' + src));
          img.src = src;
        });
      }

      isIOSDevice() {
        if (typeof navigator === 'undefined') return false;
        if (navigator.userAgentData && navigator.userAgentData.platform) {
          return navigator.userAgentData.platform === 'iOS';
        }
        const ua = navigator.userAgent || '';
        const isAppleMobile = /iPhone|iPad|iPod/.test(ua);
        const isIPadOS = navigator.maxTouchPoints > 2 && /Macintosh/.test(ua);
        return isAppleMobile || isIPadOS;
      }

      preloadHtml2Canvas() {
        if (!this._html2canvasPromise) {
          this._html2canvasPromise = import('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/+esm')
            .catch((err) => {
              this._html2canvasPromise = null;
              throw err;
            });
        }
        return this._html2canvasPromise;
      }

      async shareOrDownloadPdf(pdfBytes, fileName) {
        const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
        const isIOS = this.isIOSDevice();

        if (isIOS) {
          try {
            const pdfFile = new File([pdfBytes], fileName, { type: 'application/pdf' });
            if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
              await navigator.share({ files: [pdfFile], title: fileName });
              return;
            }
          } catch (shareErr) {
            if (shareErr && shareErr.name === 'AbortError') return;
            console.warn('navigator.share failed, falling back:', shareErr);
          }
          const fallbackUrl = URL.createObjectURL(pdfBlob);
          window.open(fallbackUrl, '_blank');
          setTimeout(() => URL.revokeObjectURL(fallbackUrl), 60000);
          return;
        }

        const url = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      }

      async generateCertPdf() {
        const cert = this.querySelector('.cert');
        if (!cert) throw new Error('No certificate element');

        let qrContainer = null;
        let qrBackup = null;

        try {
          const qrCanvas = cert.querySelector('.qr canvas');
          if (qrCanvas) {
            try {
              const qrDataUrl = qrCanvas.toDataURL('image/png');
              const qrImg = document.createElement('img');
              qrImg.style.cssText = 'width:100%;height:100%;display:block';
              qrImg.alt = 'QR';
              qrImg.src = qrDataUrl;
              if (typeof qrImg.decode === 'function') {
                await qrImg.decode().catch(() => {});
              }
              qrContainer = cert.querySelector('.qr');
              qrBackup = qrContainer.innerHTML;
              qrContainer.innerHTML = '';
              qrContainer.appendChild(qrImg);
            } catch (qrErr) {
              console.warn('QR snapshot failed:', qrErr);
            }
          }

          const certImages = [...cert.querySelectorAll('img:not([src^="data:"]):not([src^="blob:"])')];
          await Promise.all(certImages.map(async (img) => {
            try {
              const dataUrl = await this.imgToDataUrl(img.src);
              img.dataset.origSrc = img.src;
              img.src = dataUrl;
            } catch (e) {
              console.warn('Could not inline image:', img.src, e);
            }
          }));

          try {
            if (document.fonts && typeof document.fonts.load === 'function') {
              await Promise.all([
                document.fonts.load('400 14px Amiri'),
                document.fonts.load('700 14px Amiri'),
                document.fonts.load('400 13px "PT Serif"'),
                document.fonts.load('700 13px "PT Serif"'),
                document.fonts.load('700 14px "Playfair Display"'),
                document.fonts.load('900 14px "Playfair Display"'),
              ]);
            }
          } catch (e) {
            console.warn('Font preload failed:', e);
          }
          await document.fonts.ready;
          await new Promise(r => setTimeout(r, 150));

          const isIOS = this.isIOSDevice();

          const { default: html2canvas } = await this.preloadHtml2Canvas();
          const canvas = await html2canvas(cert, {
            useCORS: true,
            scale: isIOS ? 1.5 : 2,
            backgroundColor: '#ece6d6',
            logging: false,
            allowTaint: false,
            imageTimeout: 15000,
            onclone: (clonedDoc) => {
              try {
                clonedDoc.querySelectorAll('.cert .cell.ar').forEach((el) => {
                  el.setAttribute('dir', 'rtl');
                  el.setAttribute('lang', 'ar');
                  el.style.direction = 'rtl';
                  el.style.unicodeBidi = 'embed';
                  el.style.fontFamily = "'Amiri', 'Noto Naskh Arabic', serif";
                });
                clonedDoc.querySelectorAll('.cert .cell.ar .value, .cert .cell.ar .label').forEach((el) => {
                  el.setAttribute('dir', 'rtl');
                  el.setAttribute('lang', 'ar');
                  el.style.direction = 'rtl';
                  el.style.unicodeBidi = 'embed';
                });
              } catch (e) { /* ignore */ }
            },
          });

          const pngBlob = await new Promise((resolve, reject) => {
            try {
              canvas.toBlob((b) => {
                if (b) resolve(b);
                else reject(new Error('canvas.toBlob returned null (canvas may be tainted)'));
              }, 'image/png');
            } catch (e) { reject(e); }
          });
          const imgBytes = await pngBlob.arrayBuffer();

          for (const img of certImages) {
            if (img.dataset.origSrc) {
              img.src = img.dataset.origSrc;
              delete img.dataset.origSrc;
            }
          }

          const pdfDoc = await PDFLib.PDFDocument.create();
          const page = pdfDoc.addPage([595.28, 841.89]);
          const { width: pageW, height: pageH } = page.getSize();

          const fitScale = Math.min(
            (pageW - 40) / canvas.width,
            (pageH - 40) / canvas.height
          );

          const pngImage = await pdfDoc.embedPng(imgBytes);
          page.drawImage(pngImage, {
            x: (pageW - canvas.width * fitScale) / 2,
            y: (pageH - canvas.height * fitScale) / 2,
            width: canvas.width * fitScale,
            height: canvas.height * fitScale,
          });

          const pdfBytes = await pdfDoc.save();
          return { pdfBytes, fileName: 'MB-Gold-Certificate.pdf' };

        } finally {
          if (qrContainer && qrBackup !== null) {
            qrContainer.innerHTML = qrBackup;
          }
          const cleanupRoot = this.querySelector('.cert');
          if (cleanupRoot) {
            for (const img of cleanupRoot.querySelectorAll('img[data-orig-src]')) {
              img.src = img.dataset.origSrc;
              delete img.dataset.origSrc;
            }
          }
        }
      }

      ensureCertPdfReady() {
        if (!this._pdfPromise) {
          this._pdfPromise = this.generateCertPdf().catch((err) => {
            this._pdfPromise = null;
            throw err;
          });
        }
        return this._pdfPromise;
      }

      schedulePdfPregeneration() {
        if (this._pdfPromise) return;
        const kick = () => {
          if (this._pdfPromise) return;
          this.ensureCertPdfReady().catch((err) => {
            console.warn('PDF pre-generation failed (will retry on click):', err);
          });
        };
        if (typeof requestIdleCallback === 'function') {
          requestIdleCallback(kick, { timeout: 2000 });
        } else {
          setTimeout(kick, 600);
        }
      }

      initCertificate() {
        const btn = this.querySelector('[data-cert-download]');
        if (!btn) return;

        if (this.productId) {
          this.preloadHtml2Canvas().catch(() => {});
        }
        const earlyPreload = () => {
          this.preloadHtml2Canvas().catch(() => {});
          this.ensureCertPdfReady().catch(() => {});
        };
        btn.addEventListener('pointerdown', earlyPreload, { once: true });
        btn.addEventListener('mouseenter', earlyPreload, { once: true });
        btn.addEventListener('touchstart', earlyPreload, { once: true, passive: true });

        btn.addEventListener('click', async () => {
          const cert = this.querySelector('.cert');
          if (!cert) return;

          const originalText = btn.textContent;
          btn.disabled = true;
          let hadError = false;

          try {
            btn.textContent = this._pdfPromise ? 'Preparing PDF...' : 'Generating PDF...';
            const { pdfBytes, fileName } = await this.ensureCertPdfReady();
            await this.shareOrDownloadPdf(pdfBytes, fileName);
          } catch (err) {
            hadError = true;
            this._pdfPromise = null;
            console.error('PDF download failed:', err);
          } finally {
            if (document.body.contains(btn)) {
              if (hadError) {
                btn.textContent = 'Download Failed';
                setTimeout(() => {
                  btn.textContent = originalText;
                  btn.disabled = false;
                }, 2000);
              } else {
                btn.textContent = originalText;
                btn.disabled = false;
              }
            }
          }
        });
      }
    }
  );
}