/**
 * Type definitions for FaceGuard AI Face Mask Detection System
 */

export type PageName = 
  | 'home' 
  | 'about' 
  | 'live_detection' 
  | 'image_detection' 
  | 'result' 
  | 'history' 
  | 'dashboard' 
  | 'login' 
  | 'register';

export interface DetectionRecord {
  id: number;
  imageUrl: string;
  prediction: 'Mask' | 'No Mask';
  confidence: number;
  inferenceTime: string;
  date: string;
  time: string;
  checkpoint?: string;
}

export interface SystemStats {
  totalDetections: number;
  maskCount: number;
  noMaskCount: number;
  modelAccuracy: string;
  maskPercentage: number;
  noMaskPercentage: number;
}
