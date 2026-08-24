import { DetectionRecord } from './types';

export const INITIAL_DETECTIONS: DetectionRecord[] = [
  {
    id: 1048,
    imageUrl: 'https://images.unsplash.com/photo-1584634731339-252c581abfc5?w=200&auto=format&fit=crop&q=80',
    prediction: 'Mask',
    confidence: 98.4,
    inferenceTime: '38 ms',
    date: '21 Aug 2026',
    time: '09:30 AM',
    checkpoint: 'South Entrance Gate 1'
  },
  {
    id: 1047,
    imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
    prediction: 'No Mask',
    confidence: 96.8,
    inferenceTime: '42 ms',
    date: '21 Aug 2026',
    time: '09:28 AM',
    checkpoint: 'Main Turnstile B'
  },
  {
    id: 1046,
    imageUrl: 'https://images.unsplash.com/photo-1584634731339-252c581abfc5?w=200&auto=format&fit=crop&q=80',
    prediction: 'Mask',
    confidence: 99.1,
    inferenceTime: '35 ms',
    date: '21 Aug 2026',
    time: '09:15 AM',
    checkpoint: 'Staff Elevator Lobby'
  },
  {
    id: 1045,
    imageUrl: 'https://images.unsplash.com/photo-1584634731339-252c581abfc5?w=200&auto=format&fit=crop&q=80',
    prediction: 'Mask',
    confidence: 95.6,
    inferenceTime: '39 ms',
    date: '21 Aug 2026',
    time: '09:02 AM',
    checkpoint: 'North Wing Corridor'
  },
  {
    id: 1044,
    imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
    prediction: 'No Mask',
    confidence: 94.3,
    inferenceTime: '44 ms',
    date: '21 Aug 2026',
    time: '08:45 AM',
    checkpoint: 'Visitor Reception'
  },
  {
    id: 1043,
    imageUrl: 'https://images.unsplash.com/photo-1584634731339-252c581abfc5?w=200&auto=format&fit=crop&q=80',
    prediction: 'Mask',
    confidence: 97.8,
    inferenceTime: '36 ms',
    date: '21 Aug 2026',
    time: '08:30 AM',
    checkpoint: 'South Entrance Gate 2'
  }
];
