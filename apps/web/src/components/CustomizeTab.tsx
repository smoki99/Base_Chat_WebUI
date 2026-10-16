import type { ChangeEvent } from 'react';
import {
  ALLOWED_IMAGE_TYPE,
  COLOR_PRESETS,
  MAX_IMAGE_BYTES,
  findMatchingPresetId,
  useAppearance,
  useImageUpload,
} from '../appearance';
import type { UiThemeColors } from '../appearance';

const COLOR_FIELDS = [
  'primary',
  'primaryHover',
  'surface',
  'surfaceDim',
  'text',
] as const satisfies readonly (keyof UiThemeColors)[];

const COLOR_LABELS: Record<keyof UiThemeColors, string> = {
  primary: 'Primärfarbe',
  primaryHover: 'Primärfarbe (Hover)',
  surface: 'Hintergrund',
  surfaceDim: 'Seitenleiste',
  text: 'Textfarbe',
};

/** Normalizes a hex color to the 6-digit form required by `<input type="color">`. */
function toColorInputValue(hex: string): string {
  const short = /^#([0-9a-f]{3})$/i.exec(hex);
  if (short) {
    const v = short[1] ?? '';
    return `#${v[0]}${v[0]}${v[1]}${v[1]}${v[2]}${v[2]}`.toLowerCase();
  }
  if (/^#[0-9a-f]{6}$/i.test(hex)) return hex.toLowerCase();
  return '#000000';
}

/** Upload/preview/remove controls for one image slot (logo or banner). */
function ImageSection({
  title,
  dataUrl,
  onUploaded,
  onRemove,
}: {
  title: string;
  dataUrl: string | null;
  onUploaded: (dataUrl: string) => void;
  onRemove: () => void;
}) {
  const upload = useImageUpload();

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file) return;
    const dataUrl = await upload.pickFile(file);
    if (dataUrl) onUploaded(dataUrl);
  }

  const idBase = `customize-${title.toLowerCase()}`;

  return (
    <section className="customize-section" aria-labelledby={`${idBase}-title`}>
      <h3 id={`${idBase}-title`} className="customize-section-title">
        {title}
      </h3>
      {dataUrl && <img className="customize-preview" src={dataUrl} alt={`${title} (Vorschau)`} />}
      <label className="btn btn-outline-primary customize-file-btn">
        {dataUrl ? `${title} ersetzen` : `${title} hochladen`}
        <input
          id={`${idBase}-file`}
          type="file"
          accept={ALLOWED_IMAGE_TYPE}
          className="visually-hidden"
          aria-label={`${title}-Datei wählen`}
          disabled={upload.busy}
          onChange={(event) => void handleFileChange(event)}
        />
      </label>
      {dataUrl && (
        <button type="button" className="btn btn-outline-danger" onClick={onRemove}>
          {title} entfernen
        </button>
      )}
      <div className="form-text">PNG, max. {Math.round(MAX_IMAGE_BYTES / 1024)} kB.</div>
      {upload.error && (
        <div className="customize-error" role="alert">
          {upload.error}
        </div>
      )}
    </section>
  );
}
/**
 * "Erscheinungsbild" settings panel: color customization with presets +
 * live preview, logo/banner upload (PNG) and the factory reset.
 * All state comes from the AppearanceProvider (persistence included).
 */
export function CustomizeTab() {
  const {
    colors,
    logo,
    banner,
    bannerVisible,
    setColor,
    setColors,
    setLogo,
    setBanner,
    setBannerVisible,
    reset,
  } = useAppearance();

  const activePresetId = findMatchingPresetId(colors);

  return (
    <div className="customize-tab">
      {/* ── Colors ─────────────────────────────────────────────── */}
      <section className="customize-section" aria-labelledby="customize-colors-title">
        <h3 id="customize-colors-title" className="customize-section-title">
          Farben
        </h3>

        <div className="customize-presets" role="group" aria-label="Farbpresets">
          {COLOR_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`customize-preset${
                activePresetId === preset.id ? ' customize-preset--active' : ''
              }`}
              aria-label={`Farbschema ${preset.name} anwenden`}
              aria-pressed={activePresetId === preset.id}
              onClick={() => setColors(preset.colors)}
            >
              <span
                className="customize-preset-dot"
                aria-hidden="true"
                style={{ backgroundColor: preset.colors.primary }}
              />
              {preset.name}
            </button>
          ))}
        </div>

        <div className="customize-colors">
          {COLOR_FIELDS.map((key) => (
            <div className="customize-color" key={key}>
              <label htmlFor={`customize-color-${key}`}>{COLOR_LABELS[key]}</label>
              <input
                id={`customize-color-${key}`}
                type="color"
                value={toColorInputValue(colors[key])}
                onChange={(event) => setColor(key, event.target.value)}
              />
            </div>
          ))}
        </div>
        <div className="form-text">
          Die Änderungen werden sofort im UI angezeigt und gespeichert.
        </div>
      </section>

      {/* ── Logo ───────────────────────────────────────────────── */}
      <ImageSection
        title="Logo"
        dataUrl={logo}
        onUploaded={(dataUrl) => setLogo(dataUrl)}
        onRemove={() => setLogo(null)}
      />

      {/* ── Banner ─────────────────────────────────────────────── */}
      <ImageSection
        title="Banner"
        dataUrl={banner}
        onUploaded={(dataUrl) => {
          setBanner(dataUrl);
          // A fresh banner should be visible right away.
          setBannerVisible(true);
        }}
        onRemove={() => setBanner(null)}
      />
      {banner && (
        <div className="form-check customize-banner-toggle">
          <input
            className="form-check-input"
            type="checkbox"
            id="customize-banner-visible"
            checked={bannerVisible}
            onChange={(event) => setBannerVisible(event.target.checked)}
          />
          <label className="form-check-label" htmlFor="customize-banner-visible">
            Banner anzeigen
          </label>
        </div>
      )}

      {/* ── Reset ──────────────────────────────────────────────── */}
      <section className="customize-section" aria-labelledby="customize-reset-title">
        <h3 id="customize-reset-title" className="customize-section-title">
          Zurücksetzen
        </h3>
        <button type="button" className="btn btn-outline-danger" onClick={reset}>
          Auf Werkseinstellungen zurücksetzen
        </button>
      </section>
    </div>
  );
}
