# An app that allows user to learn what is their best way of taking photos

## Problem Statement
Many people don't actually know how to take good photos of themselves. Most of the time, they're clueless and embarrassed to take multiple angles of photos just to not be satisfied with all of them, or worst of all, blindly accepting a bad photo of themselves. 

## The Goal
We want to create an AI app that easily and realistically shows them how they could take better photos of themselves. 

## Challenges 

s
## Use cases
1. Solo Content Creation  - Selfies, outfit-of-the-day, dating profile pics
2. Pose learning & Practise mode - browse curated pose library, get real-time skeletal + verbal coaching
3. Composition and environment tips - framing, lighting, background


## Limitations and Mitigations
1. uncanny/AI-generated look - use the VLM only for guidance text, never for image generation.
2. validate pose-match with deterministic skeleton comparison first, then layer VLM feedback on top.
3. Include a confidence score to ensure ai will not give bad advice

## Detailed Plan 
Technical Architecture
Frontend - React Web App + PWA
- React app with camera access via getUserMedia()
- MediaPipe Pose Landmarker(@mediapipe/tasks-vision) runs entirely in-browser via WebAssembly. 
- Canvas overlay renders skeleton landmarks and visual guidance. target pose outline, alignment circles
- PWA Manifest for "add to Home Screen". 
- Supported browsers: Chrome (android/desktop), Safari (Iphone)

Backend
- minimal server. 
- proxies VLM API calls
- serves pose database (curated pose JSON + reference images)
- No heavy compute

VLM Layer 
- gemini for natural-language pose coaching
- called periodically (every 3 - 5 seconds), not per-frame
- input: target pose skeleton JSON + user's current skeleton JSON
- Output: text guidance

Compute Cost Summary
MediaPipe pose detection 30 FPS - Users device - $0
Skeleton Comparison Math - Users device - $0
VLM guidance text - third-party api - 
Backend server - Vercel/serverless - free tier

Platform Compatibility
Platform	Support
iPhone (Safari)	✅ Confirmed — MediaPipe officially supports Safari web
Android (Chrome)	✅ Confirmed — primary supported browser
Desktop (Chrome/Safari/Firefox)	✅
PWA install	✅ Both iOS and Android

## User Workflow
1. User opens app in phone Browser or PWA
2. Taps "start" to grant camera permission
3. Browses pose library and selects a target pose
4. Live camera activates - Mediapipe detects user's skeleton in real-time
5. Target pose skeleton overlays on screen as a guide
6. Deterministic skeleton comparison runs per-frame (on=device) - visual feedback shows alignment progress
7. Every 3 - 5 seconds, VLM api is called for natural language coaching text/audio
8. When pose match exceeds threshold -> auto-capture photo
9. User reviews photo, can retake or save 

## Visual Pose Guidance 
