import { useEffect, useRef, useState, useCallback } from "react";

// ---------------- CAMERA STREAM ----------------
// Thin wrapper around getUserMedia with the rules this feature actually needs to follow on
// iOS Safari / PWA (section 5 of the scan-food spec): never auto-starts — start() must be
// called from a real user gesture (a tap handler), and every stream this hook opens is
// guaranteed to stop — on cancel, on unmount, or when the caller explicitly stops it. A
// camera left running after the user leaves the screen is exactly the bug this exists to
// prevent.
//
// status: "idle" | "requesting" | "streaming" | "denied" | "unsupported" | "error"
export function useCameraStream() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState("idle");
  const [errorMessage, setErrorMessage] = useState(null);
  const [stream, setStream] = useState(null);

  // Bumped on every start()/stop() call. A start() that's still awaiting getUserMedia when a
  // newer stop() or start() supersedes it checks this before touching state — otherwise a
  // slow, stale permission grant can resolve *after* the stream was already torn down (or
  // replaced) and clobber the current one with a stream nothing else knows to stop. Real risk
  // even outside of React StrictMode's dev-only double-invoke: a user tapping cancel/retry
  // fast enough to overlap two getUserMedia calls hits the same race in production.
  const generationRef = useRef(0);

  const stop = useCallback(() => {
    generationRef.current += 1;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setStream(null);
    setStatus((s) => (s === "streaming" ? "idle" : s));
  }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      setErrorMessage("This browser doesn't support camera access.");
      return false;
    }
    const myGeneration = ++generationRef.current;
    setStatus("requesting");
    setErrorMessage(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      if (myGeneration !== generationRef.current) {
        // Superseded by a stop()/start() that happened while this was in flight — this stream
        // is orphaned, so stop it immediately rather than leave a camera light on nothing is
        // tracking, and never touch the (now stale) video element or state.
        mediaStream.getTracks().forEach((track) => track.stop());
        return false;
      }
      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play().catch(() => {});
      }
      setStream(mediaStream);
      setStatus("streaming");
      return true;
    } catch (e) {
      if (myGeneration !== generationRef.current) return false;
      if (e && (e.name === "NotAllowedError" || e.name === "PermissionDeniedError")) {
        setStatus("denied");
        setErrorMessage("Camera access was denied.");
      } else if (e && e.name === "NotFoundError") {
        setStatus("unsupported");
        setErrorMessage("No camera was found on this device.");
      } else {
        setStatus("error");
        setErrorMessage(e?.message || "Couldn't open the camera.");
      }
      return false;
    }
  }, []);

  // Guarantees the stream stops even if the caller forgets — navigating away from a screen
  // that holds this hook unmounts it, which is the last line of defense against a stuck
  // camera light.
  useEffect(() => stop, [stop]);

  return { videoRef, stream, status, errorMessage, start, stop };
}
