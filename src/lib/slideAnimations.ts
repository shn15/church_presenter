export interface AnimationPresetMeta {
  id: string;
  label: string;
  description: string;
}

export const SLIDE_ANIMATION_PRESETS: AnimationPresetMeta[] = [
  {
    id: "none",
    label: "Tanpa Animasi",
    description: "Perpindahan langsung tanpa jeda",
  },
  {
    id: "fade",
    label: "Pudar Halus",
    description: "Transisi redup dan terang secara lembut",
  },
  {
    id: "slide",
    label: "Luncur Atas",
    description: "Seluruh slide meluncur mulus dari bawah",
  },
  {
    id: "push-down",
    label: "Turun Mengalir",
    description: "Slide masuk perlahan dari bagian atas",
  },
  {
    id: "pan-left",
    label: "Geser Kiri",
    description: "Meluncur penuh dari tepi kanan ke tengah",
  },
  {
    id: "pan-right",
    label: "Geser Kanan",
    description: "Meluncur penuh dari tepi kiri ke tengah",
  },
  {
    id: "zoom",
    label: "Membesar Sinematik",
    description: "Membesar lembut dari titik fokus tengah",
  },
  {
    id: "zoom-out",
    label: "Menyusut Dramatis",
    description: "Menurun elegan dari tampilan dekat ke pas",
  },
  {
    id: "wipe",
    label: "Tirai Menyapu",
    description: "Terbuka menyapu dari kiri ke kanan",
  },
  {
    id: "split",
    label: "Belah Tengah",
    description: "Membuka simetris dari garis tengah layar",
  },
  {
    id: "curtain-v",
    label: "Buka Vertikal",
    description: "Membuka melebar dari tengah ke atas dan bawah",
  },
  {
    id: "flip",
    label: "Putar 3D",
    description: "Rotasi perspektif tiga dimensi yang dinamis",
  },
];

export const TEXT_ANIMATION_PRESETS: AnimationPresetMeta[] = [
  {
    id: "none",
    label: "Normal (Ikuti Slide)",
    description: "Teks hanya mengikuti transisi slide",
  },
  {
    id: "stagger-rise",
    label: "Gelombang Naik",
    description: "Tiap baris naik bergantian secara mengalir",
  },
  {
    id: "stagger-side",
    label: "Silang Kiri-Kanan",
    description: "Baris ganjil dan genap masuk dari arah berlawanan",
  },
  {
    id: "typewriter",
    label: "Sapuan Ketik",
    description: "Tersingkap halus baris demi baris dari kiri",
  },
  {
    id: "elastic-pop",
    label: "Membal Elastis",
    description: "Muncul membesar dengan pantulan pegas kenyal",
  },
  {
    id: "drop-bounce",
    label: "Jatuh Memantul",
    description: "Turun dari atas dan memantul lembut saat mendarat",
  },
  {
    id: "blur-focus",
    label: "Fokus Buram",
    description: "Dari buram sinematik menjadi tajam sempurna",
  },
  {
    id: "glide-skew",
    label: "Meluncur Miring",
    description: "Meluncur cepat dengan kemiringan dinamis lalu tegak",
  },
  {
    id: "flip-lines",
    label: "Balik 3D Per Baris",
    description: "Setiap baris berputar tiga dimensi satu per satu",
  },
  {
    id: "reveal-up",
    label: "Singkap Masker",
    description: "Teks muncul dari balik garis tak terlihat ke atas",
  },
  {
    id: "zoom-wave",
    label: "Sorot Menyusut",
    description: "Huruf turun membesar lalu menapak fokus presisi",
  },
  {
    id: "fade",
    label: "Pudar Berlapis",
    description: "Setiap baris muncul memudar lembut satu per satu",
  },
];

export const ANIMATION_SPEED_MULTIPLIER: Record<string, number> = {
  fast: 0.65,
  normal: 1,
  slow: 1.6,
};

