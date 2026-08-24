/**
 * FaceGuard AI — Frontend JavaScript Library
 * Pure Vanilla JavaScript for Webcam Access, Image Upload Previews, and Interactive UI
 * 
 * BACKEND NOTE:
 * In a production Django environment:
 * - Image Uploads are sent to Django views via standard POST form with {% csrf_token %}
 * - Live webcam snapshots are sent as Base64 strings or Blob payloads to a Django API endpoint
 * - OpenCV detects faces and TensorFlow/Keras runs the mask classification model on the server
 */

document.addEventListener('DOMContentLoaded', () => {
  initImageUploadPreview();
  initWebcamSystem();
  initHistoryFilters();
  initDemoPresets();
});

/* ==========================================================================
   1. IMAGE DETECTION & PREVIEW HANDLER (FileReader API)
   ========================================================================== */
function initImageUploadPreview() {
  const dropzone = document.getElementById('uploadDropzone');
  const fileInput = document.getElementById('imageFileInput');
  const previewContainer = document.getElementById('imagePreviewContainer');
  const previewImage = document.getElementById('imagePreview');
  const analyzeBtn = document.getElementById('analyzeImageBtn');
  const resetBtn = document.getElementById('resetImageBtn');
  const uploadPrompt = document.getElementById('uploadPrompt');
  const uploadErrorAlert = document.getElementById('uploadErrorAlert');
  const errorMessageText = document.getElementById('errorMessageText');

  if (!fileInput || !dropzone) return;

  // Allowed MIME types
  const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  const maxFileSizeMB = 10;

  // Click on dropzone triggers hidden file input
  dropzone.addEventListener('click', (e) => {
    if (e.target.closest('#resetImageBtn') || e.target.closest('#analyzeImageBtn')) return;
    fileInput.click();
  });

  // Drag and Drop Event Listeners
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      handleImageSelection(files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (fileInput.files && fileInput.files[0]) {
      handleImageSelection(fileInput.files[0]);
    }
  });

  function handleImageSelection(file) {
    hideError();

    // 1. Validate File Type
    if (!validImageTypes.includes(file.type)) {
      showError('Invalid file format. Please upload a JPG, JPEG, or PNG image.');
      return;
    }

    // 2. Validate File Size
    if (file.size > maxFileSizeMB * 1024 * 1024) {
      showError(`File is too large (${(file.size / (1024*1024)).toFixed(1)}MB). Maximum allowed size is ${maxFileSizeMB}MB.`);
      return;
    }

    // 3. Read image and render preview using FileReader
    const reader = new FileReader();
    reader.onload = (event) => {
      if (previewImage) {
        previewImage.src = event.target.result;
      }
      if (uploadPrompt) uploadPrompt.classList.add('d-none');
      if (previewContainer) previewContainer.classList.remove('d-none');
      if (analyzeBtn) analyzeBtn.removeAttribute('disabled');
    };
    reader.readAsDataURL(file);
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      fileInput.value = '';
      if (previewImage) previewImage.src = '';
      if (previewContainer) previewContainer.classList.add('d-none');
      if (uploadPrompt) uploadPrompt.classList.remove('d-none');
      if (analyzeBtn) analyzeBtn.setAttribute('disabled', 'true');
      hideError();
    });
  }

  function showError(msg) {
    if (uploadErrorAlert && errorMessageText) {
      errorMessageText.textContent = msg;
      uploadErrorAlert.classList.remove('d-none');
    }
  }

  function hideError() {
    if (uploadErrorAlert) {
      uploadErrorAlert.classList.add('d-none');
    }
  }
}

/* ==========================================================================
   2. WEBCAM STREAM & FRAME CAPTURE HANDLER
   ========================================================================== */
let videoStream = null;
let liveScanTimer = null;
let liveScanBusy = false;

