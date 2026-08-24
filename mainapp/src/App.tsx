import React, { useState, useRef, useEffect } from 'react';
import { PageName, DetectionRecord } from './types';
import { INITIAL_DETECTIONS } from './data';

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageName>('home');
  const [detections, setDetections] = useState<DetectionRecord[]>(INITIAL_DETECTIONS);
  const [currentResult, setCurrentResult] = useState<DetectionRecord>(INITIAL_DETECTIONS[0]);
  
  // Image Upload State
  const [uploadedImageSrc, setUploadedImageSrc] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Webcam State
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<boolean>(false);
  const [capturedSnapshot, setCapturedSnapshot] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // History Search & Filter State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'mask' | 'no_mask'>('all');

  // Django Code Inspector Drawer State
  const [showCodeInspector, setShowCodeInspector] = useState<boolean>(false);
  const [activeCodeTab, setActiveCodeTab] = useState<'template' | 'views' | 'ml_utils' | 'models'>('template');

  // Auth simulation state
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [username, setUsername] = useState<string>('Security Officer');

  // Toast alert
  const [flashMessage, setFlashMessage] = useState<{ text: string; type: 'success' | 'info' | 'danger' } | null>(null);

  const showToast = (text: string, type: 'success' | 'info' | 'danger' = 'success') => {
    setFlashMessage({ text, type });
    setTimeout(() => {
      setFlashMessage(null);
    }, 4500);
  };

  // Scroll to top on page change
  const navigateTo = (page: PageName) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // -------------------------------------------------------------
  // WEBCAM HANDLERS
  // -------------------------------------------------------------
  const startWebcam = async () => {
    setCameraError(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
      showToast('Camera sensor connected successfully. Ready to capture frames.', 'info');
    } catch (err) {
      console.error('Camera access error:', err);
      setCameraError(true);
      setIsCameraActive(false);
    }
  };

  const stopWebcam = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      setCapturedSnapshot(dataUrl);
      showToast('Video frame captured to buffer. Ready for TensorFlow inference.', 'success');
    }
  };

  const analyzeCapturedFrame = (presetPrediction?: 'Mask' | 'No Mask') => {
    const isMask = presetPrediction ? presetPrediction === 'Mask' : Math.random() > 0.35;
    const confidence = +(94 + Math.random() * 5.8).toFixed(2);
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    const newRecord: DetectionRecord = {
      id: detections.length > 0 ? detections[0].id + 1 : 1001,
      imageUrl: capturedSnapshot || 'https://images.unsplash.com/photo-1584634731339-252c581abfc5?w=500&auto=format&fit=crop&q=80',
      prediction: isMask ? 'Mask' : 'No Mask',
      confidence,
      inferenceTime: `${Math.floor(32 + Math.random() * 15)} ms`,
      date: dateStr,
      time: timeStr,
      checkpoint: 'Live Webcam Stream'
    };

    setDetections([newRecord, ...detections]);
    setCurrentResult(newRecord);
    stopWebcam();
    navigateTo('result');
  };

  // -------------------------------------------------------------
  // IMAGE UPLOAD HANDLERS
  // -------------------------------------------------------------
  const handleFileChange = (file: File) => {
    setUploadError('');
    if (!file.type.match('image/(jpeg|jpg|png)')) {
      setUploadError('Invalid image format. Please upload JPG, JPEG, or PNG.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError(`File is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Max 10MB.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setUploadedImageSrc(e.target.result as string);
        showToast('Image loaded and preprocessed for neural network input.', 'info');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleImageAnalysis = (overrideUrl?: string, overridePrediction?: 'Mask' | 'No Mask') => {
    const src = overrideUrl || uploadedImageSrc || 'https://images.unsplash.com/photo-1584634731339-252c581abfc5?w=600&auto=format&fit=crop&q=80';
    const isMask = overridePrediction ? overridePrediction === 'Mask' : (overrideUrl?.includes('1584634731339') ? true : Math.random() > 0.4);
    const confidence = +(95 + Math.random() * 4.6).toFixed(2);
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    const newRecord: DetectionRecord = {
      id: detections.length > 0 ? detections[0].id + 1 : 1001,
      imageUrl: src,
      prediction: isMask ? 'Mask' : 'No Mask',
      confidence,
      inferenceTime: `${Math.floor(35 + Math.random() * 12)} ms`,
      date: dateStr,
      time: timeStr,
      checkpoint: 'User Upload Session'
    };

    setDetections([newRecord, ...detections]);
    setCurrentResult(newRecord);
    navigateTo('result');
  };

  // Filter history records
  const filteredDetections = detections.filter(d => {
    const matchesSearch = searchQuery === '' || 
      `#${d.id}`.includes(searchQuery) || 
      d.prediction.toLowerCase().includes(searchQuery.toLowerCase()) || 
      d.date.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.checkpoint || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter = statusFilter === 'all' || 
      (statusFilter === 'mask' && d.prediction === 'Mask') ||
      (statusFilter === 'no_mask' && d.prediction === 'No Mask');

    return matchesSearch && matchesFilter;
  });

  const totalDetectionsCount = 14820 + detections.length - INITIAL_DETECTIONS.length;
  const maskCount = 10670 + detections.filter(d => d.prediction === 'Mask').length - INITIAL_DETECTIONS.filter(d => d.prediction === 'Mask').length;
  const noMaskCount = totalDetectionsCount - maskCount;
  const maskPercentage = Math.round((maskCount / totalDetectionsCount) * 100) || 72;
  const noMaskPercentage = 100 - maskPercentage;

  // Cleanup webcam when unmounting
  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div className="d-flex flex-column min-vh-100 bg-light">
      
      {/* -------------------------------------------------------------
          1. NAVIGATION BAR (Corresponds to templates/components/navbar.html)
          ------------------------------------------------------------- */}
      <nav className="navbar navbar-expand-lg navbar-custom sticky-top">
        <div className="container">
          <button 
            type="button" 
            className="navbar-brand bg-transparent border-0 p-0 text-start"
            onClick={() => navigateTo('home')}>
            <div className="brand-icon-wrapper">
              <i className="bi bi-shield-check"></i>
            </div>
            <span>FaceGuard <span className="text-primary">AI</span></span>
          </button>

          <button 
            className="navbar-toggler border-0 shadow-none" 
            type="button" 
            data-bs-toggle="collapse" 
            data-bs-target="#navbarMainContent" 
            aria-controls="navbarMainContent" 
            aria-expanded="false" 
            aria-label="Toggle navigation">
            <span className="navbar-toggler-icon"></span>
          </button>

          <div className="collapse navbar-collapse" id="navbarMainContent">
            <ul className="navbar-nav me-auto mb-2 mb-lg-0 ms-lg-3 gap-1">
              <li className="nav-item">
                <button 
                  type="button" 
                  className={`nav-link border-0 bg-transparent ${currentPage === 'home' ? 'active' : ''}`}
                  onClick={() => navigateTo('home')}>
                  <i className="bi bi-house-door"></i> Home
                </button>
              </li>
              <li className="nav-item">
                <button 
                  type="button" 
                  className={`nav-link border-0 bg-transparent ${currentPage === 'about' ? 'active' : ''}`}
                  onClick={() => navigateTo('about')}>
                  <i className="bi bi-info-circle"></i> About
                </button>
              </li>
              <li className="nav-item">
                <button 
                  type="button" 
                  className={`nav-link border-0 bg-transparent ${currentPage === 'live_detection' ? 'active' : ''}`}
                  onClick={() => navigateTo('live_detection')}>
                  <i className="bi bi-camera-video"></i> Live Detection
                </button>
              </li>
              <li className="nav-item">
                <button 
                  type="button" 
                  className={`nav-link border-0 bg-transparent ${currentPage === 'image_detection' ? 'active' : ''}`}
                  onClick={() => navigateTo('image_detection')}>
                  <i className="bi bi-upload"></i> Image Detection
                </button>
              </li>
              <li className="nav-item">
                <button 
                  type="button" 
                  className={`nav-link border-0 bg-transparent ${currentPage === 'dashboard' ? 'active' : ''}`}
                  onClick={() => navigateTo('dashboard')}>
                  <i className="bi bi-speedometer2"></i> Dashboard
                </button>
              </li>
              <li className="nav-item">
                <button 
                  type="button" 
                  className={`nav-link border-0 bg-transparent ${currentPage === 'history' ? 'active' : ''}`}
                  onClick={() => navigateTo('history')}>
                  <i className="bi bi-clock-history"></i> History
                </button>
              </li>
            </ul>

            <div className="d-flex align-items-center gap-2">
              {isLoggedIn ? (
                <div className="dropdown">
                  <button 
                    className="btn btn-outline-secondary dropdown-toggle d-flex align-items-center gap-2 px-3 py-2 rounded-3" 
                    type="button" 
                    id="userProfileDropdown" 
                    data-bs-toggle="dropdown" 
                    aria-expanded="false">
                    <i className="bi bi-person-circle text-primary fs-5"></i>
                    <span className="fw-semibold">{username}</span>
                  </button>
                  <ul className="dropdown-menu dropdown-menu-end shadow-sm border-1 mt-2" aria-labelledby="userProfileDropdown">
                    <li>
                      <button className="dropdown-item d-flex align-items-center gap-2 py-2" onClick={() => navigateTo('dashboard')}>
                        <i className="bi bi-speedometer2 text-primary"></i> Dashboard
                      </button>
                    </li>
                    <li>
                      <button className="dropdown-item d-flex align-items-center gap-2 py-2" onClick={() => navigateTo('history')}>
                        <i className="bi bi-clock-history text-secondary"></i> Detection Logs
                      </button>
                    </li>
                    <li><hr className="dropdown-divider" /></li>
                    <li>
                      <button 
                        className="dropdown-item d-flex align-items-center gap-2 py-2 text-danger" 
                        onClick={() => { setIsLoggedIn(false); showToast('Signed out successfully.', 'info'); }}>
                        <i className="bi bi-box-arrow-right"></i> Sign Out
                      </button>
                    </li>
                  </ul>
                </div>
              ) : (
                <>
                  <button 
                    type="button" 
                    className="btn btn-link text-decoration-none text-dark fw-semibold px-3"
                    onClick={() => navigateTo('login')}>
                    Sign In
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-primary-custom btn-sm px-3"
                    onClick={() => navigateTo('register')}>
                    <i className="bi bi-person-plus"></i> Register
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* -------------------------------------------------------------
          2. TOAST / DJANGO FLASH MESSAGES (Corresponds to components/messages.html)
          ------------------------------------------------------------- */}
      {flashMessage && (
        <div className="container mt-3">
          <div className={`alert alert-${flashMessage.type} alert-dismissible fade show shadow-sm rounded-3 d-flex align-items-center gap-2`} role="alert">
            <i className={`bi ${flashMessage.type === 'success' ? 'bi-check-circle-fill text-success' : flashMessage.type === 'danger' ? 'bi-exclamation-triangle-fill text-danger' : 'bi-info-circle-fill text-primary'} fs-5`}></i>
            <div>{flashMessage.text}</div>
            <button type="button" className="btn-close ms-auto" onClick={() => setFlashMessage(null)} aria-label="Close"></button>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          3. MAIN CONTENT ROUTER
          ------------------------------------------------------------- */}
      <main className="flex-grow-1">
        
        {/* ================= PAGE: HOME ================= */}
        {currentPage === 'home' && (
          <div>
            {/* Hero Section */}
            <section className="hero-section">
              <div className="container">
                <div className="row align-items-center g-5">
                  <div className="col-12 col-lg-6">
                    <div className="hero-badge">
                      <i className="bi bi-shield-check text-primary"></i>
                      <span>Computer Vision Safety Protocol</span>
                    </div>
                    <h1 className="hero-title">
                      AI-Powered <br />
                      <span className="text-gradient">Face Mask Detection</span>
                    </h1>
                    <p className="hero-subtitle">
                      Detect face masks quickly and accurately using Computer Vision and Deep Learning. Designed for seamless deployment at entrances, transit hubs, and healthcare facilities.
                    </p>
                    <div className="d-flex flex-wrap gap-3 mb-4">
                      <button 
                        type="button" 
                        className="btn btn-primary-custom btn-lg"
                        onClick={() => navigateTo('live_detection')}>
                        <i className="bi bi-camera-video"></i> Start Live Detection
                      </button>
                      <button 
                        type="button" 
                        className="btn btn-secondary-custom btn-lg"
                        onClick={() => navigateTo('image_detection')}>
                        <i className="bi bi-cloud-arrow-up"></i> Upload Image
                      </button>
                    </div>

                    <div className="d-flex align-items-center gap-4 pt-3 border-top text-muted small">
                      <div className="d-flex align-items-center gap-2">
                        <i className="bi bi-lightning-charge-fill text-warning"></i>
                        <span>Real-time ~40ms</span>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        <i className="bi bi-check2-circle text-success"></i>
                        <span>98.6% Accuracy</span>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        <i className="bi bi-lock-fill text-primary"></i>
                        <span>Privacy-First</span>
                      </div>
                    </div>
                  </div>

                  <div className="col-12 col-lg-6">
                    <div className="hero-visual-card">
                      <div className="d-flex align-items-center justify-content-between mb-3">
                        <div className="d-flex align-items-center gap-2">
                          <span className="status-dot active"></span>
                          <span className="small fw-semibold text-light">LIVE INFERENCE STREAM</span>
                        </div>
                        <span className="badge bg-dark border border-secondary text-info small">224x224 RGB</span>
                      </div>

                      <div className="hero-scanner-frame">
                        <div className="scanner-overlay"></div>
                        <div className="detection-box-mock">
                          <span className="hud-tag"><i className="bi bi-check-circle-fill"></i> MASK 98.4%</span>
                          <div className="d-flex justify-content-between text-white" style={{ fontSize: '0.65rem', fontFamily: 'monospace' }}>
                            <span>ID: #4091</span>
                            <span>T: 34ms</span>
                          </div>
                        </div>
                        <div className="text-center text-secondary opacity-50">
                          <i className="bi bi-person-bounding-box" style={{ fontSize: '8rem' }}></i>
                        </div>
                      </div>

                      <div className="row g-2 mt-3 pt-2 border-top border-secondary border-opacity-25 small text-light">
                        <div className="col-4">
                          <span className="text-secondary d-block" style={{ fontSize: '0.75rem' }}>BACKEND</span>
                          <strong className="text-info">OpenCV + Keras</strong>
                        </div>
                        <div className="col-4">
                          <span className="text-secondary d-block" style={{ fontSize: '0.75rem' }}>ARCHITECTURE</span>
                          <strong>MobileNetV2</strong>
                        </div>
                        <div className="col-4">
                          <span className="text-secondary d-block" style={{ fontSize: '0.75rem' }}>STATUS</span>
                          <strong className="text-success">Compliance Pass</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Features (4 Cards) */}
            <section className="py-5 bg-white border-bottom">
              <div className="container py-4">
                <div className="text-center mb-5" style={{ maxWidth: '600px', margin: '0 auto' }}>
                  <h6 className="text-primary fw-bold text-uppercase" style={{ letterSpacing: '0.08em' }}>Core Capabilities</h6>
                  <h2 className="fw-bold text-dark">Engineered for Accuracy & Speed</h2>
                  <p className="text-muted">A complete computer vision pipeline built from the ground up for high-throughput public and workplace monitoring.</p>
                </div>

                <div className="row g-4">
                  <div className="col-12 col-md-6 col-lg-3">
                    <div className="card-custom hover-elevate h-100 p-4">
                      <div className="feature-icon-box feature-icon-blue">
                        <i className="bi bi-camera-video-fill"></i>
                      </div>
                      <h5 className="fw-bold text-dark mb-2">Real-Time Detection</h5>
                      <p className="text-muted small mb-0">
                        Access live webcam streams directly in the browser to detect facial masks instantaneously with minimal frame delay.
                      </p>
                    </div>
                  </div>

                  <div className="col-12 col-md-6 col-lg-3">
                    <div className="card-custom hover-elevate h-100 p-4">
                      <div className="feature-icon-box feature-icon-green">
                        <i className="bi bi-cpu-fill"></i>
                      </div>
                      <h5 className="fw-bold text-dark mb-2">AI-Powered Model</h5>
                      <p className="text-muted small mb-0">
                        Powered by MobileNetV2 / CNN deep learning trained on diverse benchmark datasets across lighting conditions.
                      </p>
                    </div>
                  </div>

                  <div className="col-12 col-md-6 col-lg-3">
                    <div className="card-custom hover-elevate h-100 p-4">
                      <div className="feature-icon-box feature-icon-amber">
                        <i className="bi bi-lightning-charge-fill"></i>
                      </div>
                      <h5 className="fw-bold text-dark mb-2">Fast Prediction</h5>
                      <p className="text-muted small mb-0">
                        Optimized inference pipeline delivers confident mask/no-mask classification in under 45 milliseconds.
                      </p>
                    </div>
                  </div>

                  <div className="col-12 col-md-6 col-lg-3">
                    <div className="card-custom hover-elevate h-100 p-4">
                      <div className="feature-icon-box feature-icon-purple">
                        <i className="bi bi-journal-text"></i>
                      </div>
                      <h5 className="fw-bold text-dark mb-2">Detection History</h5>
                      <p className="text-muted small mb-0">
                        Automatically log past scans, timestamps, confidence scores, and bounding coordinates for audit reporting.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* How It Works (4 Steps) */}
            <section className="py-5" style={{ backgroundColor: '#f8fafc' }}>
              <div className="container py-4">
                <div className="text-center mb-5" style={{ maxWidth: '600px', margin: '0 auto' }}>
                  <h6 className="text-primary fw-bold text-uppercase" style={{ letterSpacing: '0.08em' }}>Workflow Pipeline</h6>
                  <h2 className="fw-bold text-dark">How The System Works</h2>
                  <p className="text-muted">From raw camera input to classification verdict in four synchronized stages.</p>
                </div>

                <div className="row g-4">
                  <div className="col-12 col-md-6 col-lg-3">
                    <div className="card-custom text-center p-4 h-100 border-top border-4 border-primary">
                      <div className="step-number-badge">1</div>
                      <h5 className="fw-bold text-dark mb-2">Capture Image</h5>
                      <p className="text-muted small mb-0">
                        Stream video frames via client webcam or upload high-resolution images via drag-and-drop.
                      </p>
                    </div>
                  </div>

                  <div className="col-12 col-md-6 col-lg-3">
                    <div className="card-custom text-center p-4 h-100 border-top border-4 border-info">
                      <div className="step-number-badge bg-info">2</div>
                      <h5 className="fw-bold text-dark mb-2">Detect Face</h5>
                      <p className="text-muted small mb-0">
                        OpenCV Haar Cascade or DNN face detector locates and crops the facial ROI coordinates.
                      </p>
                    </div>
                  </div>

                  <div className="col-12 col-md-6 col-lg-3">
                    <div className="card-custom text-center p-4 h-100 border-top border-4 border-warning">
                      <div className="step-number-badge bg-warning text-dark">3</div>
                      <h5 className="fw-bold text-dark mb-2">Analyze with ML</h5>
                      <p className="text-muted small mb-0">
                        TensorFlow/Keras classifier evaluates the preprocessed 224x224 frame through deep layers.
                      </p>
                    </div>
                  </div>

                  <div className="col-12 col-md-6 col-lg-3">
                    <div className="card-custom text-center p-4 h-100 border-top border-4 border-success">
                      <div className="step-number-badge bg-success">4</div>
                      <h5 className="fw-bold text-dark mb-2">Display Prediction</h5>
                      <p className="text-muted small mb-0">
                        Instant visual feedback: Green for Mask Detected, Red for No Mask, with exact confidence percentage.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Statistics Section */}
            <section className="py-5 bg-white border-top border-bottom">
              <div className="container py-3">
                <div className="text-center mb-4">
                  <h6 className="text-primary fw-bold text-uppercase" style={{ letterSpacing: '0.08em' }}>Live Telemetry</h6>
                  <h2 className="fw-bold text-dark">System Metrics & Overview</h2>
                </div>

                <div className="row g-4">
                  <div className="col-12 col-sm-6 col-lg-3">
                    <div className="stat-card">
                      <div>
                        <div className="stat-label">Total Detections</div>
                        <div className="stat-value">{totalDetectionsCount.toLocaleString()}</div>
                        <div className="small text-muted"><i className="bi bi-clock-history"></i> Across all sessions</div>
                      </div>
                      <div className="stat-icon feature-icon-blue">
                        <i className="bi bi-camera-video"></i>
                      </div>
                    </div>
                  </div>

                  <div className="col-12 col-sm-6 col-lg-3">
                    <div className="stat-card">
                      <div>
                        <div className="stat-label">Masks Detected</div>
                        <div className="stat-value text-success">{maskCount.toLocaleString()}</div>
                        <div className="small text-success"><i className="bi bi-shield-check"></i> {maskPercentage}% Compliance</div>
                      </div>
                      <div className="stat-icon feature-icon-green">
                        <i className="bi bi-check-circle"></i>
                      </div>
                    </div>
                  </div>

                  <div className="col-12 col-sm-6 col-lg-3">
                    <div className="stat-card">
                      <div>
                        <div className="stat-label">No Mask Detected</div>
                        <div className="stat-value text-danger">{noMaskCount.toLocaleString()}</div>
                        <div className="small text-danger"><i className="bi bi-shield-x"></i> {noMaskPercentage}% Non-compliant</div>
                      </div>
                      <div className="stat-icon feature-icon-amber" style={{ backgroundColor: '#fee2e2', color: '#ef4444' }}>
                        <i className="bi bi-exclamation-triangle"></i>
                      </div>
                    </div>
                  </div>

                  <div className="col-12 col-sm-6 col-lg-3">
                    <div className="stat-card">
                      <div>
                        <div className="stat-label">Model Accuracy</div>
                        <div className="stat-value text-primary">98.6%</div>
                        <div className="small text-primary"><i className="bi bi-trophy"></i> MobileNetV2 Val</div>
                      </div>
                      <div className="stat-icon feature-icon-purple">
                        <i className="bi bi-patch-check"></i>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* CTA Section */}
            <section className="py-5" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#ffffff' }}>
              <div className="container py-4 text-center">
                <div style={{ maxWidth: '650px', margin: '0 auto' }}>
                  <span className="badge bg-primary px-3 py-2 rounded-pill mb-3">Instant AI Inspection</span>
                  <h2 className="fw-bold mb-3 display-6">Ready to Detect?</h2>
                  <p className="text-light opacity-75 mb-4 fs-6">
                    Test the deep learning detection pipeline using your local webcam feed or analyze pre-captured photography in high precision.
                  </p>
                  <div className="d-flex flex-wrap justify-content-center gap-3">
                    <button 
                      type="button" 
                      className="btn btn-primary-custom btn-lg"
                      onClick={() => navigateTo('live_detection')}>
                      <i className="bi bi-camera-video"></i> Start Live Detection
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-light btn-lg fw-semibold px-4 text-dark rounded-3"
                      onClick={() => navigateTo('image_detection')}>
                      <i className="bi bi-cloud-arrow-up"></i> Upload Image
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ================= PAGE: ABOUT ================= */}
        {currentPage === 'about' && (
          <div>
            <div className="py-5 bg-white border-bottom">
              <div className="container">
                <div className="row align-items-center">
                  <div className="col-12 col-md-8">
                    <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-3 py-1 rounded-pill mb-2">
                      <i className="bi bi-info-circle"></i> System Architecture & Deep Learning
                    </span>
                    <h1 className="fw-bold text-dark mb-2">About FaceGuard AI</h1>
                    <p className="text-muted mb-0 lead fs-6">
                      Understanding the real-world problem, computer vision preprocessing, and neural network architecture behind automated mask compliance.
                    </p>
                  </div>
                  <div className="col-12 col-md-4 text-md-end mt-3 mt-md-0">
                    <button 
                      type="button" 
                      className="btn btn-primary-custom"
                      onClick={() => navigateTo('live_detection')}>
                      <i className="bi bi-play-circle"></i> Test Live System
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="container py-5">
              {/* Problem Statement */}
              <div className="row g-4 mb-5 align-items-center">
                <div className="col-12 col-lg-6">
                  <h3 className="fw-bold text-dark mb-3">What is Face Mask Detection?</h3>
                  <p className="text-secondary leading-relaxed">
                    Face Mask Detection is a computer vision task that identifies whether a subject in a digital image or real-time video stream is wearing a protective face covering over their nose and mouth.
                  </p>
                  <p className="text-secondary leading-relaxed">
                    Unlike basic presence detection, modern deep learning architectures analyze subtle spatial features (such as facial contours, strap alignment, nose bridge occlusion, and fabric patterns) to distinguish between standard medical/N95 masks, improper wearing, and bare faces.
                  </p>
                  <div className="card-custom p-3 bg-light border-0">
                    <div className="d-flex align-items-center gap-3">
                      <i className="bi bi-lightbulb-fill text-warning fs-3"></i>
                      <p className="mb-0 small text-dark">
                        <strong>Key Benefit:</strong> Replaces manual checkpoints with automated, contactless compliance monitoring capable of processing dozens of individuals per minute without operational friction.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="col-12 col-lg-6">
                  <div className="card-custom p-4 bg-dark text-white border-0 shadow-lg">
                    <h5 className="fw-bold text-info mb-3 d-flex align-items-center gap-2">
                      <i className="bi bi-cpu"></i> Key Performance Objectives
                    </h5>
                    <ul className="list-unstyled d-flex flex-column gap-3 mb-0 small">
                      <li className="d-flex align-items-start gap-2">
                        <i className="bi bi-check2-circle text-success fs-5"></i>
                        <div>
                          <strong>Low-Latency Real-Time Feed:</strong> Sub-50ms inference allows live 30 FPS video parsing at gate turnstiles.
                        </div>
                      </li>
                      <li className="d-flex align-items-start gap-2">
                        <i className="bi bi-check2-circle text-success fs-5"></i>
                        <div>
                          <strong>Robust Lighting Invariance:</strong> Tolerant to direct sunlight, indoor fluorescent glare, and shadows.
                        </div>
                      </li>
                      <li className="d-flex align-items-start gap-2">
                        <i className="bi bi-check2-circle text-success fs-5"></i>
                        <div>
                          <strong>High Confidence Boundary:</strong> Greater than 98% validation accuracy on standard benchmark datasets.
                        </div>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* 6 Industry Verticals */}
              <div className="mb-5">
                <div className="text-center mb-4" style={{ maxWidth: '600px', margin: '0 auto' }}>
                  <h6 className="text-primary fw-bold text-uppercase">Deployment Environments</h6>
                  <h3 className="fw-bold text-dark">Why Automated Mask Detection Matters</h3>
                  <p className="text-muted small">Designed for critical environments requiring continuous safety hygiene and public health protocol compliance.</p>
                </div>

                <div className="row g-3">
                  <div className="col-12 col-md-6 col-lg-4">
                    <div className="card-custom p-3 h-100">
                      <div className="d-flex align-items-center gap-3 mb-2">
                        <div className="feature-icon-box feature-icon-green mb-0" style={{ width: '42px', height: '42px', fontSize: '1.2rem' }}>
                          <i className="bi bi-hospital"></i>
                        </div>
                        <h6 className="fw-bold mb-0 text-dark">Hospitals & Clinics</h6>
                      </div>
                      <p className="text-muted small mb-0">Protects immunocompromised patients, doctors, and nursing staff in sterile cleanroom wings and ICUs.</p>
                    </div>
                  </div>

                  <div className="col-12 col-md-6 col-lg-4">
                    <div className="card-custom p-3 h-100">
                      <div className="d-flex align-items-center gap-3 mb-2">
                        <div className="feature-icon-box feature-icon-blue mb-0" style={{ width: '42px', height: '42px', fontSize: '1.2rem' }}>
                          <i className="bi bi-airplane"></i>
                        </div>
                        <h6 className="fw-bold mb-0 text-dark">Airports & Transit</h6>
                      </div>
                      <p className="text-muted small mb-0">High-volume automated screening across terminal security queues, metro turnstiles, and boarding gates.</p>
                    </div>
                  </div>

                  <div className="col-12 col-md-6 col-lg-4">
                    <div className="card-custom p-3 h-100">
                      <div className="d-flex align-items-center gap-3 mb-2">
                        <div className="feature-icon-box feature-icon-purple mb-0" style={{ width: '42px', height: '42px', fontSize: '1.2rem' }}>
                          <i className="bi bi-building"></i>
                        </div>
                        <h6 className="fw-bold mb-0 text-dark">Corporate Offices</h6>
                      </div>
                      <p className="text-muted small mb-0">Integrates with lobby turnstiles and badge access systems to prompt employees before entering elevators.</p>
                    </div>
                  </div>

                  <div className="col-12 col-md-6 col-lg-4">
                    <div className="card-custom p-3 h-100">
                      <div className="d-flex align-items-center gap-3 mb-2">
                        <div className="feature-icon-box feature-icon-amber mb-0" style={{ width: '42px', height: '42px', fontSize: '1.2rem' }}>
                          <i className="bi bi-gear-wide-connected"></i>
                        </div>
                        <h6 className="fw-bold mb-0 text-dark">Factories & Plants</h6>
                      </div>
                      <p className="text-muted small mb-0">Ensures workers wear industrial dust masks, respirators, and PPE before entering hazardous workshop zones.</p>
                    </div>
                  </div>

                  <div className="col-12 col-md-6 col-lg-4">
                    <div className="card-custom p-3 h-100">
                      <div className="d-flex align-items-center gap-3 mb-2">
                        <div className="feature-icon-box feature-icon-blue mb-0" style={{ width: '42px', height: '42px', fontSize: '1.2rem' }}>
                          <i className="bi bi-mortarboard"></i>
                        </div>
                        <h6 className="fw-bold mb-0 text-dark">Schools & Campuses</h6>
                      </div>
                      <p className="text-muted small mb-0">Passive monitoring in crowded dining halls, lecture auditoriums, and indoor sports gymnasiums.</p>
                    </div>
                  </div>

                  <div className="col-12 col-md-6 col-lg-4">
                    <div className="card-custom p-3 h-100">
                      <div className="d-flex align-items-center gap-3 mb-2">
                        <div className="feature-icon-box feature-icon-green mb-0" style={{ width: '42px', height: '42px', fontSize: '1.2rem' }}>
                          <i className="bi bi-shop"></i>
                        </div>
                        <h6 className="fw-bold mb-0 text-dark">Retail & Malls</h6>
                      </div>
                      <p className="text-muted small mb-0">Automated entry compliance and real-time dashboard analytics for store safety operators.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pipeline Diagram */}
              <div className="card-custom p-4 p-md-5 mb-5 bg-white">
                <div className="text-center mb-4">
                  <h6 className="text-primary fw-bold text-uppercase">End-to-End Execution Flow</h6>
                  <h3 className="fw-bold text-dark">System Execution Pipeline</h3>
                </div>

                <div className="row justify-content-center">
                  <div className="col-12 col-md-8 col-lg-7">
                    <div className="pipeline-step">
                      <div className="badge bg-primary rounded-circle p-2 fs-6"><i className="bi bi-camera"></i></div>
                      <div>
                        <strong className="text-dark d-block">1. Camera / Image Input</strong>
                        <span className="text-muted small">Browser webcam stream via getUserMedia or uploaded JPG/PNG image file.</span>
                      </div>
                    </div>
                    <div className="pipeline-arrow"><i className="bi bi-arrow-down"></i></div>

                    <div className="pipeline-step">
                      <div className="badge bg-info text-dark rounded-circle p-2 fs-6"><i className="bi bi-bounding-box"></i></div>
                      <div>
                        <strong className="text-dark d-block">2. Face Detection (OpenCV)</strong>
                        <span className="text-muted small">Haar Cascade Classifier or Caffe DNN model locates bounding box (x, y, w, h).</span>
                      </div>
                    </div>
                    <div className="pipeline-arrow"><i className="bi bi-arrow-down"></i></div>

                    <div className="pipeline-step">
                      <div className="badge bg-secondary rounded-circle p-2 fs-6"><i className="bi bi-crop"></i></div>
                      <div>
                        <strong className="text-dark d-block">3. Face Cropping & Preprocessing</strong>
                        <span className="text-muted small">Crops facial ROI, converts BGR to RGB, and resizes to 224x224.</span>
                      </div>
                    </div>
                    <div className="pipeline-arrow"><i className="bi bi-arrow-down"></i></div>

                    <div className="pipeline-step">
                      <div className="badge bg-warning text-dark rounded-circle p-2 fs-6"><i className="bi bi-sliders"></i></div>
                      <div>
                        <strong className="text-dark d-block">4. Image Normalization</strong>
                        <span className="text-muted small">Scales pixel values to [-1, 1] range using MobileNetV2 preprocessing utilities.</span>
                      </div>
                    </div>
                    <div className="pipeline-arrow"><i className="bi bi-arrow-down"></i></div>

                    <div className="pipeline-step">
                      <div className="badge bg-primary rounded-circle p-2 fs-6"><i className="bi bi-cpu"></i></div>
                      <div>
                        <strong className="text-dark d-block">5. Deep Learning Model (TensorFlow / Keras)</strong>
                        <span className="text-muted small">Pre-trained MobileNetV2 convolutional layers perform feature extraction and Softmax classification.</span>
                      </div>
                    </div>
                    <div className="pipeline-arrow"><i className="bi bi-arrow-down"></i></div>

                    <div className="pipeline-step">
                      <div className="badge bg-success rounded-circle p-2 fs-6"><i className="bi bi-check2-circle"></i></div>
                      <div>
                        <strong className="text-dark d-block">6. Classification Verdict & Confidence</strong>
                        <span className="text-muted small">Returns binary decision (Mask / No Mask) with confidence score (e.g. 98.4%).</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= PAGE: LIVE DETECTION ================= */}
        {currentPage === 'live_detection' && (
          <div>
            <div className="py-5 bg-white border-bottom">
              <div className="container">
                <div className="row align-items-center">
                  <div className="col-12 col-md-8">
                    <span className="badge bg-success-subtle text-success border border-success-subtle px-3 py-1 rounded-pill mb-2">
                      <i className="bi bi-broadcast"></i> Real-Time Optical Compliance Feed
                    </span>
                    <h1 className="fw-bold text-dark mb-1">Live Face Mask Detection</h1>
                    <p className="text-muted mb-0 lead fs-6">
                      Access your device's video sensor for instantaneous face detection and automated safety mask classification.
                    </p>
                  </div>
                  <div className="col-12 col-md-4 text-md-end mt-3 mt-md-0">
                    <button 
                      type="button" 
                      className="btn btn-secondary-custom"
                      onClick={() => navigateTo('image_detection')}>
                      <i className="bi bi-upload"></i> Upload Static Image Instead
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="container py-5">
              <div className="row g-4">
                {/* Left Column: Camera Viewfinder */}
                <div className="col-12 col-lg-7">
                  {cameraError && (
                    <div className="alert alert-danger rounded-3 shadow-sm mb-4" role="alert">
                      <div className="d-flex align-items-center gap-2 mb-1">
                        <i className="bi bi-camera-video-off-fill fs-4"></i>
                        <h6 className="fw-bold mb-0">Camera Access Denied or Unavailable</h6>
                      </div>
                      <p className="small mb-0">
                        Please check your browser permissions to allow webcam access, or ensure no other application is locking the video device.
                      </p>
                    </div>
                  )}

                  <div className="camera-container">
                    <div className="camera-status-pill">
                      <span className={`status-dot ${isCameraActive ? 'active' : ''}`}></span>
                      <span>{isCameraActive ? 'Camera LIVE' : 'Camera OFF'}</span>
                    </div>

                    {!isCameraActive && (
                      <div className="camera-placeholder">
                        <div className="mb-3 text-secondary">
                          <i className="bi bi-webcam" style={{ fontSize: '4.5rem' }}></i>
                        </div>
                        <h5 className="fw-bold text-white mb-2">Camera is currently OFF</h5>
                        <p className="text-secondary small mb-4" style={{ maxWidth: '320px', margin: '0 auto' }}>
                          Click the button below to grant permission and initiate the real-time optical stream.
                        </p>
                        <button type="button" className="btn btn-primary-custom px-4 py-2" onClick={startWebcam}>
                          <i className="bi bi-camera-video-fill"></i> Start Camera
                        </button>
                      </div>
                    )}

                    <video 
                      ref={videoRef} 
                      className={`camera-video ${isCameraActive ? '' : 'd-none'}`} 
                      autoPlay 
                      playsInline 
                      muted>
                    </video>

                    <canvas ref={canvasRef} className="camera-canvas"></canvas>
                  </div>

                  <div className="camera-controls-bar">
                    {isCameraActive && (
                      <button type="button" className="btn btn-danger px-4" onClick={stopWebcam}>
                        <i className="bi bi-stop-circle-fill"></i> Stop Camera
                      </button>
                    )}
                    <button 
                      type="button" 
                      className="btn btn-success px-4" 
                      onClick={captureFrame} 
                      disabled={!isCameraActive}>
                      <i className="bi bi-camera-fill"></i> Capture Frame
                    </button>
                  </div>

                  <div className="card-custom p-3 bg-light border mt-4">
                    <h6 className="fw-bold text-dark mb-2 d-flex align-items-center gap-2">
                      <i className="bi bi-diagram-2 text-primary"></i> Data Flow
                    </h6>
                    <div className="d-flex align-items-center justify-content-between text-muted text-center" style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>
                      <span>Webcam</span>
                      <i className="bi bi-arrow-right text-primary"></i>
                      <span>JS Canvas</span>
                      <i className="bi bi-arrow-right text-primary"></i>
                      <span>Django POST</span>
                      <i className="bi bi-arrow-right text-primary"></i>
                      <span>OpenCV/Keras</span>
                      <i className="bi bi-arrow-right text-primary"></i>
                      <span>Result</span>
                    </div>
                  </div>
                </div>

                {/* Right Column: Captured Snapshot & Result */}
                <div className="col-12 col-lg-5">
                  {capturedSnapshot ? (
                    <div className="card-custom mb-4">
                      <div className="card-custom-header">
                        <span className="fw-bold text-dark d-flex align-items-center gap-2">
                          <i className="bi bi-camera"></i> Captured Snapshot
                        </span>
                        <span className="badge bg-primary-subtle text-primary border">Ready for Inference</span>
                      </div>
                      <div className="card-custom-body text-center">
                        <div className="image-preview-container mb-3" style={{ maxHeight: '240px' }}>
                          <img src={capturedSnapshot} alt="Captured Frame" className="image-preview-img" />
                        </div>
                        <div className="d-flex gap-2">
                          <button 
                            type="button" 
                            className="btn btn-primary-custom flex-grow-1 justify-content-center" 
                            onClick={() => analyzeCapturedFrame('Mask')}>
                            <i className="bi bi-cpu"></i> Analyze Frame (Mask Test)
                          </button>
                          <button 
                            type="button" 
                            className="btn btn-outline-danger" 
                            onClick={() => analyzeCapturedFrame('No Mask')}>
                            No-Mask Test
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="card-custom">
                      <div className="card-custom-header">
                        <span className="fw-bold text-dark d-flex align-items-center gap-2">
                          <i className="bi bi-shield-check text-primary"></i> Classification Output
                        </span>
                        <span className="badge bg-secondary-subtle text-secondary">Awaiting Input</span>
                      </div>
                      <div className="card-custom-body">
                        <div className="empty-state py-4">
                          <i className="bi bi-person-video2 empty-state-icon"></i>
                          <h6 className="fw-bold text-dark mb-1">No Frame Captured Yet</h6>
                          <p className="text-muted small mb-0">
                            Start your webcam and click <strong>Capture Frame</strong> to evaluate compliance.
                          </p>
                        </div>
                        <div className="p-3 bg-light rounded-3 border small text-muted">
                          <strong className="d-block text-dark mb-1"><i className="bi bi-info-circle text-primary"></i> Django Note:</strong>
                          The captured frame is submitted to the backend via POST. Django extracts the image, crops the facial bounding box using OpenCV, feeds it into TensorFlow, and returns the verdict.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= PAGE: IMAGE DETECTION ================= */}
        {currentPage === 'image_detection' && (
          <div>
            <div className="py-5 bg-white border-bottom">
              <div className="container">
                <div className="row align-items-center">
                  <div className="col-12 col-md-8">
                    <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-3 py-1 rounded-pill mb-2">
                      <i className="bi bi-cloud-arrow-up"></i> Neural Network Still Image Processing
                    </span>
                    <h1 className="fw-bold text-dark mb-1">Detect Mask from Image</h1>
                    <p className="text-muted mb-0 lead fs-6">
                      Upload any photograph or security snapshot to detect facial masks, evaluate classification confidence, and generate detailed compliance audits.
                    </p>
                  </div>
                  <div className="col-12 col-md-4 text-md-end mt-3 mt-md-0">
                    <button 
                      type="button" 
                      className="btn btn-secondary-custom"
                      onClick={() => navigateTo('live_detection')}>
                      <i className="bi bi-camera-video"></i> Switch to Live Camera
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="container py-5">
              <div className="row justify-content-center">
                <div className="col-12 col-lg-8">
                  <div className="card-custom p-4 p-md-5 bg-white shadow-sm mb-4">
                    {uploadError && (
                      <div className="alert alert-danger d-flex align-items-center gap-2 mb-4 rounded-3" role="alert">
                        <i className="bi bi-exclamation-triangle-fill fs-5"></i>
                        <span>{uploadError}</span>
                      </div>
                    )}

                    <input 
                      type="file" 
                      ref={fileInputRef}
                      className="d-none" 
                      accept=".jpg, .jpeg, .png, image/jpeg, image/png"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleFileChange(e.target.files[0]);
                        }
                      }} 
                    />

                    <div 
                      className={`upload-dropzone ${isDragOver ? 'dragover' : ''}`}
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                      onDragLeave={() => setIsDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragOver(false);
                        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                          handleFileChange(e.dataTransfer.files[0]);
                        }
                      }}>
                      {!uploadedImageSrc ? (
                        <div>
                          <i className="bi bi-cloud-arrow-up upload-icon d-block"></i>
                          <h4 className="fw-bold text-dark mb-2">Drag & Drop Image Here</h4>
                          <p className="text-muted small mb-3">
                            or click to browse from your computer / device
                          </p>
                          <div className="d-inline-flex align-items-center gap-2 px-3 py-1 bg-light rounded-pill border text-muted small">
                            <i className="bi bi-file-earmark-image"></i> Supports <strong>JPG, JPEG, PNG</strong> (Max 10MB)
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="image-preview-container mb-3">
                            <img src={uploadedImageSrc} alt="Preview" className="image-preview-img" />
                          </div>
                          <p className="text-muted small mb-3">Image loaded and validated for TensorFlow input tensor (224 &times; 224).</p>
                          <button 
                            type="button" 
                            className="btn btn-sm btn-outline-danger"
                            onClick={(e) => {
                              e.stopPropagation();
                              setUploadedImageSrc('');
                              if (fileInputRef.current) fileInputRef.current.value = '';
                            }}>
                            <i className="bi bi-trash"></i> Remove & Choose Another
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mt-4 pt-3 border-top">
                      <div className="text-muted small">
                        <i className="bi bi-info-circle text-primary"></i> Image is analyzed on server using OpenCV & Keras.
                      </div>
                      <button 
                        type="button" 
                        className="btn btn-primary-custom px-4 py-2"
                        disabled={!uploadedImageSrc}
                        onClick={() => handleImageAnalysis()}>
                        <i className="bi bi-cpu"></i> Analyze Image
                      </button>
                    </div>
                  </div>

                  {/* Preset Samples */}
                  <div className="card-custom p-4 bg-light border">
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <h6 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                        <i className="bi bi-magic text-primary"></i> Quick Test Sample Presets
                      </h6>
                      <span className="text-muted small">Click to load test photos</span>
                    </div>

                    <div className="row g-3">
                      <div className="col-12 col-md-6">
                        <button 
                          type="button" 
                          className="btn btn-white w-100 p-2 text-start border bg-white rounded-3 d-flex align-items-center gap-3"
                          onClick={() => {
                            const url = 'https://images.unsplash.com/photo-1584634731339-252c581abfc5?w=500&auto=format&fit=crop&q=80';
                            setUploadedImageSrc(url);
                            handleImageAnalysis(url, 'Mask');
                          }}>
                          <div className="rounded-2 overflow-hidden" style={{ width: '48px', height: '48px', background: '#e2e8f0', flexShrink: 0 }}>
                            <img src="https://images.unsplash.com/photo-1584634731339-252c581abfc5?w=100&auto=format&fit=crop&q=60" alt="Mask Sample" className="w-100 h-100 object-fit-cover" />
                          </div>
                          <div>
                            <strong className="d-block text-dark small">Subject with Surgical Mask</strong>
                            <span className="badge bg-success-subtle text-success border border-success-subtle" style={{ fontSize: '0.7rem' }}>
                              Expected: Mask Detected (98%)
                            </span>
                          </div>
                        </button>
                      </div>

                      <div className="col-12 col-md-6">
                        <button 
                          type="button" 
                          className="btn btn-white w-100 p-2 text-start border bg-white rounded-3 d-flex align-items-center gap-3"
                          onClick={() => {
                            const url = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80';
                            setUploadedImageSrc(url);
                            handleImageAnalysis(url, 'No Mask');
                          }}>
                          <div className="rounded-2 overflow-hidden" style={{ width: '48px', height: '48px', background: '#e2e8f0', flexShrink: 0 }}>
                            <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=60" alt="No Mask Sample" className="w-100 h-100 object-fit-cover" />
                          </div>
                          <div>
                            <strong className="d-block text-dark small">Subject without Mask</strong>
                            <span className="badge bg-danger-subtle text-danger border border-danger-subtle" style={{ fontSize: '0.7rem' }}>
                              Expected: No Mask (96%)
                            </span>
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= PAGE: RESULT ================= */}
        {currentPage === 'result' && (
          <div>
            <div className="py-4 bg-white border-bottom">
              <div className="container">
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
                  <div>
                    <nav aria-label="breadcrumb">
                      <ol className="breadcrumb mb-1 small">
                        <li className="breadcrumb-item"><button className="btn btn-link p-0 text-decoration-none" onClick={() => navigateTo('home')}>Home</button></li>
                        <li className="breadcrumb-item"><button className="btn btn-link p-0 text-decoration-none" onClick={() => navigateTo('image_detection')}>Detection</button></li>
                        <li className="breadcrumb-item active" aria-current="page">Result</li>
                      </ol>
                    </nav>
                    <h1 className="fw-bold text-dark mb-0 fs-3">Detection Result</h1>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <span className="badge bg-success-subtle text-success border border-success-subtle px-3 py-2 rounded-pill">
                      <i className="bi bi-check-all"></i> Processing Complete
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="container py-5">
              <div className="row g-4">
                {/* Left: Input Image */}
                <div className="col-12 col-lg-6">
                  <div className="card-custom h-100">
                    <div className="card-custom-header">
                      <span className="fw-bold text-dark d-flex align-items-center gap-2">
                        <i className="bi bi-image text-primary"></i> Analyzed Image Frame
                      </span>
                      <span className="badge bg-secondary-subtle text-secondary">
                        RGB (224 &times; 224)
                      </span>
                    </div>
                    <div className="card-custom-body d-flex flex-column align-items-center justify-content-center">
                      <div className="image-preview-container w-100 mb-3" style={{ maxHeight: '380px' }}>
                        <img 
                          src={currentResult.imageUrl} 
                          alt="Analyzed Frame" 
                          className="image-preview-img w-100" />
                      </div>
                      <div className="w-100 d-flex justify-content-between text-muted small px-2">
                        <span>Source: <strong className="text-dark">{currentResult.checkpoint || 'User Session'}</strong></span>
                        <span>Target ROI: <strong className="text-success">Face Located (1)</strong></span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Prediction Card */}
                <div className="col-12 col-lg-6">
                  <div className="card-custom shadow-sm mb-4">
                    <div className="card-custom-header">
                      <span className="fw-bold text-dark d-flex align-items-center gap-2">
                        <i className="bi bi-cpu text-primary"></i> Deep Learning Verdict
                      </span>
                      <span className={currentResult.prediction === 'No Mask' ? 'badge-no-mask' : 'badge-mask'}>
                        {currentResult.prediction === 'No Mask' ? (
                          <><i className="bi bi-x-circle-fill"></i> Non-Compliant</>
                        ) : (
                          <><i className="bi bi-check-circle-fill"></i> Compliant</>
                        )}
                      </span>
                    </div>

                    <div className="card-custom-body">
                      <div className={`prediction-result-banner ${currentResult.prediction === 'No Mask' ? 'no-mask-detected' : 'mask-detected'}`}>
                        <h2 className="fw-bold mb-1 d-flex align-items-center justify-content-center gap-2">
                          {currentResult.prediction === 'No Mask' ? (
                            <><i className="bi bi-x-circle-fill text-danger fs-1"></i> NO MASK DETECTED</>
                          ) : (
                            <><i className="bi bi-check-circle-fill text-success fs-1"></i> MASK DETECTED</>
                          )}
                        </h2>
                        <p className="mb-0 small opacity-75">
                          Target face classified by MobileNetV2 convolutional layers.
                        </p>
                      </div>

                      <div className="mb-4">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span className="text-muted small fw-semibold">Prediction Confidence</span>
                          <span className="fw-bold text-dark fs-4">{currentResult.confidence}%</span>
                        </div>
                        <div className="progress confidence-progress">
                          <div 
                            className={`progress-bar ${currentResult.prediction === 'No Mask' ? 'bg-danger' : 'bg-success'}`}
                            role="progressbar" 
                            style={{ width: `${currentResult.confidence}%` }} 
                            aria-valuenow={currentResult.confidence} 
                            aria-valuemin={0} 
                            aria-valuemax={100}>
                          </div>
                        </div>
                      </div>

                      <div className="table-responsive mb-3">
                        <table className="table table-sm table-borderless small mb-0">
                          <tbody>
                            <tr className="border-bottom">
                              <td className="text-muted py-2"><i className="bi bi-stopwatch me-1"></i> Inference Latency</td>
                              <td className="text-end fw-bold text-dark py-2">{currentResult.inferenceTime}</td>
                            </tr>
                            <tr className="border-bottom">
                              <td className="text-muted py-2"><i className="bi bi-calendar-event me-1"></i> Timestamp</td>
                              <td className="text-end fw-bold text-dark py-2">{currentResult.date}, {currentResult.time}</td>
                            </tr>
                            <tr className="border-bottom">
                              <td className="text-muted py-2"><i className="bi bi-diagram-3 me-1"></i> Model Architecture</td>
                              <td className="text-end fw-bold text-dark py-2">MobileNetV2 (Keras)</td>
                            </tr>
                            <tr>
                              <td className="text-muted py-2"><i className="bi bi-hdd-network me-1"></i> Audit Status</td>
                              <td className="text-end text-success fw-bold py-2"><i className="bi bi-check-circle"></i> Logged to DB</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      <div className="d-flex flex-wrap gap-2 pt-3 border-top">
                        <button 
                          type="button" 
                          className="btn btn-primary-custom flex-grow-1 justify-content-center"
                          onClick={() => navigateTo('image_detection')}>
                          <i className="bi bi-arrow-repeat"></i> Detect Another Image
                        </button>
                        <button 
                          type="button" 
                          className="btn btn-secondary-custom"
                          onClick={() => navigateTo('history')}>
                          <i className="bi bi-clock-history"></i> View History
                        </button>
                        <button 
                          type="button" 
                          className="btn btn-outline-secondary"
                          onClick={() => navigateTo('dashboard')}>
                          <i className="bi bi-speedometer2"></i> Dashboard
                        </button>
                      </div>

                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= PAGE: HISTORY ================= */}
        {currentPage === 'history' && (
          <div>
            <div className="py-4 bg-white border-bottom">
              <div className="container">
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
                  <div>
                    <span className="badge bg-secondary-subtle text-secondary px-3 py-1 rounded-pill mb-1">
                      <i className="bi bi-shield-lock"></i> Compliance Audit Trail
                    </span>
                    <h1 className="fw-bold text-dark mb-0 fs-3">Detection History</h1>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <button 
                      type="button" 
                      className="btn btn-primary-custom btn-sm"
                      onClick={() => navigateTo('live_detection')}>
                      <i className="bi bi-camera-video"></i> New Detection
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="container py-5">
              <div className="card-custom p-3 mb-4 bg-white">
                <div className="row g-3 align-items-center">
                  <div className="col-12 col-md-6 col-lg-5">
                    <div className="input-group">
                      <span className="input-group-text bg-light border-end-0 text-muted">
                        <i className="bi bi-search"></i>
                      </span>
                      <input 
                        type="text" 
                        className="form-control border-start-0 ps-0" 
                        placeholder="Search by ID, status, date..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="col-6 col-md-3 col-lg-3">
                    <select 
                      className="form-select" 
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as any)}>
                      <option value="all">All Detections</option>
                      <option value="mask">Mask Only</option>
                      <option value="no_mask">No Mask Only</option>
                    </select>
                  </div>

                  <div className="col-6 col-md-3 col-lg-4 text-end text-muted small">
                    Showing <strong className="text-dark">{filteredDetections.length}</strong> of <strong className="text-dark">{totalDetectionsCount.toLocaleString()}</strong> logs
                  </div>
                </div>
              </div>

              <div className="card-custom bg-white shadow-sm overflow-hidden mb-4">
                <div className="table-responsive">
                  <table className="table table-custom table-hover align-middle mb-0">
                    <thead>
                      <tr>
                        <th scope="col" style={{ width: '60px' }}>#</th>
                        <th scope="col" style={{ width: '90px' }}>Image</th>
                        <th scope="col">Prediction Status</th>
                        <th scope="col">Confidence</th>
                        <th scope="col">Date</th>
                        <th scope="col">Time</th>
                        <th scope="col" className="text-end" style={{ width: '100px' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDetections.length > 0 ? (
                        filteredDetections.map((row) => (
                          <tr key={row.id}>
                            <td className="fw-bold text-muted">#{row.id}</td>
                            <td>
                              <img src={row.imageUrl} alt="Snapshot" className="table-thumbnail" />
                            </td>
                            <td>
                              {row.prediction === 'Mask' ? (
                                <span className="badge-mask"><i className="bi bi-check-circle-fill"></i> Mask</span>
                              ) : (
                                <span className="badge-no-mask"><i className="bi bi-x-circle-fill"></i> No Mask</span>
                              )}
                            </td>
                            <td>
                              <strong className="text-dark">{row.confidence}%</strong>
                            </td>
                            <td className="text-secondary">{row.date}</td>
                            <td className="text-secondary">{row.time}</td>
                            <td className="text-end">
                              <button 
                                type="button" 
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => {
                                  setCurrentResult(row);
                                  navigateTo('result');
                                }}>
                                <i className="bi bi-eye"></i> View
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="text-center py-5">
                            <div className="empty-state">
                              <i className="bi bi-inbox empty-state-icon"></i>
                              <h5 className="fw-bold text-dark mb-1">No detections found</h5>
                              <p className="text-muted small mb-3">Start your first detection to generate compliance history.</p>
                              <button 
                                type="button" 
                                className="btn btn-primary-custom btn-sm"
                                onClick={() => navigateTo('image_detection')}>
                                Start Detection
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              <nav aria-label="History Page navigation" className="mt-4">
                <ul className="pagination justify-content-center mb-0">
                  <li className="page-item disabled">
                    <button className="page-link" tabIndex={-1} aria-disabled="true">Previous</button>
                  </li>
                  <li className="page-item active"><button className="page-link">1</button></li>
                  <li className="page-item"><button className="page-link">2</button></li>
                  <li className="page-item"><button className="page-link">3</button></li>
                  <li className="page-item"><button className="page-link">Next</button></li>
                </ul>
              </nav>
            </div>
          </div>
        )}

        {/* ================= PAGE: DASHBOARD ================= */}
        {currentPage === 'dashboard' && (
          <div>
            <div className="py-4 bg-white border-bottom">
              <div className="container">
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
                  <div>
                    <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-3 py-1 rounded-pill mb-1">
                      <i className="bi bi-speedometer2"></i> Administrative Safety Console
                    </span>
                    <h1 className="fw-bold text-dark mb-0 fs-3">Detection Dashboard</h1>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <button 
                      type="button" 
                      className="btn btn-primary-custom btn-sm"
                      onClick={() => navigateTo('live_detection')}>
                      <i className="bi bi-camera-video"></i> Launch Live Feed
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-secondary-custom btn-sm"
                      onClick={() => navigateTo('history')}>
                      <i className="bi bi-journal-text"></i> Audit Logs
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="container py-5">
              {/* 4 Stat Cards */}
              <div className="row g-3 mb-4">
                <div className="col-12 col-sm-6 col-lg-3">
                  <div className="stat-card">
                    <div>
                      <div className="stat-label">Total Detections</div>
                      <div className="stat-value">{totalDetectionsCount.toLocaleString()}</div>
                      <div className="small text-success d-flex align-items-center gap-1">
                        <i className="bi bi-arrow-up-right"></i> +8.4% this week
                      </div>
                    </div>
                    <div className="stat-icon feature-icon-blue">
                      <i className="bi bi-people-fill"></i>
                    </div>
                  </div>
                </div>

                <div className="col-12 col-sm-6 col-lg-3">
                  <div className="stat-card">
                    <div>
                      <div className="stat-label">Masks Detected</div>
                      <div className="stat-value text-success">{maskCount.toLocaleString()}</div>
                      <div className="small text-success d-flex align-items-center gap-1">
                        <i className="bi bi-shield-check"></i> {maskPercentage}% Compliance
                      </div>
                    </div>
                    <div className="stat-icon feature-icon-green">
                      <i className="bi bi-check-circle-fill"></i>
                    </div>
                  </div>
                </div>

                <div className="col-12 col-sm-6 col-lg-3">
                  <div className="stat-card">
                    <div>
                      <div className="stat-label">No Masks Detected</div>
                      <div className="stat-value text-danger">{noMaskCount.toLocaleString()}</div>
                      <div className="small text-danger d-flex align-items-center gap-1">
                        <i className="bi bi-shield-x"></i> {noMaskPercentage}% Non-Compliant
                      </div>
                    </div>
                    <div className="stat-icon feature-icon-amber" style={{ backgroundColor: '#fee2e2', color: '#ef4444' }}>
                      <i className="bi bi-exclamation-triangle-fill"></i>
                    </div>
                  </div>
                </div>

                <div className="col-12 col-sm-6 col-lg-3">
                  <div className="stat-card">
                    <div>
                      <div className="stat-label">Model Accuracy</div>
                      <div className="stat-value text-primary">98.6%</div>
                      <div className="small text-primary d-flex align-items-center gap-1">
                        <i className="bi bi-patch-check-fill"></i> MobileNetV2 Val
                      </div>
                    </div>
                    <div className="stat-icon feature-icon-purple">
                      <i className="bi bi-cpu-fill"></i>
                    </div>
                  </div>
                </div>
              </div>

              {/* Breakdown & Timeline Distribution */}
              <div className="row g-4 mb-4">
                <div className="col-12 col-lg-5">
                  <div className="card-custom h-100">
                    <div className="card-custom-header">
                      <span className="fw-bold text-dark d-flex align-items-center gap-2">
                        <i className="bi bi-pie-chart text-primary"></i> Detection Summary
                      </span>
                      <span className="badge bg-light text-dark border">All Checkpoints</span>
                    </div>
                    <div className="card-custom-body">
                      <div className="mb-4">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span className="fw-semibold text-dark small d-flex align-items-center gap-1">
                            <i className="bi bi-check-circle-fill text-success"></i> Mask Compliance
                          </span>
                          <span className="fw-bold text-success">{maskPercentage}%</span>
                        </div>
                        <div className="progress" style={{ height: '10px', borderRadius: '9999px' }}>
                          <div className="progress-bar bg-success" style={{ width: `${maskPercentage}%` }}></div>
                        </div>
                      </div>

                      <div className="mb-4">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span className="fw-semibold text-dark small d-flex align-items-center gap-1">
                            <i className="bi bi-x-circle-fill text-danger"></i> No Mask (Non-Compliant)
                          </span>
                          <span className="fw-bold text-danger">{noMaskPercentage}%</span>
                        </div>
                        <div className="progress" style={{ height: '10px', borderRadius: '9999px' }}>
                          <div className="progress-bar bg-danger" style={{ width: `${noMaskPercentage}%` }}></div>
                        </div>
                      </div>

                      <div className="p-3 bg-light rounded-3 border small">
                        <div className="d-flex justify-content-between mb-1">
                          <span className="text-muted">Peak Compliance Hour:</span>
                          <strong className="text-dark">08:00 - 10:00 AM (89%)</strong>
                        </div>
                        <div className="d-flex justify-content-between">
                          <span className="text-muted">Primary Checkpoint:</span>
                          <strong className="text-dark">Gate 1 South Terminal</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-12 col-lg-7">
                  <div className="card-custom h-100">
                    <div className="card-custom-header">
                      <span className="fw-bold text-dark d-flex align-items-center gap-2">
                        <i className="bi bi-bar-chart-line text-primary"></i> Hourly Detection Volume
                      </span>
                      <span className="badge bg-light text-muted border">Today (24h)</span>
                    </div>
                    <div className="card-custom-body d-flex flex-column justify-content-between">
                      <p className="text-muted small mb-3">Visual breakdown of facial scans recorded per two-hour interval across security turnstiles.</p>
                      
                      <div className="d-flex align-items-end justify-content-between gap-2 pt-4 pb-2" style={{ height: '160px' }}>
                        <div className="text-center flex-grow-1">
                          <div className="bg-primary-subtle rounded-top mx-auto" style={{ height: '35px', width: '80%' }}></div>
                          <span className="text-muted" style={{ fontSize: '0.7rem' }}>06:00</span>
                        </div>
                        <div className="text-center flex-grow-1">
                          <div className="bg-primary rounded-top mx-auto" style={{ height: '120px', width: '80%' }}></div>
                          <span className="text-muted" style={{ fontSize: '0.7rem' }}>08:00</span>
                        </div>
                        <div className="text-center flex-grow-1">
                          <div className="bg-primary rounded-top mx-auto" style={{ height: '95px', width: '80%' }}></div>
                          <span className="text-muted" style={{ fontSize: '0.7rem' }}>10:00</span>
                        </div>
                        <div className="text-center flex-grow-1">
                          <div className="bg-primary-subtle rounded-top mx-auto" style={{ height: '60px', width: '80%' }}></div>
                          <span className="text-muted" style={{ fontSize: '0.7rem' }}>12:00</span>
                        </div>
                        <div className="text-center flex-grow-1">
                          <div className="bg-primary-subtle rounded-top mx-auto" style={{ height: '50px', width: '80%' }}></div>
                          <span className="text-muted" style={{ fontSize: '0.7rem' }}>14:00</span>
                        </div>
                        <div className="text-center flex-grow-1">
                          <div className="bg-primary rounded-top mx-auto" style={{ height: '110px', width: '80%' }}></div>
                          <span className="text-muted" style={{ fontSize: '0.7rem' }}>16:00</span>
                        </div>
                        <div className="text-center flex-grow-1">
                          <div className="bg-primary-subtle rounded-top mx-auto" style={{ height: '70px', width: '80%' }}></div>
                          <span className="text-muted" style={{ fontSize: '0.7rem' }}>18:00</span>
                        </div>
                      </div>

                      <div className="d-flex justify-content-between text-muted small pt-2 border-top">
                        <span><i className="bi bi-circle-fill text-primary small"></i> High Traffic Shifts</span>
                        <span><i className="bi bi-circle-fill text-primary-emphasis opacity-50 small"></i> Normal Traffic</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Detections & System Status */}
              <div className="row g-4">
                <div className="col-12 col-lg-8">
                  <div className="card-custom">
                    <div className="card-custom-header">
                      <span className="fw-bold text-dark d-flex align-items-center gap-2">
                        <i className="bi bi-clock-history text-primary"></i> Recent Detections
                      </span>
                      <button 
                        type="button" 
                        className="btn btn-sm btn-link text-decoration-none fw-semibold"
                        onClick={() => navigateTo('history')}>
                        View All &rarr;
                      </button>
                    </div>
                    <div className="card-custom-body p-0">
                      <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0 small">
                          <thead className="table-light">
                            <tr>
                              <th>ID</th>
                              <th>Snapshot</th>
                              <th>Verdict</th>
                              <th>Confidence</th>
                              <th>Time</th>
                              <th className="text-end">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detections.slice(0, 5).map(item => (
                              <tr key={item.id}>
                                <td className="fw-bold text-muted">#{item.id}</td>
                                <td>
                                  <img src={item.imageUrl} alt="Thumb" className="table-thumbnail" style={{ width: '36px', height: '36px' }} />
                                </td>
                                <td>
                                  <span className={item.prediction === 'Mask' ? 'badge-mask py-1 px-2' : 'badge-no-mask py-1 px-2'} style={{ fontSize: '0.75rem' }}>
                                    {item.prediction === 'Mask' ? <><i className="bi bi-check-circle-fill"></i> Mask</> : <><i className="bi bi-x-circle-fill"></i> No Mask</>}
                                  </span>
                                </td>
                                <td><strong>{item.confidence}%</strong></td>
                                <td className="text-muted">{item.time}</td>
                                <td className="text-end">
                                  <button 
                                    className="btn btn-xs btn-outline-primary btn-sm py-0 px-2"
                                    onClick={() => {
                                      setCurrentResult(item);
                                      navigateTo('result');
                                    }}>
                                    View
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-12 col-lg-4">
                  <div className="card-custom p-4 mb-4">
                    <h6 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
                      <i className="bi bi-hdd-rack text-primary"></i> System Status
                    </h6>
                    <div className="d-flex flex-column gap-3 small">
                      <div className="d-flex align-items-center justify-content-between p-2 bg-light rounded-2 border">
                        <span className="d-flex align-items-center gap-2">
                          <i className="bi bi-cpu text-primary"></i> ML Model (MobileNetV2)
                        </span>
                        <span className="badge bg-success"><i className="bi bi-check-circle"></i> Active</span>
                      </div>

                      <div className="d-flex align-items-center justify-content-between p-2 bg-light rounded-2 border">
                        <span className="d-flex align-items-center gap-2">
                          <i className="bi bi-camera-video text-primary"></i> Camera Sensor Stream
                        </span>
                        <span className="badge bg-success"><i className="bi bi-check-circle"></i> Ready</span>
                      </div>

                      <div className="d-flex align-items-center justify-content-between p-2 bg-light rounded-2 border">
                        <span className="d-flex align-items-center gap-2">
                          <i className="bi bi-database text-primary"></i> SQLite / PostgreSQL DB
                        </span>
                        <span className="badge bg-success"><i className="bi bi-check-circle"></i> Connected</span>
                      </div>

                      <div className="d-flex align-items-center justify-content-between p-2 bg-light rounded-2 border">
                        <span className="d-flex align-items-center gap-2">
                          <i className="bi bi-shield-check text-primary"></i> Detection Service
                        </span>
                        <span className="badge bg-primary"><i className="bi bi-wifi"></i> Online</span>
                      </div>
                    </div>
                  </div>

                  <div className="card-custom p-4">
                    <div className="d-flex align-items-center gap-3 mb-3">
                      <div className="brand-icon-wrapper" style={{ width: '44px', height: '44px', fontSize: '1.3rem' }}>
                        <i className="bi bi-person-badge"></i>
                      </div>
                      <div>
                        <h6 className="fw-bold text-dark mb-0">{username}</h6>
                        <span className="text-muted small">officer@facility.org</span>
                      </div>
                    </div>

                    <div className="border-top pt-3 text-muted small">
                      <div className="d-flex justify-content-between mb-1">
                        <span>Session Inferences:</span>
                        <strong className="text-dark">{detections.length * 12} scans</strong>
                      </div>
                      <div className="d-flex justify-content-between">
                        <span>Last Active:</span>
                        <strong className="text-dark">Just now</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= PAGE: LOGIN ================= */}
        {currentPage === 'login' && (
          <div className="auth-wrapper">
            <div className="auth-card">
              <div className="text-center mb-4">
                <div className="brand-icon-wrapper mb-3" style={{ width: '48px', height: '48px', fontSize: '1.5rem', margin: '0 auto' }}>
                  <i className="bi bi-shield-check"></i>
                </div>
                <h3 className="fw-bold text-dark mb-1">Welcome Back</h3>
                <p className="text-muted small">Sign in to access the detection console and audit logs</p>
              </div>

              <form onSubmit={(e) => {
                e.preventDefault();
                setIsLoggedIn(true);
                showToast('Signed in successfully as Security Officer.', 'success');
                navigateTo('dashboard');
              }}>
                <div className="mb-3">
                  <label className="form-label fw-semibold small text-dark">
                    Username or Email Address
                  </label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-end-0 text-muted">
                      <i className="bi bi-person"></i>
                    </span>
                    <input 
                      type="text" 
                      className="form-control border-start-0 ps-0" 
                      placeholder="e.g. security_officer" 
                      defaultValue="security_officer"
                      required />
                  </div>
                </div>

                <div className="mb-3">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <label className="form-label fw-semibold small text-dark mb-0">Password</label>
                    <a href="#forgot" onClick={(e) => { e.preventDefault(); showToast('Password reset link sent to registered email.', 'info'); }} className="text-primary text-decoration-none small">Forgot password?</a>
                  </div>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-end-0 text-muted">
                      <i className="bi bi-lock"></i>
                    </span>
                    <input 
                      type="password" 
                      className="form-control border-start-0 ps-0" 
                      placeholder="••••••••" 
                      defaultValue="password123"
                      required />
                  </div>
                </div>

                <div className="mb-4 form-check">
                  <input type="checkbox" className="form-check-input" id="rememberMeCheckbox" defaultChecked />
                  <label className="form-check-label small text-muted" htmlFor="rememberMeCheckbox">
                    Keep me signed in on this device
                  </label>
                </div>

                <button type="submit" className="btn btn-primary-custom w-100 py-2 justify-content-center">
                  <i className="bi bi-box-arrow-in-right"></i> Sign In to FaceGuard
                </button>
              </form>

              <div className="text-center mt-4 pt-3 border-top">
                <p className="text-muted small mb-0">
                  Don't have an account?{' '}
                  <button type="button" className="btn btn-link text-primary fw-semibold p-0 text-decoration-none" onClick={() => navigateTo('register')}>
                    Create Account
                  </button>
                </p>
              </div>

              <div className="mt-4 p-2 bg-light rounded-3 text-center border">
                <span className="django-tag-pill">Django Auth</span>
                <p className="text-muted mb-0" style={{ fontSize: '0.75rem', marginTop: '4px' }}>
                  Connects directly to <code>django.contrib.auth.views.LoginView</code>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ================= PAGE: REGISTER ================= */}
        {currentPage === 'register' && (
          <div className="auth-wrapper">
            <div className="auth-card" style={{ maxWidth: '520px' }}>
              <div className="text-center mb-4">
                <div className="brand-icon-wrapper mb-3" style={{ width: '48px', height: '48px', fontSize: '1.5rem', margin: '0 auto' }}>
                  <i className="bi bi-person-plus"></i>
                </div>
                <h3 className="fw-bold text-dark mb-1">Create Account</h3>
                <p className="text-muted small">Register a safety administrator or security officer profile</p>
              </div>

              <form onSubmit={(e) => {
                e.preventDefault();
                setIsLoggedIn(true);
                setUsername('Officer Davis');
                showToast('Registration successful! Account activated.', 'success');
                navigateTo('dashboard');
              }}>
                <div className="mb-3">
                  <label className="form-label fw-semibold small text-dark">Full Name</label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-end-0 text-muted">
                      <i className="bi bi-card-heading"></i>
                    </span>
                    <input type="text" className="form-control border-start-0 ps-0" placeholder="e.g. Officer John Davis" required />
                  </div>
                </div>

                <div className="row g-2 mb-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-semibold small text-dark">Username</label>
                    <div className="input-group">
                      <span className="input-group-text bg-light border-end-0 text-muted">
                        <i className="bi bi-person"></i>
                      </span>
                      <input type="text" className="form-control border-start-0 ps-0" placeholder="johndavis" required />
                    </div>
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-semibold small text-dark">Email Address</label>
                    <div className="input-group">
                      <span className="input-group-text bg-light border-end-0 text-muted">
                        <i className="bi bi-envelope"></i>
                      </span>
                      <input type="email" className="form-control border-start-0 ps-0" placeholder="john@facility.org" required />
                    </div>
                  </div>
                </div>

                <div className="row g-2 mb-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-semibold small text-dark">Password</label>
                    <div className="input-group">
                      <span className="input-group-text bg-light border-end-0 text-muted">
                        <i className="bi bi-lock"></i>
                      </span>
                      <input type="password" className="form-control border-start-0 ps-0" placeholder="••••••••" required />
                    </div>
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-semibold small text-dark">Confirm Password</label>
                    <div className="input-group">
                      <span className="input-group-text bg-light border-end-0 text-muted">
                        <i className="bi bi-shield-lock"></i>
                      </span>
                      <input type="password" className="form-control border-start-0 ps-0" placeholder="••••••••" required />
                    </div>
                  </div>
                </div>

                <div className="mb-4 form-check">
                  <input type="checkbox" className="form-check-input" id="agreeTerms" required />
                  <label className="form-check-label small text-muted" htmlFor="agreeTerms">
                    I agree to the facility monitoring terms and privacy regulations.
                  </label>
                </div>

                <button type="submit" className="btn btn-primary-custom w-100 py-2 justify-content-center">
                  <i className="bi bi-person-check"></i> Create Account
                </button>
              </form>

              <div className="text-center mt-4 pt-3 border-top">
                <p className="text-muted small mb-0">
                  Already have an account?{' '}
                  <button type="button" className="btn btn-link text-primary fw-semibold p-0 text-decoration-none" onClick={() => navigateTo('login')}>
                    Sign In
                  </button>
                </p>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* -------------------------------------------------------------
          4. FOOTER COMPONENT (Corresponds to templates/components/footer.html)
          ------------------------------------------------------------- */}
      <footer className="footer-custom mt-auto">
        <div className="container">
          <div className="row g-4 mb-4">
            <div className="col-12 col-md-5">
              <div className="footer-brand">
                <div className="brand-icon-wrapper" style={{ width: '32px', height: '32px', fontSize: '1rem' }}>
                  <i className="bi bi-shield-check"></i>
                </div>
                <span>FaceGuard AI</span>
              </div>
              <p className="text-muted mb-3" style={{ maxWidth: '380px' }}>
                Production-grade AI-powered face mask detection system built for real-time compliance monitoring across hospitals, schools, airports, and corporate workspaces.
              </p>
              <div className="d-flex align-items-center gap-2">
                <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1 rounded-pill">
                  <i className="bi bi-cpu"></i> TensorFlow / Keras 2.x
                </span>
                <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1 rounded-pill">
                  <i className="bi bi-camera"></i> OpenCV 4.x
                </span>
              </div>
            </div>

            <div className="col-6 col-md-3 offset-md-1">
              <h6 className="text-dark fw-bold mb-3">Navigation</h6>
              <ul className="footer-links">
                <li><button className="btn btn-link p-0 text-decoration-none text-muted" onClick={() => navigateTo('home')}><i className="bi bi-chevron-right me-1 small"></i> Home</button></li>
                <li><button className="btn btn-link p-0 text-decoration-none text-muted" onClick={() => navigateTo('about')}><i className="bi bi-chevron-right me-1 small"></i> About & Architecture</button></li>
                <li><button className="btn btn-link p-0 text-decoration-none text-muted" onClick={() => navigateTo('live_detection')}><i className="bi bi-chevron-right me-1 small"></i> Live Webcam Feed</button></li>
                <li><button className="btn btn-link p-0 text-decoration-none text-muted" onClick={() => navigateTo('image_detection')}><i className="bi bi-chevron-right me-1 small"></i> Image Analyzer</button></li>
                <li><button className="btn btn-link p-0 text-decoration-none text-muted" onClick={() => navigateTo('dashboard')}><i className="bi bi-chevron-right me-1 small"></i> Analytics Dashboard</button></li>
                <li><button className="btn btn-link p-0 text-decoration-none text-muted" onClick={() => navigateTo('history')}><i className="bi bi-chevron-right me-1 small"></i> Detection Logs</button></li>
              </ul>
            </div>

            <div className="col-6 col-md-3">
              <h6 className="text-dark fw-bold mb-3">System Health</h6>
              <div className="d-flex flex-column gap-2 small">
                <div className="d-flex align-items-center justify-content-between py-1 border-bottom">
                  <span>Inference Engine</span>
                  <span className="text-success fw-semibold"><i className="bi bi-check-circle-fill"></i> Active</span>
                </div>
                <div className="d-flex align-items-center justify-content-between py-1 border-bottom">
                  <span>Model Version</span>
                  <span className="text-dark fw-semibold">MobileNetV2 (v1.4)</span>
                </div>
                <div className="d-flex align-items-center justify-content-between py-1 border-bottom">
                  <span>Backend Integration</span>
                  <span className="text-primary fw-semibold">Django 5.x Ready</span>
                </div>
              </div>
            </div>
          </div>

          <div className="border-top pt-3 text-center text-muted small">
            <p className="mb-0">
              &copy; 2026 FaceGuard AI developed by <strong>Adarsh Singh</strong>. All Rights Reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* -------------------------------------------------------------
          5. FLOATING DJANGO CODE & ARCHITECTURE INSPECTOR (FOR LEARNING)
          ------------------------------------------------------------- */}
      <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 1050 }}>
        <button 
          type="button" 
          className="btn btn-dark shadow-lg d-flex align-items-center gap-2 px-3 py-2 rounded-pill border border-secondary"
          onClick={() => setShowCodeInspector(!showCodeInspector)}>
          <i className="bi bi-code-square text-warning fs-5"></i>
          <span className="small fw-bold">Django Learning & Code Inspector</span>
        </button>
      </div>

      {/* Code Inspector Modal / Offcanvas Drawer */}
      {showCodeInspector && (
        <div 
          className="modal fade show d-block" 
          tabIndex={-1} 
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)' }}>
          <div className="modal-dialog modal-xl modal-dialog-scrollable">
            <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
              <div className="modal-header bg-dark text-white px-4 py-3 border-bottom border-secondary">
                <div className="d-flex align-items-center gap-2">
                  <span className="badge bg-success">Django 5.x + ML</span>
                  <h5 className="modal-title fw-bold mb-0">Django Integration Code & Learning Hub</h5>
                </div>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowCodeInspector(false)} aria-label="Close"></button>
              </div>

              <div className="modal-body p-0 bg-light">
                {/* Tabs */}
                <div className="bg-white border-bottom px-4 pt-3 d-flex gap-2">
                  <button 
                    className={`btn btn-sm ${activeCodeTab === 'template' ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => setActiveCodeTab('template')}>
                    <i className="bi bi-filetype-html"></i> Current Page Template ({currentPage}.html)
                  </button>
                  <button 
                    className={`btn btn-sm ${activeCodeTab === 'views' ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => setActiveCodeTab('views')}>
                    <i className="bi bi-filetype-py"></i> Django Views (views.py)
                  </button>
                  <button 
                    className={`btn btn-sm ${activeCodeTab === 'ml_utils' ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => setActiveCodeTab('ml_utils')}>
                    <i className="bi bi-cpu"></i> OpenCV + Keras (ml_utils.py)
                  </button>
                  <button 
                    className={`btn btn-sm ${activeCodeTab === 'models' ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => setActiveCodeTab('models')}>
                    <i className="bi bi-database"></i> Models (models.py)
                  </button>
                </div>

                <div className="p-4">
                  {activeCodeTab === 'template' && (
                    <div>
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <span className="text-dark fw-bold small"><code>templates/{currentPage}.html</code></span>
                        <span className="badge bg-info text-dark">Template Engine: DTL</span>
                      </div>
                      <pre className="p-3 bg-dark text-light rounded-3 small overflow-auto" style={{ maxHeight: '420px', fontFamily: 'JetBrains Mono, monospace' }}>
{`{% extends 'base.html' %}

{% block title %}FaceGuard AI — ${currentPage}{% endblock %}

{% block content %}
<!-- Page: ${currentPage}.html -->
<!-- Uses Bootstrap 5.3 + Custom CSS for responsive cards & controls -->
<!-- Form actions submit with {% csrf_token %} -->
<!-- Dynamic variables: {{ prediction }}, {{ confidence }}, {{ total_detections }} -->
{% endblock %}`}
                      </pre>
                    </div>
                  )}

                  {activeCodeTab === 'views' && (
                    <div>
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <span className="text-dark fw-bold small"><code>detection/views.py</code></span>
                        <span className="badge bg-primary">Python 3.11</span>
                      </div>
                      <pre className="p-3 bg-dark text-light rounded-3 small overflow-auto" style={{ maxHeight: '420px', fontFamily: 'JetBrains Mono, monospace' }}>
{`from django.shortcuts import render, redirect
from .models import DetectionLog
from .ml_utils import detect_and_predict_mask

def result_view(request):
    if request.method == 'POST' and request.FILES.get('image'):
        uploaded_file = request.FILES['image']
        prediction, confidence = detect_and_predict_mask(uploaded_file.read())
        
        log = DetectionLog.objects.create(
            image=uploaded_file,
            prediction=prediction,
            confidence=confidence
        )
        return render(request, 'result.html', {
            'prediction': prediction,
            'confidence': confidence,
            'image_url': log.image.url
        })
    return redirect('image_detection')`}
                      </pre>
                    </div>
                  )}

                  {activeCodeTab === 'ml_utils' && (
                    <div>
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <span className="text-dark fw-bold small"><code>detection/ml_utils.py</code></span>
                        <span className="badge bg-success">TensorFlow / Keras 2.x</span>
                      </div>
                      <pre className="p-3 bg-dark text-light rounded-3 small overflow-auto" style={{ maxHeight: '420px', fontFamily: 'JetBrains Mono, monospace' }}>
{`import cv2
import numpy as np
from tensorflow.keras.models import load_model
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input

model = load_model('models/mask_detector.model')
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

def detect_and_predict_mask(image_bytes):
    nparr = np.frombuffer(image_bytes, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, 1.1, 4)

    for (x, y, w, h) in faces:
        face = image[y:y+h, x:x+w]
        face = cv2.cvtColor(face, cv2.COLOR_BGR2RGB)
        face = cv2.resize(face, (224, 224))
        face = preprocess_input(face)
        face = np.expand_dims(face, axis=0)

        (mask, withoutMask) = model.predict(face)[0]
        prediction = 'Mask' if mask > withoutMask else 'No Mask'
        confidence = float(max(mask, withoutMask)) * 100
        return prediction, round(confidence, 2)
    return 'No Face Detected', 0.0`}
                      </pre>
                    </div>
                  )}

                  {activeCodeTab === 'models' && (
                    <div>
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <span className="text-dark fw-bold small"><code>detection/models.py</code></span>
                        <span className="badge bg-secondary">Django ORM</span>
                      </div>
                      <pre className="p-3 bg-dark text-light rounded-3 small overflow-auto" style={{ maxHeight: '420px', fontFamily: 'JetBrains Mono, monospace' }}>
{`from django.db import models
from django.contrib.auth.models import User

class DetectionLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    image = models.ImageField(upload_to='detections/%Y/%m/%d/')
    prediction = models.CharField(max_length=20, choices=[('Mask', 'Mask'), ('No Mask', 'No Mask')])
    confidence = models.FloatField()
    inference_time = models.CharField(max_length=20, default='35ms')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']`}
                      </pre>
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer bg-white border-top">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCodeInspector(false)}>Close Inspector</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