export function resolveAnimDuration(baseDuration = 0.72, speed = "normal"): number {
  const safeBase = Math.max(0.55, Math.min(2.2, baseDuration || 0.72));
  const mult = ANIMATION_SPEED_MULTIPLIER[speed] ?? 1;
  return Number((safeBase * mult).toFixed(2));
}

export function getSlideTransitionMotion(
  preset: string = "fade",
  baseDuration: number = 0.72,
  speed: string = "normal",
) {
  const dur = resolveAnimDuration(baseDuration, speed);
  const silkyEase = [0.16, 1, 0.3, 1] as const;

  switch (preset) {
    case "none":
      return {
        initial: { opacity: 1, x: 0, y: 0, scale: 1 },
        animate: { opacity: 1, x: 0, y: 0, scale: 1 },
        exit: { opacity: 1, x: 0, y: 0, scale: 1 },
        transition: { duration: 0 },
      };
    case "zoom":
      return {
        initial: { opacity: 0, scale: 0.38, filter: "blur(8px)" },
        animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
        exit: { opacity: 0, scale: 1.18, filter: "blur(6px)" },
        transition: { duration: dur * 1.1, ease: silkyEase },
      };
    case "zoom-out":
      return {
        initial: { opacity: 0, scale: 1.55, filter: "blur(10px)" },
        animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
        exit: { opacity: 0, scale: 0.75, filter: "blur(6px)" },
        transition: { duration: dur * 1.1, ease: silkyEase },
      };
    case "slide":
      return {
        initial: { opacity: 0, y: "55%" },
        animate: { opacity: 1, y: "0%" },
        exit: { opacity: 0, y: "-40%" },
        transition: { duration: dur, ease: silkyEase },
      };
    case "push-down":
      return {
        initial: { opacity: 0, y: "-55%" },
        animate: { opacity: 1, y: "0%" },
        exit: { opacity: 0, y: "40%" },
        transition: { duration: dur, ease: silkyEase },
      };
    case "pan-left":
      return {
        initial: { opacity: 0, x: "65%" },
        animate: { opacity: 1, x: "0%" },
        exit: { opacity: 0, x: "-55%" },
        transition: { duration: dur, ease: silkyEase },
      };
    case "pan-right":
      return {
        initial: { opacity: 0, x: "-65%" },
        animate: { opacity: 1, x: "0%" },
        exit: { opacity: 0, x: "55%" },
        transition: { duration: dur, ease: silkyEase },
      };
    case "wipe":
      return {
        initial: { opacity: 0.7, clipPath: "inset(0 100% 0 0)" },
        animate: { opacity: 1, clipPath: "inset(0 0% 0 0)" },
        exit: { opacity: 0, clipPath: "inset(0 0 0 100%)" },
        transition: { duration: dur * 1.15, ease: [0.45, 0, 0.25, 1] as const },
      };
    case "split":
      return {
        initial: { opacity: 0.5, clipPath: "inset(0 50% 0 50%)" },
        animate: { opacity: 1, clipPath: "inset(0 0% 0 0%)" },
        exit: { opacity: 0, clipPath: "inset(0 50% 0 50%)" },
        transition: { duration: dur * 1.15, ease: silkyEase },
      };
    case "curtain-v":
      return {
        initial: { opacity: 0.5, clipPath: "inset(50% 0 50% 0)" },
        animate: { opacity: 1, clipPath: "inset(0% 0 0% 0)" },
        exit: { opacity: 0, clipPath: "inset(50% 0 50% 0)" },
        transition: { duration: dur * 1.15, ease: silkyEase },
      };
    case "flip":
      return {
        initial: { opacity: 0, rotateY: 78, scale: 0.85 },
        animate: { opacity: 1, rotateY: 0, scale: 1 },
        exit: { opacity: 0, rotateY: -65, scale: 0.88 },
        transition: { duration: dur * 1.2, ease: silkyEase },
      };
    case "fade":
    default:
      return {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: dur, ease: [0.4, 0, 0.2, 1] as const },
      };
  }
}