function initWebcamSystem() {
  const videoElement = document.getElementById('webcamFeed');
  const canvasElement = document.getElementById('webcamCanvas');
  const startCameraBtn = document.getElementById('startCameraBtn');
  const stopCameraBtn = document.getElementById('stopCameraBtn');
  const captureFrameBtn = document.getElementById('captureFrameBtn');
  const cameraPlaceholder = document.getElementById('cameraPlaceholder');
  const cameraStatusBadge = document.getElementById('cameraStatusBadge');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const permissionError = document.getElementById('cameraPermissionError');
  const capturedSnapshotCard = document.getElementById('capturedSnapshotCard');
  const capturedImagePreview = document.getElementById('capturedImagePreview');
  const capturedDataInput = document.getElementById('capturedImageBase64');
  const liveAnalyzeBtn = document.getElementById('liveAnalyzeBtn');
  const resultCard = document.getElementById('liveResultCard');
  const resultStatus = document.getElementById('liveResultStatus');
  const emptyState = document.getElementById('liveEmptyState');
  const predictionOutput = document.getElementById('livePredictionOutput');
  const predictionBanner = document.getElementById('livePredictionBanner');
  const predictionText = document.getElementById('livePredictionText');
  const confidenceText = document.getElementById('liveConfidenceText');
  const latencyText = document.getElementById('liveLatencyText');
  const scanMessage = document.getElementById('liveScanMessage');

  if (!startCameraBtn || !videoElement) return;

  // Start Camera Stream
  startCameraBtn.addEventListener('click', async () => {
    try {
      if (permissionError) permissionError.classList.add('d-none');

      // Request user media (Webcam)
      videoStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: false
      });

      videoElement.srcObject = videoStream;
      await videoElement.play();

      // UI State Updates
      if (cameraPlaceholder) cameraPlaceholder.classList.add('d-none');
      videoElement.classList.remove('d-none');
      if (startCameraBtn) startCameraBtn.classList.add('d-none');
      if (stopCameraBtn) stopCameraBtn.classList.remove('d-none');
      if (captureFrameBtn) captureFrameBtn.removeAttribute('disabled');

      if (statusDot) statusDot.classList.add('active');
      if (statusText) statusText.textContent = 'Camera LIVE';
      startLiveScanning();

    } catch (err) {
      console.error('Webcam Access Error:', err);
      if (permissionError) {
        permissionError.classList.remove('d-none');
      }
    }
  });

  // Stop Camera Stream
  if (stopCameraBtn) {
    stopCameraBtn.addEventListener('click', () => {
      stopWebcam();
    });
  }

  function stopWebcam() {
    stopLiveScanning();
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
      videoStream = null;
    }
    if (videoElement) {
      videoElement.pause();
      videoElement.srcObject = null;
      videoElement.classList.add('d-none');
    }
    if (cameraPlaceholder) cameraPlaceholder.classList.remove('d-none');
    if (startCameraBtn) startCameraBtn.classList.remove('d-none');
    if (stopCameraBtn) stopCameraBtn.classList.add('d-none');
    if (captureFrameBtn) captureFrameBtn.setAttribute('disabled', 'true');

    if (statusDot) statusDot.classList.remove('active');
    if (statusText) statusText.textContent = 'Camera OFF';
  }

  function stopLiveScanning() {
    if (liveScanTimer) window.clearTimeout(liveScanTimer);
    liveScanTimer = null;
    liveScanBusy = false;
  }

  function startLiveScanning() {
    stopLiveScanning();
    const scan = async () => {
      if (!videoStream || videoElement.videoWidth === 0 || liveScanBusy) {
        liveScanTimer = window.setTimeout(scan, 700);
        return;
      }
      liveScanBusy = true;
      const frameCanvas = document.createElement('canvas');
      frameCanvas.width = 480;
      frameCanvas.height = Math.round(480 * videoElement.videoHeight / videoElement.videoWidth);
      frameCanvas.getContext('2d').drawImage(videoElement, 0, 0, frameCanvas.width, frameCanvas.height);
      const imageData = frameCanvas.toDataURL('image/jpeg', 0.82);
      const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value || '';
      const body = new URLSearchParams({ image_data: imageData });
      try {
        if (resultStatus) resultStatus.textContent = 'Scanning…';
        const response = await fetch(resultCard.dataset.predictUrl, {
          method: 'POST',
          headers: { 'X-CSRFToken': csrfToken, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
          credentials: 'same-origin'
        });
        const data = await response.json();
        if (!response.ok) {
          if (scanMessage) { scanMessage.textContent = data.error || 'Move closer to the camera.'; scanMessage.classList.remove('d-none'); }
          if (resultStatus) resultStatus.textContent = 'Looking for face';
        } else {
          if (scanMessage) scanMessage.classList.add('d-none');
          if (emptyState) emptyState.classList.add('d-none');
          if (predictionOutput) predictionOutput.classList.remove('d-none');
          const masked = data.prediction === 'Mask';
          predictionBanner.classList.toggle('mask-detected', masked);
          predictionBanner.classList.toggle('no-mask-detected', !masked);
          predictionText.textContent = masked ? 'MASK DETECTED' : 'NO MASK DETECTED';
          predictionText.className = `fw-bold mb-1 ${masked ? 'text-success' : 'text-danger'}`;
          confidenceText.textContent = `${Number(data.confidence).toFixed(2)}%`;
          latencyText.textContent = `${data.inference_time_ms} ms`;
          resultStatus.textContent = masked ? 'Compliant' : 'Non-Compliant';
          resultStatus.className = `badge ${masked ? 'bg-success' : 'bg-danger'}`;
          if (data.saved) {
            resultStatus.textContent += ' · Saved';
          }
        }
      } catch (error) {
        if (scanMessage) { scanMessage.textContent = 'Cannot contact the detection backend.'; scanMessage.classList.remove('d-none'); }
      } finally {
        liveScanBusy = false;
        if (videoStream) liveScanTimer = window.setTimeout(scan, 900);
      }
    };
    scan();
  }

  // Capture Frame from Video Feed to Canvas
  if (captureFrameBtn) {
    captureFrameBtn.addEventListener('click', () => {
      if (!videoElement || videoElement.videoWidth === 0) return;

      const canvas = canvasElement || document.createElement('canvas');
      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;
      const ctx = canvas.getContext('2d');

      // Draw the current video frame onto canvas
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

      // Convert canvas to Data URL (JPEG format)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

      // Populate hidden input and preview
      if (capturedImagePreview) {
        capturedImagePreview.src = dataUrl;
      }
      if (capturedDataInput) {
        capturedDataInput.value = dataUrl;
      }
      if (capturedSnapshotCard) {
        capturedSnapshotCard.classList.remove('d-none');
      }
      if (liveAnalyzeBtn) {
        liveAnalyzeBtn.removeAttribute('disabled');
      }

      // Smooth scroll to captured preview on mobile
      if (capturedSnapshotCard && window.innerWidth < 768) {
        capturedSnapshotCard.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  // Cleanup webcam stream when navigating away
  window.addEventListener('beforeunload', () => {
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
    }
  });
}

/* ==========================================================================
   3. HISTORY TABLE CLIENT-SIDE SEARCH & FILTERING (UI Polish)
   ========================================================================== */
function initHistoryFilters() {
  const searchInput = document.getElementById('historySearchInput');
  const filterSelect = document.getElementById('historyFilterSelect');
  const tableRows = document.querySelectorAll('#historyTableBody tr');

  if (!searchInput && !filterSelect) return;

  function filterTable() {
    const searchTerm = (searchInput ? searchInput.value : '').toLowerCase().trim();
    const filterValue = (filterSelect ? filterSelect.value : 'all').toLowerCase();

    let visibleCount = 0;
    tableRows.forEach(row => {
      const text = row.textContent.toLowerCase();
      const statusBadge = row.querySelector('.badge-mask, .badge-no-mask');
      const rowStatus = statusBadge ? (statusBadge.classList.contains('badge-mask') ? 'mask' : 'no_mask') : '';

      const matchesSearch = searchTerm === '' || text.includes(searchTerm);
      const matchesFilter = filterValue === 'all' || 
                            (filterValue === 'mask' && rowStatus === 'mask') || 
                            (filterValue === 'no_mask' && rowStatus === 'no_mask');

      if (matchesSearch && matchesFilter) {
        row.style.display = '';
        visibleCount++;
      } else {
        row.style.display = 'none';
      }
    });

    const emptyRow = document.getElementById('noResultsRow');
    if (emptyRow) {
      emptyRow.style.display = visibleCount === 0 ? '' : 'none';
    }
  }

  if (searchInput) searchInput.addEventListener('input', filterTable);
  if (filterSelect) filterSelect.addEventListener('change', filterTable);
}

/* ==========================================================================
   4. SAMPLE PRESETS FOR INSTANT CLIENT-SIDE DEMO TESTING
   ========================================================================== */
function initDemoPresets() {
  const presetButtons = document.querySelectorAll('.demo-preset-btn');
  const previewImage = document.getElementById('imagePreview');
  const previewContainer = document.getElementById('imagePreviewContainer');
  const uploadPrompt = document.getElementById('uploadPrompt');
  const analyzeBtn = document.getElementById('analyzeImageBtn');

  const fileInput = document.getElementById('imageFileInput');
  const errorAlert = document.getElementById('uploadErrorAlert');
  const errorText = document.getElementById('errorMessageText');

  presetButtons.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const sampleUrl = btn.getAttribute('data-sample-url');
      if (sampleUrl && previewImage && fileInput) {
        const originalHtml = btn.innerHTML;
        btn.disabled = true;
        try {
          const response = await fetch(sampleUrl);
          if (!response.ok) throw new Error('Sample download failed');
          const blob = await response.blob();
          const file = new File([blob], 'sample.jpg', { type: 'image/jpeg' });
          const transfer = new DataTransfer();
          transfer.items.add(file);
          fileInput.files = transfer.files;
          previewImage.src = URL.createObjectURL(blob);
          if (errorAlert) errorAlert.classList.add('d-none');
        } catch (error) {
          if (errorText) errorText.textContent = 'Could not load this online sample. Please upload an image from your device.';
          if (errorAlert) errorAlert.classList.remove('d-none');
          return;
        } finally {
          btn.disabled = false;
          btn.innerHTML = originalHtml;
        }
        if (uploadPrompt) uploadPrompt.classList.add('d-none');
        if (previewContainer) previewContainer.classList.remove('d-none');
        if (analyzeBtn) analyzeBtn.removeAttribute('disabled');
      }
    });
  });
}
