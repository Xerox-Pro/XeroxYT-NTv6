export interface GlassConfig {
  blurAmount?: number;
  refraction?: number;
  chromAberration?: number;
  edgeHighlight?: number;
  specular?: number;
  fresnel?: number;
  distortion?: number;
  cornerRadius?: number;
  zRadius?: number;
  opacity?: number;
  saturation?: number;
  tintStrength?: number;
  brightness?: number;
  shadowOpacity?: number;
  shadowSpread?: number;
  shadowOffsetY?: number;
  floating?: boolean;
  button?: boolean;
  bevelMode?: number;
}

export interface LiquidGlassOptions {
  root: HTMLElement;
  glassElements?: HTMLElement[] | NodeListOf<HTMLElement>;
  defaults?: GlassConfig;
}

export declare class LiquidGlass {
  root: HTMLElement;
  constructor(options: LiquidGlassOptions);
  static init(options: LiquidGlassOptions): Promise<LiquidGlass>;
  destroy(): void;
  updateDefaults(defaults: Partial<GlassConfig>): void;
  markChanged(element?: HTMLElement): void;
  [key: string]: any;
}

export declare const DEFAULTS: GlassConfig;
export declare function invalidateFontEmbedCache(): void;
