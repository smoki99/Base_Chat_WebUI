import type { ChangeEvent } from 'react';
import {
  HEADER_FONT_FAMILIES,
  HEADER_FONT_SIZE_MAX,
  HEADER_FONT_SIZE_MIN,
  HEADER_LINE_MAX_CHARS,
  HEADER_MAX_SEGMENTS,
  HEADER_SEGMENT_MAX_CHARS,
  splitTextToSegments,
  type UiHeaderSegment,
} from 'shared';
import {
  ALLOWED_IMAGE_TYPES,
  COLOR_PRESETS,
  MAX_IMAGE_BYTES,
  HeaderLineView,
  findMatchingPresetId,
  useAppearance,
  useImageUpload,
} from '../appearance';
import type { UiHeaderLine, UiThemeColors } from '../appearance';

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
          accept={ALLOWED_IMAGE_TYPES.join(',')}
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
      <div className="form-text">PNG oder SVG, max. {Math.round(MAX_IMAGE_BYTES / 1024)} kB.</div>
      {upload.error && (
        <div className="customize-error" role="alert">
          {upload.error}
        </div>
      )}
    </section>
  );
}
/** Font weight options offered in the settings (any 100-900 is accepted). */
const FONT_WEIGHT_OPTIONS = [100, 200, 300, 400, 500, 600, 700, 800, 900];

/**
 * Editor for the styled text segments of one header line (rich header,
 * Story-0038). Segments inherit the line's base style; every field can be
 * overridden per segment. Draft segments with empty text are local only –
 * they are filtered out before saving.
 */