export function getTextLineMotionVariant(
  preset: string = "none",
  lineIdx: number = 0,
  baseDuration: number = 0.75,
  speed: string = "normal",
) {
  const dur = resolveAnimDuration(baseDuration, speed);
  const speedMult = ANIMATION_SPEED_MULTIPLIER[speed] ?? 1;
  const stagger = (idx: number, step = 0.11) => Number((idx * step * speedMult).toFixed(3));
  const silkyEase = [0.16, 1, 0.3, 1] as const;

  switch (preset) {
    case "stagger-rise":
    case "rise":
      return {
        initial: { opacity: 0, y: 54 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: dur, delay: stagger(lineIdx, 0.12), ease: silkyEase },
      };
    case "stagger-side":
    case "pan":
      return {
        initial: { opacity: 0, x: lineIdx % 2 === 0 ? -110 : 110 },
        animate: { opacity: 1, x: 0 },
        transition: { duration: dur * 1.05, delay: stagger(lineIdx, 0.1), ease: silkyEase },
      };
    case "typewriter":
    case "wipe-text":
      return {
        initial: { opacity: 0.2, clipPath: "inset(0 100% 0 0)" },
        animate: { opacity: 1, clipPath: "inset(0 0% 0 0)" },
        transition: { duration: dur * 1.15, delay: stagger(lineIdx, 0.18), ease: [0.35, 0, 0.2, 1] as const },
      };
    case "elastic-pop":
    case "pop":
      return {
        initial: { opacity: 0, scale: 0.28 },
        animate: { opacity: 1, scale: 1 },
        transition: {
          type: "spring" as const,
          stiffness: 210,
          damping: 13,
          mass: 0.85,
          delay: stagger(lineIdx, 0.09),
        },
      };
    case "drop-bounce":
    case "bounce":
    case "drop":
      return {
        initial: { opacity: 0, y: -78 },
        animate: { opacity: 1, y: 0 },
        transition: {
          type: "spring" as const,
          stiffness: 260,
          damping: 14,
          mass: 0.9,
          delay: stagger(lineIdx, 0.1),
        },
      };
    case "blur-focus":
    case "blur":
      return {
        initial: { opacity: 0, filter: "blur(22px)", scale: 1.1 },
        animate: { opacity: 1, filter: "blur(0px)", scale: 1 },
        transition: { duration: dur * 1.3, delay: stagger(lineIdx, 0.11), ease: [0.22, 1, 0.36, 1] as const },
      };
    case "glide-skew":
      return {
        initial: { opacity: 0, x: -95, skewX: 16 },
        animate: { opacity: 1, x: 0, skewX: 0 },
        transition: { duration: dur * 0.95, delay: stagger(lineIdx, 0.1), ease: silkyEase },
      };
    case "flip-lines":
    case "swivel":
      return {
        initial: { opacity: 0, rotateX: -82, y: 20 },
        animate: { opacity: 1, rotateX: 0, y: 0 },
        transition: { duration: dur * 1.05, delay: stagger(lineIdx, 0.12), ease: silkyEase },
      };
    case "reveal-up":
    case "float":
      return {
        initial: { opacity: 0, y: 30, clipPath: "inset(100% 0 0 0)" },
        animate: { opacity: 1, y: 0, clipPath: "inset(0% 0 0 0)" },
        transition: { duration: dur, delay: stagger(lineIdx, 0.12), ease: silkyEase },
      };
    case "zoom-wave":
    case "zoom-text":
      return {
        initial: { opacity: 0, scale: 1.55, filter: "blur(10px)" },
        animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
        transition: { duration: dur * 1.05, delay: stagger(lineIdx, 0.11), ease: silkyEase },
      };
    case "fade":
      return {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        transition: { duration: dur * 1.25, delay: stagger(lineIdx, 0.16), ease: [0.4, 0, 0.2, 1] as const },
      };
    case "none":
    default:
      return null;
  }
}

export function getTextAnimationMotion(
  preset: string = "none",
  baseDuration: number = 0.75,
  speed: string = "normal",
) {
  return getTextLineMotionVariant(preset, 0, baseDuration, speed);
}
