export const CLUB_COVER_ASPECT = 375 / 264.5;
export const CLUB_IMAGE_MAX_ZOOM = 4;
export const CLUB_COVER_GRADIENT = ["rgba(8,14,24,0.03)", "rgba(8,14,24,0.18)", "rgba(8,14,24,0.94)", "#080E18"] as const;
export const CLUB_COVER_GRADIENT_LOCATIONS = [0, 0.30, 0.70, 1] as const;

export type ClubImageFrame = { zoom: number; x: number; y: number; whole: boolean };
export type ImageDimensions = { width: number; height: number };
export const initialClubFrame = (whole = false): ClubImageFrame => ({ zoom: 1, x: 0, y: 0, whole });

export function clubImageGeometry(viewport: ImageDimensions, image: ImageDimensions, frame: ClubImageFrame) {
  const horizontal = viewport.width / image.width;
  const vertical = viewport.height / image.height;
  const scale = frame.whole ? Math.min(horizontal, vertical) : Math.max(horizontal, vertical) * frame.zoom;
  const width = image.width * scale;
  const height = image.height * scale;
  const overflowX = Math.max(0, width - viewport.width);
  const overflowY = Math.max(0, height - viewport.height);
  return {
    width, height, overflowX, overflowY,
    left: (viewport.width - width + overflowX * frame.x) / 2,
    top: (viewport.height - height + overflowY * frame.y) / 2
  };
}

export function moveClubFrame(frame: ClubImageFrame, viewport: ImageDimensions, image: ImageDimensions,
  zoom: number, dx: number, dy: number): ClubImageFrame {
  const next = { ...frame, zoom: Math.min(CLUB_IMAGE_MAX_ZOOM, Math.max(1, zoom)) };
  const { overflowX, overflowY } = clubImageGeometry(viewport, image, next);
  const clamp = (value: number) => Math.max(-1, Math.min(1, value));
  return { ...next, x: overflowX ? clamp(frame.x + 2 * dx / overflowX) : 0,
    y: overflowY ? clamp(frame.y + 2 * dy / overflowY) : 0 };
}
