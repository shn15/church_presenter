export interface Slide {
  id?: string;
  parentId?: string;
  slideIdx?: number;
  title: string;
  content: string;
  background?: string;
  type: 'lyrics' | 'scripture' | 'announcement' | 'qr' | 'logo';
  isLive?: boolean;
  _syncTs?: number;
  _syncSession?: string;
  
  // Custom Styling
  textColor?: string;
  fontSizeMode?: 'auto' | 'manual';
  fontSize?: number;
  textAlign?: 'left' | 'center' | 'right';
  textPosition?: 'top' | 'center' | 'bottom';
  textBold?: boolean;
  textItalic?: boolean;
  textShadow?: boolean;
  fontFamily?: string;
  textTransform?: 'uppercase' | 'none';
  backgroundOverride?: string;
  shapeDecoration?: string;
  textTracking?: 'tighter' | 'tight' | 'normal' | 'wide' | 'widest';
  textSpacing?: 'relaxed' | 'snug' | 'normal' | 'loose';
  slideTransition?: string;
  textAnimation?: string;
  animationSpeed?: 'fast' | 'normal' | 'slow';
  textOutline?: boolean;
  textOutlineColor?: string;
  bgOpacity?: number;
  bgBrightness?: number;
  bgBlur?: number;
  bgFit?: 'cover' | 'contain' | 'fill';
  bgScale?: number;
  bgPositionX?: number;
  bgPositionY?: number;
  logoUrl?: string;
  logoPosition?: 'left' | 'right';
  logoLeftUrl?: string;
  logoRightUrl?: string;
  textWidth?: number;
  textHeight?: number;
  textLeft?: number;
  textTop?: number;
}

export interface Song {
  id: string;
  title: string;
  artist?: string;
  verses: string[];
  verseLabels?: string[];
  pericopes?: Record<number, string[]>;
  
  // Custom Styling
  textColor?: string;
  fontSizeMode?: 'auto' | 'manual';
  fontSize?: number;
  textAlign?: 'left' | 'center' | 'right';
  textPosition?: 'top' | 'center' | 'bottom';
  textBold?: boolean;
  textItalic?: boolean;
  textShadow?: boolean;
  fontFamily?: string;
  textTransform?: 'uppercase' | 'none';
  backgroundOverride?: string;
  shapeDecoration?: string;
  textTracking?: 'tighter' | 'tight' | 'normal' | 'wide' | 'widest';
  textSpacing?: 'relaxed' | 'snug' | 'normal' | 'loose';
  slideTransition?: string;
  textAnimation?: string;
  animationSpeed?: 'fast' | 'normal' | 'slow';
  textOutline?: boolean;
  textOutlineColor?: string;
  bgOpacity?: number;
  bgBrightness?: number;
  bgBlur?: number;
  bgFit?: 'cover' | 'contain' | 'fill';
  bgScale?: number;
  bgPositionX?: number;
  bgPositionY?: number;
  logoUrl?: string;
  logoPosition?: 'left' | 'right';
  logoLeftUrl?: string;
  logoRightUrl?: string;
  textWidth?: number;
  textHeight?: number;
  textLeft?: number;
  textTop?: number;
}

export interface ScheduleItem {
  id: string;
  songId?: string;
  title: string;
  artist?: string;
  type: 'song' | 'bible' | 'media' | 'slide';
  verses: string[];
  verseLabels?: string[];
  pericopes?: Record<number, string[]>;

  // Custom Styling
  textColor?: string;
  fontSizeMode?: 'auto' | 'manual';
  fontSize?: number;
  textAlign?: 'left' | 'center' | 'right';
  textPosition?: 'top' | 'center' | 'bottom';
  textBold?: boolean;
  textItalic?: boolean;
  textShadow?: boolean;
  fontFamily?: string;
  textTransform?: 'uppercase' | 'none';
  backgroundOverride?: string;
  shapeDecoration?: string;
  textTracking?: 'tighter' | 'tight' | 'normal' | 'wide' | 'widest';
  textSpacing?: 'relaxed' | 'snug' | 'normal' | 'loose';
  slideTransition?: string;
  textAnimation?: string;
  animationSpeed?: 'fast' | 'normal' | 'slow';
  textOutline?: boolean;
  textOutlineColor?: string;
  bgOpacity?: number;
  bgBrightness?: number;
  bgBlur?: number;
  bgFit?: 'cover' | 'contain' | 'fill';
  bgScale?: number;
  bgPositionX?: number;
  bgPositionY?: number;
  logoUrl?: string;
  logoPosition?: 'left' | 'right';
  logoLeftUrl?: string;
  logoRightUrl?: string;
  textWidth?: number;
  textHeight?: number;
  textLeft?: number;
  textTop?: number;
}

export interface ChurchState {
  currentSlide: Slide;
  history: Slide[];
}

export interface Shift {
  active: boolean;
  name: string;
  endTime: string; // HH:MM format
  token?: string;
}

export interface CustomBible {
  id: string;
  name: string;
  bookNames?: string[];
  books?: {
    [bookName: string]: {
      [chapterNumber: string]: string[];
    };
  };
}
