import React, { useEffect, useRef, useState } from 'react';
import {
  CameraIcon,
  XMarkIcon,
  ArrowPathIcon,
  CheckIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import styles from './CameraCaptureModal.module.css';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

export default function CameraCaptureModal({
  isOpen,
  onClose,
  onCapture,
}: CameraCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState<number>(0);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Start webcam when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let activeStream: MediaStream | null = null;

    async function startCamera(deviceId?: string) {
      setIsLoading(true);
      setError(null);
      setCapturedImage(null);
      setCapturedBlob(null);

      try {
        const constraints: MediaStreamConstraints = {
          video: deviceId
            ? { deviceId: { exact: deviceId }, width: { ideal: 720 }, height: { ideal: 720 } }
            : { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
          audio: false,
        };

        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        activeStream = mediaStream;
        setStream(mediaStream);

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(() => {});
        }

        // List cameras
        if (navigator.mediaDevices.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter((d) => d.kind === 'videoinput');
          setAvailableCameras(videoDevices);
        }
      } catch (err: any) {
        console.error('Camera initialization error:', err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError('Camera permission was denied. Please allow camera access in your browser address bar.');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setError('No camera device detected. Please connect a webcam or upload a photo.');
        } else {
          setError(err.message || 'Unable to access your device camera.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    const deviceId = availableCameras[currentCameraIndex]?.deviceId;
    startCamera(deviceId);

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isOpen, currentCameraIndex]);

  // Switch between front/back or multiple cameras
  const handleSwitchCamera = () => {
    if (availableCameras.length > 1) {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      setCurrentCameraIndex((prev) => (prev + 1) % availableCameras.length);
    }
  };

  // Capture current frame from video to canvas
  const handleCapture = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    const canvas = document.createElement('canvas');
    const size = Math.min(video.videoWidth || 640, video.videoHeight || 640);
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const startX = ((video.videoWidth || 640) - size) / 2;
    const startY = ((video.videoHeight || 640) - size) / 2;

    // Mirror image for natural portrait selfie
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, startX, startY, size, size, 0, 0, 512, 512);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          setCapturedBlob(blob);
          const previewUrl = URL.createObjectURL(blob);
          setCapturedImage(previewUrl);
        }
      },
      'image/jpeg',
      0.92
    );
  };

  // Retake photo
  const handleRetake = () => {
    if (capturedImage) {
      URL.revokeObjectURL(capturedImage);
    }
    setCapturedImage(null);
    setCapturedBlob(null);
    if (videoRef.current && stream) {
      videoRef.current.play().catch(() => {});
    }
  };

  // Confirm photo selection
  const handleConfirm = () => {
    if (capturedBlob) {
      const file = new File([capturedBlob], `camera-avatar-${Date.now()}.jpg`, {
        type: 'image/jpeg',
      });
      onCapture(file);
      handleClose();
    }
  };

  // Cleanup and close
  const handleClose = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (capturedImage) {
      URL.revokeObjectURL(capturedImage);
    }
    setCapturedImage(null);
    setCapturedBlob(null);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.headerTitleGroup}>
            <div className={styles.headerIconBadge}>
              <CameraIcon className={styles.headerIcon} />
            </div>
            <div>
              <h3 className={styles.modalTitle}>Capture Profile Photo</h3>
              <p className={styles.modalSubtitle}>Align your face inside the circle guide</p>
            </div>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={handleClose}
            aria-label="Close camera modal"
            title="Close"
          >
            <XMarkIcon className={styles.closeIcon} />
          </button>
        </div>

        {/* Viewport */}
        <div className={styles.viewportContainer}>
          {isLoading && (
            <div className={styles.loadingState}>
              <div className={styles.spinner} />
              <span>Starting camera stream...</span>
            </div>
          )}

          {error && (
            <div className={styles.errorState}>
              <ExclamationCircleIcon style={{ width: 32, height: 32 }} />
              <h4 className={styles.errorTitle}>Camera Unavailable</h4>
              <p className={styles.errorMsg}>{error}</p>
              <button
                type="button"
                className={styles.retryBtn}
                onClick={() => setCurrentCameraIndex((prev) => prev)}
              >
                Retry Camera
              </button>
            </div>
          )}

          {/* Live Video Feed */}
          <video
            ref={videoRef}
            className={styles.videoElement}
            autoPlay
            playsInline
            muted
            style={{ display: capturedImage || error || isLoading ? 'none' : 'block' }}
          />

          {/* Captured Preview Image */}
          {capturedImage && (
            <img
              src={capturedImage}
              alt="Captured snapshot preview"
              className={styles.previewImage}
            />
          )}

          {/* Circular Frame Guide Overlay */}
          {!error && !isLoading && (
            <div className={styles.guideOverlay}>
              <div className={styles.guideCircle} />
              <div className={styles.guideHint}>
                {capturedImage ? 'Snapshot Preview' : 'Center face in circle'}
              </div>
            </div>
          )}

          {/* Switch Camera Button (if multiple cameras detected) */}
          {!capturedImage && !error && availableCameras.length > 1 && (
            <button
              type="button"
              className={styles.switchCameraBtn}
              onClick={handleSwitchCamera}
              title="Switch camera device"
            >
              <ArrowPathIcon className={styles.switchCameraIcon} />
            </button>
          )}
        </div>

        {/* Footer Actions */}
        <div className={styles.modalFooter}>
          {!capturedImage ? (
            <button
              type="button"
              className={styles.shutterBtn}
              onClick={handleCapture}
              disabled={isLoading || Boolean(error)}
              title="Snap photo"
              aria-label="Capture snapshot"
            >
              <div className={styles.shutterInner} />
            </button>
          ) : (
            <div className={styles.reviewActions}>
              <button
                type="button"
                className={styles.retakeBtn}
                onClick={handleRetake}
              >
                <ArrowPathIcon className={styles.actionBtnIcon} />
                <span>Retake</span>
              </button>

              <button
                type="button"
                className={styles.confirmBtn}
                onClick={handleConfirm}
              >
                <CheckIcon className={styles.actionBtnIcon} />
                <span>Use This Photo</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