function SegmentEditor({
  line,
  value,
  themeText,
  onSegmentsChange,
}: {
  line: 1 | 2;
  value: UiHeaderLine;
  /** Current theme text color – the "inherit" value for color pickers. */
  themeText: string;
  onSegmentsChange: (segments: UiHeaderSegment[]) => void;
}) {
  const idBase = `customize-header-seg-line${line}`;
  const segments = value.segments;
  const totalChars = segments.reduce((sum, segment) => sum + segment.text.length, 0);
  const lineColor = value.color !== '' ? value.color : themeText;

  const patchSegment = (index: number, patch: Partial<UiHeaderSegment>) =>
    onSegmentsChange(
      segments.map((segment, i) => (i === index ? { ...segment, ...patch } : segment))
    );

  const removeSegment = (index: number) => onSegmentsChange(segments.filter((_, i) => i !== index));

  const moveSegment = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= segments.length) return;
    const entry = segments[index];
    if (!entry) return;
    const next = segments.filter((_, i) => i !== index);
    next.splice(target, 0, entry);
    onSegmentsChange(next);
  };

  return (
    <div className="customize-segments">
      <div className="customize-segments-head">
        <span className="form-text">
          Text-Segmente (optional) – ohne Segmente wird der Zeilen-Text im Zeilen-Stil gerendert.
        </span>
        <span className="form-text" aria-live="polite">
          {totalChars}/{HEADER_LINE_MAX_CHARS} Zeichen
        </span>
      </div>
      {segments.length === 0 ? (
        value.text.trim() !== '' && (
          <button
            type="button"
            className="btn btn-outline-primary"
            onClick={() => onSegmentsChange(splitTextToSegments(value.text))}
          >
            Segment aus Zeilen-Text anlegen
          </button>
        )
      ) : (
        <ul className="customize-segment-list">
          {segments.map((segment, index) => {
            const colorInherited = segment.color === undefined;
            const sizeInherited = segment.fontSize === undefined;
            return (
              <li key={index} className="customize-segment">
                <input
                  id={`${idBase}-${index}-text`}
                  className="form-control"
                  type="text"
                  maxLength={HEADER_SEGMENT_MAX_CHARS}
                  placeholder={`Segment ${index + 1}`}
                  aria-label={`Segment ${index + 1}: Text`}
                  value={segment.text}
                  onChange={(event) => patchSegment(index, { text: event.target.value })}
                />
                <div className="customize-segment-style">
                  <label className="form-check-inline" htmlFor={`${idBase}-${index}-color-inherit`}>
                    <input
                      id={`${idBase}-${index}-color-inherit`}
                      type="checkbox"
                      checked={colorInherited}
                      onChange={(event) =>
                        patchSegment(index, { color: event.target.checked ? undefined : lineColor })
                      }
                    />
                    Zeilenfarbe
                  </label>
                  <input
                    className="form-control"
                    type="color"
                    aria-label={`Segment ${index + 1}: Farbe`}
                    value={toColorInputValue(
                      colorInherited ? lineColor : (segment.color ?? lineColor)
                    )}
                    disabled={colorInherited}
                    onChange={(event) => patchSegment(index, { color: event.target.value })}
                  />
                  <select
                    className="form-select"
                    aria-label={`Segment ${index + 1}: Stärke`}
                    value={
                      segment.fontWeight === undefined ? 'inherit' : String(segment.fontWeight)
                    }
                    onChange={(event) =>
                      patchSegment(index, {
                        fontWeight:
                          event.target.value === 'inherit' ? undefined : Number(event.target.value),
                      })
                    }
                  >
                    <option value="inherit">Stärke: erben</option>
                    {FONT_WEIGHT_OPTIONS.map((weight) => (
                      <option key={weight} value={weight}>
                        {weight}
                      </option>
                    ))}
                  </select>
                  <select
                    className="form-select"
                    aria-label={`Segment ${index + 1}: Stil`}
                    value={segment.fontStyle ?? 'inherit'}
                    onChange={(event) =>
                      patchSegment(index, {
                        fontStyle:
                          event.target.value === 'inherit'
                            ? undefined
                            : (event.target.value as 'normal' | 'italic'),
                      })
                    }
                  >
                    <option value="inherit">Stil: erben</option>
                    <option value="normal">Normal</option>
                    <option value="italic">Kursiv</option>
                  </select>
                  <label className="form-check-inline" htmlFor={`${idBase}-${index}-size-inherit`}>
                    <input
                      id={`${idBase}-${index}-size-inherit`}
                      type="checkbox"
                      checked={sizeInherited}
                      onChange={(event) =>
                        patchSegment(index, {
                          fontSize: event.target.checked ? undefined : value.fontSize,
                        })
                      }
                    />
                    Zeilengröße
                  </label>
                  <input
                    type="range"
                    aria-label={`Segment ${index + 1}: Größe`}
                    min={HEADER_FONT_SIZE_MIN}
                    max={HEADER_FONT_SIZE_MAX}
                    step={1}
                    value={sizeInherited ? value.fontSize : segment.fontSize}
                    disabled={sizeInherited}
                    onChange={(event) =>
                      patchSegment(index, { fontSize: Number(event.target.value) })
                    }
                  />
                </div>
                <div className="customize-segment-actions">
                  <button
                    type="button"
                    className="btn btn-outline"
                    aria-label={`Segment ${index + 1} nach oben`}
                    disabled={index === 0}
                    onClick={() => moveSegment(index, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    aria-label={`Segment ${index + 1} nach unten`}
                    disabled={index === segments.length - 1}
                    onClick={() => moveSegment(index, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-danger"
                    aria-label={`Segment ${index + 1} entfernen`}
                    onClick={() => removeSegment(index)}
                  >
                    ×
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div className="customize-segments-foot">
        <button
          type="button"
          className="btn btn-outline-primary"
          disabled={segments.length >= HEADER_MAX_SEGMENTS}
          onClick={() => onSegmentsChange([...segments, { text: '' }])}
        >
          + Segment
        </button>
        {segments.length > 0 && (
          <button type="button" className="btn btn-outline" onClick={() => onSegmentsChange([])}>
            Segmente entfernen
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Editor for one configurable header line (Story-0038): text, font family,
 * size, weight, color (or theme color), italic – and optional styled
 * text segments (rich header).
 */
function HeaderLineEditor({
  line,
  value,
  themeText,
  onUpdate,
  onSegmentsChange,
}: {
  line: 1 | 2;
  value: UiHeaderLine;
  /** Current theme text color – the "inherit" value for the color picker. */
  themeText: string;
  onUpdate: (patch: Partial<UiHeaderLine>) => void;
  onSegmentsChange: (segments: UiHeaderSegment[]) => void;
}) {
  const idBase = `customize-header-line${line}`;
  const themeInherited = value.color === '';

  return (
    <fieldset className="customize-header-line">
      <legend className="customize-header-line-legend">Zeile {line}</legend>
      <div className="customize-colors">
        <div className="customize-color customize-color--wide">
          <label htmlFor={`${idBase}-text`}>Text</label>
          <input
            id={`${idBase}-text`}
            className="form-control"
            type="text"
            maxLength={HEADER_LINE_MAX_CHARS}
            placeholder={line === 1 ? 'z. B. Base Chat' : "z. B. Let's talk realestate."}
            value={value.text}
            onChange={(event) => onUpdate({ text: event.target.value })}
          />
        </div>
        <div className="customize-color">
          <label htmlFor={`${idBase}-font`}>Schriftart</label>
          <select
            id={`${idBase}-font`}
            className="form-select"
            value={value.fontFamily}
            onChange={(event) => onUpdate({ fontFamily: event.target.value })}
          >
            {HEADER_FONT_FAMILIES.map((font) => (
              <option key={font.id} value={font.value}>
                {font.label}
              </option>
            ))}
          </select>
        </div>
        <div className="customize-color">
          <label htmlFor={`${idBase}-size`}>Größe ({value.fontSize} px)</label>
          <input
            id={`${idBase}-size`}
            type="range"
            min={HEADER_FONT_SIZE_MIN}
            max={HEADER_FONT_SIZE_MAX}
            step={1}
            value={value.fontSize}
            onChange={(event) => onUpdate({ fontSize: Number(event.target.value) })}
          />
        </div>
        <div className="customize-color">
          <label htmlFor={`${idBase}-weight`}>Stärke</label>
          <select
            id={`${idBase}-weight`}
            className="form-select"
            value={String(value.fontWeight)}
            onChange={(event) => onUpdate({ fontWeight: Number(event.target.value) })}
          >
            {FONT_WEIGHT_OPTIONS.map((weight) => (
              <option key={weight} value={weight}>
                {weight}
              </option>
            ))}
          </select>
        </div>
        <div className="customize-color">
          <label htmlFor={`${idBase}-color`}>Farbe</label>
          <input
            id={`${idBase}-color`}
            type="color"
            value={toColorInputValue(themeInherited ? themeText : value.color)}
            disabled={themeInherited}
            onChange={(event) => onUpdate({ color: event.target.value })}
          />
        </div>
      </div>
      <div className="form-check">
        <input
          className="form-check-input"
          id={`${idBase}-inherit`}
          type="checkbox"
          checked={themeInherited}
          onChange={(event) => onUpdate({ color: event.target.checked ? '' : themeText })}
        />
        <label className="form-check-label" htmlFor={`${idBase}-inherit`}>
          Theme-Textfarbe verwenden
        </label>
      </div>
      <div className="form-check">
        <input
          className="form-check-input"
          id={`${idBase}-italic`}
          type="checkbox"
          checked={value.fontStyle === 'italic'}
          onChange={(event) => onUpdate({ fontStyle: event.target.checked ? 'italic' : 'normal' })}
        />
        <label className="form-check-label" htmlFor={`${idBase}-italic`}>
          Kursiv
        </label>
      </div>
      <SegmentEditor
        line={line}
        value={value}
        themeText={themeText}
        onSegmentsChange={onSegmentsChange}
      />
    </fieldset>
  );
}

/** color customization with presets +
 * live preview, logo/banner upload (PNG or SVG) and the factory reset.
 * All state comes from the AppearanceProvider (persistence included).
 */
export function CustomizeTab() {
  const {
    colors,
    logo,
    banner,
    bannerVisible,
    header,
    saveState,
    saveError,
    setColor,
    setColors,
    setLogo,
    setBanner,
    setBannerVisible,
    updateHeaderLine,
    setHeaderSegments,
    reset,
  } = useAppearance();

  const activePresetId = findMatchingPresetId(colors);

  return (
    <div className="customize-tab">
      {/* ── Save state (server persistence, Story-0038) ─────────── */}
      {saveState === 'error' && (
        <div className="customize-error" role="alert">
          Speichern fehlgeschlagen: {saveError ?? 'Unbekannter Fehler'}. Für das Speichern ist ein
          Admin-Token erforderlich (Admin-Panel → Token setzen).
        </div>
      )}
      {saveState === 'saving' && <div className="form-text">Wird gespeichert …</div>}

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

      {/* ── Header (two lines, Story-0038) ───────────────────── */}
      <section className="customize-section" aria-labelledby="customize-header-title">
        <h3 id="customize-header-title" className="customize-section-title">
          Header
        </h3>
        <div className="customize-header-preview" aria-hidden="true">
          <div className="chat-header chat-header--preview">
            <div className="chat-header-titles">
              <HeaderLineView
                line={header.line1}
                className="chat-header-title chat-header-title--line1"
              />
              <HeaderLineView
                line={header.line2}
                className="chat-header-title chat-header-title--line2"
              />
            </div>
          </div>
        </div>
        <HeaderLineEditor
          line={1}
          value={header.line1}
          themeText={colors.text}
          onUpdate={(patch) => updateHeaderLine('line1', patch)}
          onSegmentsChange={(segments) => setHeaderSegments('line1', segments)}
        />
        <HeaderLineEditor
          line={2}
          value={header.line2}
          themeText={colors.text}
          onUpdate={(patch) => updateHeaderLine('line2', patch)}
          onSegmentsChange={(segments) => setHeaderSegments('line2', segments)}
        />
        <div className="form-text">Leere Zeilen werden im Chat nicht angezeigt.</div>
      </section>

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
